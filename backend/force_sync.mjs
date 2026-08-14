/**
 * Force-injects all plus-address emails from the relay inbox into GunDB.
 * Bypasses the "exists" check so emails that were missed get re-indexed.
 * Run with: node force_sync.mjs
 */
import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import CryptoJS from "crypto-js"
import Gun from "gun"

const MAIL_DOMAIN = "etherxinnovations.in"
const RELAY_EMAIL = "etherxinnovdmail@gmail.com"
const IMAP_PASS = "hhnxsxkjpretvpzn"

// Connect to local GunDB relay
const gun = Gun({ peers: ["http://localhost:8765/gun"], file: false })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const client = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: { user: RELAY_EMAIL, pass: IMAP_PASS },
  logger: false
})

try {
  console.log("🔌 Connecting to Gmail IMAP...")
  await client.connect()
  console.log("✅ Connected!\n")
  
  const lock = await client.getMailboxLock("INBOX")
  const list = await client.search({ all: true })
  console.log(`📬 Total messages: ${list.length}`)
  
  let injected = 0
  let skipped = 0

  for (const uid of list) {
    const msg = await client.fetchOne(uid, { source: true })
    if (!msg?.source) continue
    
    const parsed = await simpleParser(msg.source)
    const messageId = parsed.messageId
    if (!messageId) continue
    
    const rawTo = parsed.to?.value?.[0]?.address?.toLowerCase() || RELAY_EMAIL
    
    // Only process plus-addressed mails or direct domain mails
    let recipientEmail = rawTo
    if (rawTo.includes("+")) {
      const plusMatch = rawTo.match(/\+([^@]+)@/)
      if (plusMatch && plusMatch[1]) {
        recipientEmail = `${plusMatch[1]}@${MAIL_DOMAIN}`
      } else {
        skipped++
        continue
      }
    } else if (!rawTo.endsWith(`@${MAIL_DOMAIN}`)) {
      // Plain relay email with no routing — skip
      skipped++
      continue
    }
    
    const mailId = "smtp_" + CryptoJS.SHA256(messageId).toString()
    const senderEmail = parsed.from?.value?.[0]?.address || "unknown@email.com"
    const senderName = parsed.from?.value?.[0]?.name || senderEmail.split("@")[0]
    
    const mailObj = {
      id: mailId,
      threadId: mailId,
      messageId: messageId,
      senderEmail: senderEmail,
      senderName: senderName,
      receiverEmail: recipientEmail,
      subject: parsed.subject || "(No Subject)",
      message: parsed.text || "",
      html: parsed.html || parsed.textAsHtml || "",
      time: (parsed.date || new Date()).toISOString(),
      status: "inbox",
      source: "smtp",
      hasAttachments: false,
      attachmentCount: 0,
      attachments: "",
      isRead: false,
      isStarred: false,
      isPinned: false
    }
    
    console.log(`📩 Injecting: ${senderEmail} → ${recipientEmail} | "${parsed.subject}"`)
    
    gun.get("securemail_mails").get(mailId).put(mailObj)
    gun.get(`user_mail_index:${recipientEmail}`).get(mailId).put(mailObj)
    gun.get(`user_mail_index:${RELAY_EMAIL}`).get(mailId).put(mailObj)
    
    injected++
    await sleep(200) // small delay between writes
  }
  
  lock.release()
  await client.logout()
  
  console.log(`\n✅ Done! Injected: ${injected} | Skipped (no routing): ${skipped}`)
  console.log("⏳ Waiting 3s for GunDB writes to flush...")
  await sleep(3000)
  process.exit(0)
  
} catch(e) {
  console.error("❌ Error:", e.message)
  process.exit(1)
}
