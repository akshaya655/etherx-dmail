import { gun, db } from "@/utils/gun"
import { cacheMail } from "@/utils/mailCache"
import { filterIncomingMail } from "@/utils/spamFilter"
import { MAIL_DOMAIN, MAIL_DOMAIN_ALIAS } from "@/utils/config"

// 🚀 HIGH-PERFORMANCE DATA STRUCTURES
let allMailsMap: Map<string, any> = new Map()
let memoizedMailsArray: any[] | null = null // Cache the array version
let currentEmail = ""
let isListening = false
const listeners: Set<() => void> = new Set()
const processedIds = new Set<string>()

// 🚀 CACHED QUERY RESULTS
let memoizedResults: Map<string, any[]> = new Map()
let notifyTimeout: any = null

const notify = () => {
  if (notifyTimeout) clearTimeout(notifyTimeout)
  notifyTimeout = setTimeout(() => {
    memoizedMailsArray = null // Invalidate array cache
    memoizedResults.clear()    // Invalidate query cache
    listeners.forEach((fn) => fn())
    notifyTimeout = null
  }, 100) // 100ms debounce
}

const getMailsArray = () => {
  if (!memoizedMailsArray) {
    memoizedMailsArray = Array.from(allMailsMap.values())
  }
  return memoizedMailsArray
}

export const initMailStore = async (userEmail: string, force = false) => {
  if (isListening && currentEmail === userEmail && !force) return
  
  // 🧹 [Phase 8 Fix] Always start with a clean slate when the user changes or force=true.
  // This prevents stale data from a previous session polluting the new inbox.
  allMailsMap.clear()
  memoizedMailsArray = null
  memoizedResults.clear()
  processedIds.clear()

  currentEmail = userEmail
  isListening = true

  console.log(`📥 [MailStore] Fresh init for ${userEmail} (force: ${force})`)

  // 🚀 Load local IndexedDB cached mails for instant rendering and offline support
  try {
    const { getCachedMails } = await import("@/utils/mailCache")
    const cached = await getCachedMails(userEmail)
    let addedCount = 0
    cached.forEach((m: any) => {
      if (m && m.id && !allMailsMap.has(m.id)) {
        allMailsMap.set(m.id, { ...m, fromCache: true })
        addedCount++
      }
    })
    if (addedCount > 0) notify()
  } catch (e) {
    console.warn("Failed to load cached mails on init:", e)
  }

  // 🎯 Listen for live network index updates (user_mail_index via listenUserMails).
  db.listenUserMails(userEmail, async (mail: any) => {

    if (!mail || !mail.id) return

    const existing = allMailsMap.get(mail.id)
    const variants = [userEmail]
    if (userEmail.endsWith(`@${MAIL_DOMAIN}`)) variants.push(userEmail.replace(`@${MAIL_DOMAIN}`, `@${MAIL_DOMAIN_ALIAS}`))
    else if (userEmail.endsWith(`@${MAIL_DOMAIN_ALIAS}`)) variants.push(userEmail.replace(`@${MAIL_DOMAIN_ALIAS}`, `@${MAIL_DOMAIN}`))

    const isNewIncoming =
      variants.includes(mail.receiverEmail?.toLowerCase()) &&
      ["inbox", "request", "spam"].includes(mail.status) &&
      !processedIds.has(mail.id) &&
      mail.spamScore === undefined;

    // 🚀 Proactive Content Sync (IPFS)
    if (mail.cid && !mail.message && !processedIds.has(`fetch_ipfs_${mail.id}`)) {
      processedIds.add(`fetch_ipfs_${mail.id}`)
      const fetchContent = async (attempt = 1) => {
        try {
          const { fetchFromIPFS } = await import("@/utils/ipfs")
          const ipfsData = await fetchFromIPFS(mail.cid)
          updateMailInStore(mail.id, { ...ipfsData, fromCache: false })
        } catch (e) {
          if (attempt < 3) {
            setTimeout(() => fetchContent(attempt + 1), attempt * 10000)
          } else {
            // All IPFS retries failed — ensure the mail is at least stored with its index data
            // so it shows up in the inbox/requests. User can retry opening it manually.
            if (!allMailsMap.has(mail.id)) {
              allMailsMap.set(mail.id, { ...mail, fromCache: false })
              notify()
            }
          }
        }
      }
      fetchContent()
    }

    if (isNewIncoming) {
      processedIds.add(mail.id)
      let decision: any = { status: "inbox", flaggedReason: "", spamScore: 0 }
      try {
        decision = await filterIncomingMail(mail, userEmail)
        
        updateMailInStore(mail.id, { 
          ...mail, 
          status: decision.status || "inbox", 
          flaggedReason: decision.flaggedReason, 
          spamScore: decision.spamScore, 
          fromCache: false 
        })
      } catch (err) {
        console.warn("Spam filter failed", err)
      }
      
      if (decision?.status !== "inbox") return
    }

    // 🛡️ [Message Protection] Don't overwrite a decrypted message with its encrypted form
    let finalMessage = mail.message !== undefined ? mail.message : existing?.message
    if (existing?.isDecrypted && mail.message?.includes("-----BEGIN PGP MESSAGE-----")) {
      finalMessage = existing.message
    }

    const updated = {
      ...(existing || {}),
      ...mail,
      message: finalMessage,
      fromCache: false,
      status: mail.status ?? (existing?.status || "inbox"),
      senderStatus: existing?.senderStatus === "deleted" ? "deleted" : (variants.includes(mail.senderEmail?.toLowerCase()) ? "sent" : (existing?.senderStatus)),
      isDecrypted: existing?.isDecrypted || mail.isDecrypted || false,
    }

    allMailsMap.set(mail.id, updated)
    await cacheMail(updated)
    notify()
  })

  // 📡 [Nostr Backup Sync]
  // If GunDB is slow or unreachable, we poll Nostr for the same identity's messages.
  // Any mails found on Nostr that aren't in GunDB will be automatically imported.
  const { nostr } = await import("@/utils/nostr")
  nostr.onMail(async (mail: any) => {
    if (!mail || !mail.id || processedIds.has(mail.id)) return
    
    console.log("📡 [Nostr Sync] Found missing mail in Nostr relay. Importing...")
    processedIds.add(mail.id)
    
    const updated = {
      ...mail,
      fromCache: false,
      status: mail.status || "inbox",
      isDecrypted: true // Nostr DMs arrive decrypted via the nostr.onMail handler
    }

    allMailsMap.set(mail.id, updated)
    
    // Self-healing: Write the Nostr-found mail back into the GunDB index
    gun.get("securemail_mails").get(mail.id).put(updated)
    if (updated.senderEmail) gun.get(`user_mail_index:${updated.senderEmail}`).get(mail.id).put(updated)
    if (updated.receiverEmail) gun.get(`user_mail_index:${updated.receiverEmail}`).get(mail.id).put(updated)
    
    await cacheMail(updated)
    notify()
  })
}

const newestFirst = (a: any, b: any) => {
  const ta = a.time ? new Date(a.time).getTime() : 0
  const tb = b.time ? new Date(b.time).getTime() : 0
  return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta)
}

export const getMails = (status: string) => {
  // 🚀 Check cache first
  if (memoizedResults.has(status)) return memoizedResults.get(status)!

  const mails = getMailsArray()
  let result: any[] = []

  const cleanCurrent = currentEmail.trim().toLowerCase()
  const variants = [cleanCurrent]
  if (cleanCurrent.endsWith(`@${MAIL_DOMAIN}`)) variants.push(cleanCurrent.replace(`@${MAIL_DOMAIN}`, `@${MAIL_DOMAIN_ALIAS}`))
  else if (cleanCurrent.endsWith(`@${MAIL_DOMAIN_ALIAS}`)) variants.push(cleanCurrent.replace(`@${MAIL_DOMAIN_ALIAS}`, `@${MAIL_DOMAIN}`))
  if (cleanCurrent.includes("@")) {
    const userPrefix = cleanCurrent.split("@")[0]
    variants.push(`${userPrefix}@dmail.com`)
  }

  const isSender = (m: any) => m.senderEmail && variants.includes(m.senderEmail.toLowerCase())
  const isReceiver = (m: any) => m.receiverEmail && variants.includes(m.receiverEmail.toLowerCase())

  if (status === "starred") {
    result = mails.filter((m) => m.isStarred && m.status !== "trash" && m.status !== "purged" && m.senderStatus !== "deleted").sort(newestFirst)
  } else if (status === "sent") {
    // Exclude outbox (failed) messages from the Sent view
    // Force isRead: true — sender has always "read" their own sent mail
    result = mails.filter((m) =>
      isSender(m) &&
      m.status !== "draft" &&
      m.status !== "trash" &&
      m.status !== "purged" &&
      m.status !== "outbox" &&
      m.senderStatus !== "deleted"
    ).map((m) => ({ ...m, isRead: true })).sort(newestFirst)
  } else if (status === "queued") {
    result = mails.filter((m) => m.status === "queued").sort(newestFirst)
  } else if (status === "all") {
    result = mails.filter((m) => m.status !== "trash" && m.status !== "purged").sort(newestFirst)
  } else if (status === "request") {
    result = mails.filter((m) => m.status === "request" && isReceiver(m)).sort(newestFirst)
  } else if (status === "inbox") {
    result = mails.filter((m) => isReceiver(m) && m.status === "inbox").sort(newestFirst)
  } else if (status === "archive" || status === "archived") {
    result = mails.filter((m) => (m.status === "archive" || m.status === "archived") && m.senderStatus !== "deleted").sort(newestFirst)
  } else {
    result = mails.filter((m) => m.status === status).sort(newestFirst)
  }

  memoizedResults.set(status, result)
  return result
}


const normalizeSubject = (s: string) =>
  (s || "(No subject)").replace(/^((Re|Fwd):\s*)+/i, "").trim()

export interface Thread {
  id: string
  subject: string
  messages: any[]
  lastMessage: any
  count: number
  isRead: boolean
  isStarred: boolean
  isPinned: boolean
}

export const getThreads = (status: string | string[]): Thread[] => {
  const statuses = Array.isArray(status) ? status : [status]
  const mails = getMailsArray()
  let filtered: any[] = []

  if (statuses.includes("starred")) {
    filtered = mails.filter((m) => m.isStarred)
  } else if (statuses.includes("sent")) {
    filtered = mails.filter((m) => m.senderEmail === currentEmail && m.status !== "draft" && m.status !== "trash" && m.status !== "purged" && m.senderStatus !== "deleted")
    if (statuses.includes("queued")) {
      filtered = [...filtered, ...mails.filter(m => m.status === "queued")]
      filtered = Array.from(new Map(filtered.map(m => [m.id, m])).values())
    }
  } else {
    filtered = mails.filter((m) => {
      const s = m.status || "inbox"
      if (statuses.includes("inbox")) {
        return m.receiverEmail === currentEmail && statuses.includes(s)
      }
      return statuses.includes(s)
    })
  }

  const threadMap = new Map<string, any[]>()
  filtered.forEach((m) => {
    const norm = normalizeSubject(m.subject)
    if (!threadMap.has(norm)) threadMap.set(norm, [])
    threadMap.get(norm)!.push(m)
  })

  return Array.from(threadMap.values())
    .map((msgs) => {
      const sorted = msgs.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      const latest = sorted[sorted.length - 1]
      return {
        id: latest.id,
        subject: normalizeSubject(latest.subject),
        messages: sorted,
        lastMessage: latest,
        count: sorted.length,
        isRead: sorted.every((m) => m.senderEmail === currentEmail || m.isRead),
        isStarred: sorted.some((m) => m.isStarred),
        isPinned: sorted.some((m) => m.isPinned),
      }
    })
    .sort((a, b) => new Date(b.lastMessage.time).getTime() - new Date(a.lastMessage.time).getTime())
}

export const getAllRaw = () => getMailsArray()

export const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export const updateMailInStore = (id: string, updates: any) => {
  const existing = allMailsMap.get(id)
  const updated = { ...(existing || {}), ...updates, id }
  allMailsMap.set(id, updated)
  
  cacheMail(updated)
  gun.get("securemail_mails").get(id).put(updates)
  if (updated.senderEmail) gun.get(`user_mail_index:${updated.senderEmail}`).get(id).put(updates)
  if (updated.receiverEmail) gun.get(`user_mail_index:${updated.receiverEmail}`).get(id).put(updates)
  
  notify()
}

export const updateLocalMailInStore = (id: string, updates: any) => {
  const existing = allMailsMap.get(id)
  const updated = { ...(existing || {}), ...updates, id }
  allMailsMap.set(id, updated)
  
  cacheMail(updated)
  notify()
}

export const removeMailFromStore = (id: string) => {
  if (allMailsMap.delete(id)) notify()
}

export const pinMailInStore = (id: string, isPinned: boolean) => {
  updateMailInStore(id, { isPinned })
}

export const getCounts = (email: string) => {
  let counts = {
    inbox: 0,
    inboxUnread: 0,
    totalInbox: 0,
    starred: 0,
    spam: 0,
    drafts: 0,
    request: 0,
    sent: 0,
    outbox: 0,
    trash: 0,
    allUnread: 0
  }
  if (!email) return counts
  const lowerEmail = email.trim().toLowerCase()
  const variants = [lowerEmail]
  if (lowerEmail.endsWith(`@${MAIL_DOMAIN}`)) variants.push(lowerEmail.replace(`@${MAIL_DOMAIN}`, `@${MAIL_DOMAIN_ALIAS}`))
  else if (lowerEmail.endsWith(`@${MAIL_DOMAIN_ALIAS}`)) variants.push(lowerEmail.replace(`@${MAIL_DOMAIN_ALIAS}`, `@${MAIL_DOMAIN}`))
  if (lowerEmail.includes("@")) {
    const userPrefix = lowerEmail.split("@")[0]
    variants.push(`${userPrefix}@dmail.com`)
  }

  // Single pass over the Map values
  allMailsMap.forEach(m => {
    const receiver = m.receiverEmail?.trim().toLowerCase()
    const sender = m.senderEmail?.trim().toLowerCase()

    const isRecv = receiver && variants.includes(receiver)
    const isSend = sender && variants.includes(sender)
    const status = m.status || "inbox"

    // 🛡️ [Global Starred Count]
    if (m.isStarred && status !== "trash" && status !== "purged" && m.senderStatus !== "deleted") {
      counts.starred++
    }

    if (isRecv) {
      if (status === "inbox") {
        counts.totalInbox++
        if (!m.isRead) counts.inboxUnread++
      }
      if (status === "request") counts.request++
      if (status === "spam") counts.spam++
      if (status === "trash") counts.trash++

      if (status !== "spam" && status !== "trash" && status !== "purged" && !m.isRead) {
        counts.allUnread++
      }
    }

    if (isSend) {
      if (status !== "draft" && status !== "purged" && status !== "trash" && status !== "outbox") counts.sent++;
      if (status === "draft") counts.drafts++;
      if (status === "outbox") counts.outbox++;
    }
  })

  counts.inbox = counts.inboxUnread
  return counts
}


export const clearStore = () => {
  allMailsMap.clear()
  memoizedMailsArray = null
  currentEmail = ""
  isListening = false
  processedIds.clear()
  listeners.clear()
}
