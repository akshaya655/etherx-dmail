"use client"

import { useEffect, useState, useMemo, useRef, memo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { decryptMessage, encryptMessage, db, cleanMessage, decryptVaultKey, derivePGPPassphrase, validatePGPHeader, getOpenPGP } from "@/utils/gun"
import { Star, MoreVertical, Archive, Trash2, Mail, Send, Reply, Forward, Shield, Lock, Bell, Settings, Search, ArrowLeft, Paperclip, Tag, Check, Eye, EyeOff, RefreshCw, Download, Inbox } from "lucide-react"
import { subscribe, updateMailInStore, getMails, initMailStore, getAllRaw } from "@/utils/mailStore"
import { getLabels, getMailLabels, toggleMailLabel, subscribeLabelStore, type Label } from "@/utils/labelStore"
import { useLabel } from "@/context/LabelContext"
import MailSkeleton from "@/components/MailSkeleton"
import MailRow from "@/components/MailRow"
import EmailBodyViewer from "@/components/EmailBodyViewer"
import SearchFiltersPanel, { SearchFilters, emptyFilters, hasActiveFilters } from "@/components/SearchFiltersPanel"

type Tab = "All" | "Unread" | "Starred"

function InboxPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get("search") || ""
  const { activeLabelId, setActiveLabelId } = useLabel()
  
  const [loading, setLoading] = useState(true)
  const [mails, setMails] = useState<any[]>([])
  const [selectedMail, setSelectedMail] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<Tab>("All")
  const [userEmail, setUserEmail] = useState("")
  const [vaultPassword, setVaultPassword] = useState("")
  const [decrypting, setDecrypting] = useState(false)
  const [decryptError, setDecryptError] = useState("")
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null)
  const [replyMode, setReplyMode] = useState<"reply" | "forward" | null>(null)
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [forwardRecipient, setForwardRecipient] = useState("")
  const [replyAttachments, setReplyAttachments] = useState<any[]>([])
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState(urlSearch)
  const [filters, setFilters] = useState<SearchFilters>({ ...emptyFilters(), query: urlSearch })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inboxLayout, setInboxLayout] = useState("comfortable")
  const [emailPreview, setEmailPreview] = useState("2lines")
  const [userLabels, setUserLabels] = useState<Label[]>([])
  const [showLabelMenu, setShowLabelMenu] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState("")
  const [showUnlockPass, setShowUnlockPass] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState("")
  const [sessionPassword, setSessionPassword] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.query), 300)
    return () => clearTimeout(timer)
  }, [filters.query])

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  const filteredMails = useMemo(() => {
    return mails
      .filter(m => {
        if (activeTab === "Unread" && m.isRead) return false
        if (activeTab === "Starred" && !m.isStarred) return false
        if (activeLabelId && !getMailLabels(userEmail, m.id).includes(activeLabelId)) return false

        // Advanced filter: starred only
        if (filters.starredOnly && !m.isStarred) return false

        // Advanced filter: has attachment
        if (filters.hasAttachment && !m.cid && !m.attachments?.length) return false

        // Advanced filter: from sender
        if (filters.from) {
          const q = filters.from.toLowerCase()
          if (!m.senderEmail?.toLowerCase().includes(q) && !m.senderName?.toLowerCase().includes(q)) return false
        }

        // Advanced filter: to recipient
        if (filters.to) {
          const q = filters.to.toLowerCase()
          if (!m.receiverEmail?.toLowerCase().includes(q)) return false
        }

        // Advanced filter: subject
        if (filters.subject) {
          const q = filters.subject.toLowerCase()
          if (!m.subject?.toLowerCase().includes(q)) return false
        }

        // Advanced filter: date after
        if (filters.dateAfter) {
          const after = new Date(filters.dateAfter).getTime()
          const mailTime = m.time ? new Date(m.time).getTime() : 0
          if (mailTime < after) return false
        }

        // Advanced filter: date before
        if (filters.dateBefore) {
          const before = new Date(filters.dateBefore).getTime() + 86400000
          const mailTime = m.time ? new Date(m.time).getTime() : 0
          if (mailTime > before) return false
        }

        // Basic keyword search
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase()
          return (
            m.subject?.toLowerCase().includes(q) ||
            m.senderEmail?.toLowerCase().includes(q) ||
            m.message?.toLowerCase().includes(q) ||
            m.id?.toLowerCase().includes(q) ||
            m.time?.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        const getTime = (m: any) => m.time ? new Date(m.time).getTime() : 0
        return getTime(b) - getTime(a)
      })
  }, [mails, activeTab, debouncedSearch, activeLabelId, userEmail, filters])

  const handleToggleSelectAll = () => {
    if (selectedIds.size > 0 && selectedIds.size === filteredMails.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredMails.map(m => m.id)))
    }
  }

  const isAllSelected = filteredMails.length > 0 && selectedIds.size === filteredMails.length

  const handleBulkTrash = () => {
    selectedIds.forEach(id => {
      updateMailInStore(id, { status: "trash" })
    })
    setSelectedIds(new Set())
    setSelectedMail(null)
  }

  useEffect(() => {
    if (urlSearch) setSearchQuery(urlSearch)
  }, [urlSearch])

  useEffect(() => {
    if (typeof window === "undefined") return
    let user: any = {}
    try {
      const rawUser = localStorage.getItem("user")
      if (rawUser) {
        user = JSON.parse(rawUser)
      }
    } catch (e) {
      console.warn("Corrupted user localStorage in inbox, resetting...")
      if (typeof window !== "undefined") {
        localStorage.removeItem("user")
      }
    }
    if (user.email) setUserEmail(user.email)

    // 🛡️ Require explicit passphrase entry for vault security.
    // Only restore unlock state if owner entered password in this active browser session.
    const activeSessionPass = typeof window !== "undefined" ? sessionStorage.getItem("vault_pass") : null
    const activeSessionUnlocked = typeof window !== "undefined" ? sessionStorage.getItem("inbox_unlocked") === "true" : false
    if (!isUnlocked && activeSessionUnlocked && activeSessionPass) {
       console.log("🔒 [Vault] Restoring active session unlock...")
       handleUnlock(activeSessionPass)
    }

    // Load layout settings
    setInboxLayout(localStorage.getItem("settings_inboxLayout") || "comfortable")
    setEmailPreview(localStorage.getItem("settings_emailPreview") || "2lines")

    if (!isUnlocked) return;

    // 📥 [Sync Initialization]
    // Now that the inbox is unlocked, we start listening to the decentralized mesh.
    initMailStore(user.email)

    const updateMails = () => {
      setMails(getMails("inbox"))
      setLoading(false)
      setUserLabels(getLabels(user.email))
    }
    
    // Slight delay to allow layout to settle and prevent shift
    const timer = setTimeout(updateMails, 50)
    const unsub = subscribe(updateMails)
    const unsubLabels = subscribeLabelStore(updateMails)
    
    db.startScheduledMailWorker(user.email)
    
    return () => {
      unsub()
      unsubLabels()
      clearTimeout(timer)
    }
  }, [isUnlocked])

  const handleUnlock = async (overridePass?: string) => {
    const pass = overridePass || unlockPassword
    if (!pass || !pass.trim()) {
      setUnlockError("Incorrect password. Please enter your account password.")
      return
    }
    setUnlocking(true)
    setUnlockError("")
    
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      
      // 🛡️ Authenticate entered password against user credentials
      if (user.password && pass !== user.password) {
        setUnlockError("Incorrect password. Please enter your account password.")
        setUnlocking(false)
        return
      }

      const { signData } = await import("@/utils/gun")
      
      // 1. [Standard Path] Attempt to unlock using the cached/synced private key
      try {
        if (!user.privateKey) throw new Error("No private key found")
        await signData("unlock_inbox", user.privateKey, pass)
        setSessionPassword(pass)
        if (typeof window !== "undefined") {
          sessionStorage.setItem("inbox_unlocked", "true")
          sessionStorage.setItem("vault_pass", pass)
        }
        setIsUnlocked(true)
        console.log("🔓 [Vault] Inbox unlocked successfully via authenticated credentials.")
      } catch (e: any) {
        console.warn("⚠️ [Vault] Primary unlock failed.", e.message || e)
        
        // 2. [Sovereign Path] Deterministic Recovery ONLY for verified password
        if (user.password && pass === user.password) {
          try {
            const { generateSovereignIdentity } = await import("@/utils/identity")
            const identity = await generateSovereignIdentity(user.email, pass)
            
            await signData("unlock_inbox", identity.privateKey, pass)
            
            console.log("✅ [Vault] Sovereign Recovery successful. Repairing local identity...")
            const updatedUser = { 
              ...user, 
              privateKey: identity.privateKey, 
              publicKey: identity.publicKey,
              did: identity.did,
              fastPublicKey: identity.fastPublicKey,
              fastPrivateKey: identity.fastPrivateKey
            }
            localStorage.setItem("user", JSON.stringify(updatedUser))
            
            const { db } = await import("@/utils/gun")
            db.registerUser(updatedUser)
            
            setSessionPassword(pass)
            if (typeof window !== "undefined") {
              sessionStorage.setItem("inbox_unlocked", "true")
              sessionStorage.setItem("vault_pass", pass)
            }
            setIsUnlocked(true)
          } catch (recoveryErr: any) {
            console.error("❌ [Vault] Sovereign Recovery failed:", recoveryErr.message || recoveryErr)
            if (!overridePass) setUnlockError("Incorrect password. Please enter your account password.")
          }
        } else {
          if (!overridePass) setUnlockError("Incorrect password. Please enter your account password.")
        }
      }
    } catch (err) {
      setUnlockError("Incorrect password. Please enter your account password.")
    } finally {
      setUnlocking(false)
    }
  }

  const currentSelectedMail = useMemo(() => {
    if (!selectedMail) return null
    return mails.find(m => m.id === selectedMail.id) || selectedMail
  }, [mails, selectedMail])

  const openMail = (mail: any) => {
    setSelectedMail(mail)
    setDecryptedContent(null)
    setDecryptError("")
    setVaultPassword("")
    setReplyMode(null)
    if (!mail.isRead) {
      updateMailInStore(mail.id, { isRead: true })
    }

    // Auto-decrypt using active session password
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    const passToUse = sessionPassword || (typeof window !== "undefined" ? sessionStorage.getItem("vault_pass") || "" : "")
    if (passToUse) {
      handleDecrypt(mail, passToUse)
    }
  }

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const mail = mails.find(m => m.id === id)
    if (mail) {
      updateMailInStore(id, { isStarred: !mail.isStarred })
    }
  }

  const handleDecrypt = async (mailToDecrypt = currentSelectedMail, pass = vaultPassword) => {
    if (!pass || !mailToDecrypt) return
    setDecrypting(true)
    setDecryptError("")
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      const message = mailToDecrypt.message

      if (!message?.includes("-----BEGIN PGP MESSAGE-----")) {
        // Not PGP encrypted — just verify the passphrase can unlock the private key
        const { signData } = await import("@/utils/gun")
        await signData("unlock", user.privateKey, pass)
        setDecryptedContent(message)
        setVaultPassword("")
        return
      }

      // Try decryption with multiple passphrase candidates and key sources
      const openpgp = await getOpenPGP()
      const passphrases = [pass]
      if (user.password && user.password !== pass) passphrases.push(user.password)

      // Collect all available private keys (current user + saved accounts)
      const privateKeys: string[] = []
      if (user.privateKey) privateKeys.push(user.privateKey)
      
      try {
        const savedAccounts = JSON.parse(localStorage.getItem("securemail_accounts") || "[]")
        for (const acct of savedAccounts) {
          if (acct.privateKey && acct.email?.toLowerCase() === user.email?.toLowerCase() && !privateKeys.includes(acct.privateKey)) {
            privateKeys.push(acct.privateKey)
          }
        }
      } catch {}

      let lastError: any = null
      for (const privKeyArmored of privateKeys) {
        for (const passphrase of passphrases) {
          try {
            const decryptedArmored = decryptVaultKey(privKeyArmored, passphrase);
            if (!validatePGPHeader(decryptedArmored)) continue;

            // Try both derived and raw passphrase for PGP unlock
            const pgpPassCandidates = [derivePGPPassphrase(passphrase), passphrase]
            let privKey: any = null
            let lastDecryptKeyError: any = null
            for (const pgpPass of pgpPassCandidates) {
              try {
                privKey = await openpgp.decryptKey({
                  privateKey: await openpgp.readPrivateKey({ armoredKey: decryptedArmored }),
                  passphrase: pgpPass,
                })
                break
              } catch (err) {
                lastDecryptKeyError = err
              }
            }
            if (!privKey) throw lastDecryptKeyError || new Error("Could not decrypt PGP key");

            const pgpMessage = await openpgp.readMessage({ armoredMessage: message })
            const { data } = await openpgp.decrypt({ message: pgpMessage, decryptionKeys: privKey })
            setDecryptedContent(data as string)
            setVaultPassword("")
            // If we succeeded with a different key than the active one, repair localStorage
            if (privKeyArmored !== user.privateKey) {
              console.log("🛠️ [Inbox] Syncing healthy key to local storage.")
              user.privateKey = privKeyArmored
              localStorage.setItem("user", JSON.stringify(user))
            }
            return
          } catch (e) {
            lastError = e
          }
        }
      }

      // ─── FINAL FALLBACK: Deterministic Recovery ───
      // If everything failed, try to regenerate the identity from the passphrase.
      // This is the ultimate "Sovereign Identity" fallback for cross-device recovery.
      try {
        console.log("🧬 [Inbox] All cached keys failed. Attempting deterministic identity recovery...")
        const { generateSovereignIdentity } = await import("@/utils/identity")
        const identity = await generateSovereignIdentity(user.email, pass)
        
        const decryptedArmored = decryptVaultKey(identity.privateKey, pass);
        if (!validatePGPHeader(decryptedArmored)) throw new Error("Invalid PGP Header generated during recovery");

        // Try both derived and raw passphrase for PGP unlock
        const pgpPassCandidates = [derivePGPPassphrase(pass), pass]
        let privKey: any = null
        let lastDecryptKeyError: any = null
        for (const pgpPass of pgpPassCandidates) {
          try {
            privKey = await openpgp.decryptKey({
              privateKey: await openpgp.readPrivateKey({ armoredKey: decryptedArmored }),
              passphrase: pgpPass,
            })
            break
          } catch (err) {
            lastDecryptKeyError = err
          }
        }
        if (!privKey) throw lastDecryptKeyError || new Error("Could not decrypt PGP key");

        const pgpMessage = await openpgp.readMessage({ armoredMessage: message })
        const { data } = await openpgp.decrypt({ message: pgpMessage, decryptionKeys: privKey })
        
        setDecryptedContent(data as string)
        setVaultPassword("")
        
        // 🛠️ [Identity Repair] The deterministic recovery worked! Save this healthy key.
        console.log("✅ [Inbox] Recovery successful! Repairing identity mesh...")
        const updatedUser = { ...user, privateKey: identity.privateKey, publicKey: identity.publicKey }
        localStorage.setItem("user", JSON.stringify(updatedUser))
        const { db } = await import("@/utils/gun")
        db.registerUser(updatedUser) // Re-announce healthy key to mesh
        
        return
      } catch (recoveryErr) {
        console.error("❌ [Inbox] Deterministic recovery failed:", recoveryErr)
      }

      throw lastError || new Error("Decryption failed")
    } catch (err) {
      console.error("Decryption error:", err)
      setDecryptError("Incorrect Vault Passphrase")
    } finally {
      setDecrypting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingAttachment(true)
    try {
      const { uploadFileToIPFS } = await import("@/utils/ipfs")
      const newAttachments = [...replyAttachments]
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const cid = await uploadFileToIPFS(file, file.name)
        newAttachments.push({ name: file.name, size: file.size, type: file.type, cid })
      }
      setReplyAttachments(newAttachments)
    } catch (err) {
      console.error("File upload failed:", err)
    } finally {
      setUploadingAttachment(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSendReply = async () => {
    if (!currentSelectedMail) return
    const recipient = replyMode === "reply" ? currentSelectedMail.senderEmail : forwardRecipient
    if (!recipient) return
    // Reply requires message text; forward can optionally have no message
    if (replyMode === "reply" && !replyText) return
    setSendingReply(true)
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      const { sendMailInBackground } = await import("@/utils/backgroundSend")
      
      // For forwarding, include the original message body
      let messageBody = replyText
      if (replyMode === "forward") {
        const originalContent = decryptedContent || currentSelectedMail.message || ""
        const fwdHeader = `\n\n---------- Forwarded message ----------\nFrom: ${currentSelectedMail.senderName || currentSelectedMail.senderEmail}\nDate: ${currentSelectedMail.time}\nSubject: ${currentSelectedMail.subject}\nTo: ${currentSelectedMail.receiverEmail}\n\n`
        messageBody = (replyText ? replyText + "\n" : "") + fwdHeader + originalContent
      }

      sendMailInBackground({
        user,
        recipientEmail: recipient,
        subject: `${replyMode === "reply" ? "Re:" : "Fwd:"} ${currentSelectedMail.subject}`,
        message: messageBody,
        attachments: replyAttachments,
        threadId: currentSelectedMail.threadId || currentSelectedMail.id,
        parentMessageId: currentSelectedMail.messageId || currentSelectedMail.id
      })

      setReplyMode(null)
      setReplyText("")
      setForwardRecipient("")
      setReplyAttachments([])
    } catch (err) {
      console.error("Reply failed:", err)
    } finally {
      setSendingReply(false)
    }
  }

  const renderDetailView = () => {
    const mail = currentSelectedMail
    if (!mail) return null
    const isEncrypted = mail.message?.includes("-----BEGIN PGP MESSAGE-----")

    // The user requested to only see the single selected email rather than a thread of emails.
    const threadMails = [mail];

    // Parse attachments if stored as JSON string
    let parsedAttachments: any[] = []
    if (mail.attachments) {
      if (typeof mail.attachments === "string") {
        try { parsedAttachments = JSON.parse(mail.attachments) } catch (e) {}
      } else if (Array.isArray(mail.attachments)) {
        parsedAttachments = mail.attachments
      }
    }

    return (
        <div className="mail-detail-pane" style={{ flex: 1, display: "flex", flexDirection: "column", background: "linear-gradient(90deg, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.06) 60%, rgba(212,175,55,0.02) 100%)", padding: "32px 40px 40px", borderLeft: "1px solid #141414", position: "relative", overflowY: "auto" }}>
        {/* Header Navigation */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "28px" }}>
          <button
            onClick={() => { setSelectedMail(null); setReplyMode(null); }}
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid #222", borderRadius: "50%",
              width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--gold-mid)", flexShrink: 0, marginTop: "4px",
              transition: "background 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
          >
            <ArrowLeft size={17} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif", lineHeight: 1.3, letterSpacing: "-0.3px" }}>
              {mail.subject || "(No subject)"}
            </h1>
            {threadMails.length > 1 && (
              <span style={{ fontSize: "11px", color: "var(--gold-mid)", fontWeight: "700", marginTop: "4px", display: "inline-block" }}>
                {threadMails.length} messages in conversation
              </span>
            )}
          </div>
        </div>

        {/* Conversation Thread Messages */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "24px" }}>
          {threadMails.map((tMail, tIdx) => {
            const isCurrent = tMail.id === mail.id
            return (
              <div
                key={tMail.id || tIdx}
                onClick={() => setSelectedMail(tMail)}
                style={{
                  borderRadius: "14px",
                  background: isCurrent ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
                  border: isCurrent ? "1px solid var(--gold-mid)" : "1px solid #1a1a1a",
                  padding: "16px 20px", cursor: isCurrent ? "default" : "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                {/* Sender Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: isCurrent ? "16px" : "0" }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                    background: `linear-gradient(135deg, rgba(212,175,55,0.3) 0%, rgba(212,175,55,0.08) 100%)`,
                    border: "1px solid rgba(212,175,55,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", fontWeight: "800", color: "var(--gold-mid)"
                  }}>
                    {(tMail.senderName || tMail.senderEmail || "U").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-bright)" }}>
                        {tMail.senderName || tMail.senderEmail?.split("@")[0]}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                        {tMail.time && !isNaN(Date.parse(tMail.time))
                          ? new Date(tMail.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : tMail.time}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>{tMail.senderEmail}</span>
                  </div>
                </div>

                {/* Collapsed Snippet or Expanded Message */}
                {!isCurrent ? (
                  <div style={{ fontSize: "13px", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "4px" }}>
                    {tMail.message?.slice(0, 100)}...
                  </div>
                ) : (
                  <div>
                    {/* Security Badge */}
                    <div style={{
                      background: "rgba(212, 175, 55, 0.04)", border: "1px solid rgba(212, 175, 55, 0.12)",
                      borderRadius: "8px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px",
                      marginBottom: "16px"
                    }}>
                      <Lock size={12} color="var(--gold-mid)" />
                      <span style={{ fontSize: "10px", color: "rgba(212,175,55,0.6)", fontFamily: "monospace", flex: 1 }}>
                        {tMail.id?.slice(0, 20)}...
                      </span>
                      <span style={{ fontSize: "10px", color: "var(--gold-mid)", fontWeight: "700", textTransform: "uppercase" }}>
                        {decryptedContent ? "✓ Decrypted" : (isEncrypted ? "✓ Encrypted" : "✓ Verified")}
                      </span>
                    </div>

                    {/* Message Body */}
                    <EmailBodyViewer
                      content={decryptedContent || tMail.message}
                      html={tMail.html}
                      minHeight="150px"
                      style={{ margin: "8px 0" }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "32px", position: "relative", flexWrap: "wrap" }}>
          <button
            onClick={() => setReplyMode("reply")}
            style={{ background: "var(--gold-mid)", color: "#000", border: "none", borderRadius: "8px", padding: "9px 22px", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", boxShadow: "0 4px 15px rgba(212,175,55,0.25)", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(212,175,55,0.4)"; e.currentTarget.style.transform = "translateY(-1px)" }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 15px rgba(212,175,55,0.25)"; e.currentTarget.style.transform = "translateY(0)" }}
          ><Reply size={15} /> Reply</button>
          <button
            onClick={() => setReplyMode("forward")}
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-bright)", border: "1px solid #222", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          ><Forward size={15} /> Forward</button>
          
          {/* Label Menu */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowLabelMenu(!showLabelMenu)}
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-bright)", border: "1px solid #222", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <Tag size={15} /> Label
            </button>
            {showLabelMenu && (
              <div style={{
                position: "absolute", top: "100%", left: 0, marginTop: "12px",
                background: "var(--bg-card)", border: "1px solid #1F1F1F",
                borderRadius: "14px", padding: "10px", width: "240px", zIndex: 1000,
                boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(212, 175, 55, 0.15)",
                animation: "dropdownFadeIn 0.2s ease-out"
              }}>
                <style>{`
                  @keyframes dropdownFadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", padding: "8px 12px 12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: "8px" }}>Assign Label</div>
                <div style={{ maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                  {userLabels.map(lbl => {
                    const isTagged = getMailLabels(userEmail, mail.id).includes(lbl.id)
                    return (
                      <button
                        key={lbl.id}
                        onClick={() => { toggleMailLabel(userEmail, mail.id, lbl.id); setShowLabelMenu(false) }}
                        style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: isTagged ? "rgba(212, 175, 55, 0.12)" : "transparent", border: "none", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", transition: "all 0.2s ease", marginBottom: "2px" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = isTagged ? "rgba(212, 175, 55, 0.15)" : "rgba(255,255,255,0.03)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = isTagged ? "rgba(212, 175, 55, 0.12)" : "transparent"}
                      >
                        <div style={{ width: "14px", height: "14px", borderRadius: "4px", background: lbl.color, border: `1px solid ${lbl.color}60`, boxShadow: `0 0 10px ${lbl.color}30` }} />
                        <span style={{ fontSize: "13px", fontWeight: isTagged ? "600" : "500", color: isTagged ? "var(--gold-mid)" : "var(--text-bright)", flex: 1 }}>{lbl.name}</span>
                        {isTagged && <Check size={16} color="var(--gold-mid)" strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => updateMailInStore(mail.id, { isStarred: !mail.isStarred })}
            style={{ background: "rgba(255,255,255,0.05)", color: mail.isStarred ? "var(--gold-mid)" : "var(--text-bright)", border: `1px solid ${mail.isStarred ? "rgba(212,175,55,0.4)" : "#222"}`, borderRadius: "8px", padding: "9px 14px", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }}
          ><Star size={15} fill={mail.isStarred ? "var(--gold-mid)" : "none"} strokeWidth={mail.isStarred ? 0 : 1.8} /></button>
          <button
            onClick={() => { updateMailInStore(mail.id, { status: "trash" }); setSelectedMail(null); }}
            style={{ background: "rgba(232,66,52,0.06)", color: "#e84234", border: "1px solid rgba(232,66,52,0.2)", borderRadius: "8px", padding: "9px 14px", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(232,66,52,0.12)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(232,66,52,0.06)"}
          ><Trash2 size={15} /></button>
        </div>

        {/* Main Content Area (attachments + reply) */}
        <div style={{ display: "flex", flexDirection: "column" }}>

          {/* Received Attachments Section */}
          {parsedAttachments.length > 0 && (
            <div style={{
              marginBottom: "32px", padding: "16px", borderRadius: "12px",
              background: "rgba(255,255,255,0.02)", border: "1px solid #1F1F1F"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", fontSize: "12px", fontWeight: "700", color: "var(--gold-mid)" }}>
                <Paperclip size={16} /> Attachments ({parsedAttachments.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                {parsedAttachments.map((att: any, idx: number) => {
                  const fileName = att.name || att.filename || `Attachment ${idx + 1}`
                  const fileSize = att.size ? `${(att.size / 1024).toFixed(1)} KB` : ""
                  const downloadUrl = att.data || (att.cid ? `https://ipfs.io/ipfs/${att.cid}` : null)

                  return (
                    <div key={idx} style={{
                      padding: "10px 14px", borderRadius: "8px", background: "var(--bg-card)",
                      border: "1px solid #222", display: "flex", alignItems: "center", gap: "12px", minWidth: "200px"
                    }}>
                      <Paperclip size={18} color="var(--gold-mid)" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fileName}
                        </div>
                        {fileSize && <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{fileSize}</div>}
                      </div>
                      {downloadUrl && (
                        <button
                          title={`Download ${fileName}`}
                          onClick={async () => {
                            try {
                              if (downloadUrl.startsWith("data:")) {
                                // Decode data URL → Blob → Object URL → programmatic click
                                const [header, base64] = downloadUrl.split(",")
                                const mime = header.match(/:(.*?);/)?.[1] || "application/octet-stream"
                                const bytes = atob(base64)
                                const arr = new Uint8Array(bytes.length)
                                for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
                                const blob = new Blob([arr], { type: mime })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement("a")
                                a.href = url
                                a.download = fileName
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                setTimeout(() => URL.revokeObjectURL(url), 5000)
                              } else {
                                // IPFS or external URL — open in new tab
                                window.open(downloadUrl, "_blank", "noopener,noreferrer")
                              }
                            } catch (e) {
                              console.error("Download failed:", e)
                            }
                          }}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--gold-mid)", display: "flex", alignItems: "center",
                            padding: "4px", borderRadius: "4px"
                          }}
                        >
                          <Download size={16} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Reply Composition Box */}
          {replyMode && (
            <div style={{ marginTop: "auto", border: "1px solid #1F1F1F", borderRadius: "12px", background: "var(--bg-card)", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {replyMode === "forward" && (
                <input
                  type="email"
                  placeholder="Forward to (email address)..."
                  value={forwardRecipient}
                  onChange={(e) => setForwardRecipient(e.target.value)}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid #333",
                    color: "var(--text-bright)", borderRadius: "8px", padding: "10px 14px",
                    fontSize: "14px", outline: "none"
                  }}
                />
              )}
              <textarea 
                placeholder={replyMode === "reply" ? "Write your reply message..." : "Add a message to this forwarded email..."}
                value={replyText} 
                onChange={(e) => setReplyText(e.target.value)} 
                style={{ width: "100%", height: "120px", background: "transparent", border: "none", color: "var(--text-bright)", fontSize: "14px", outline: "none", resize: "none" }} 
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={() => fileInputRef.current?.click()} style={{ background: "none", border: "none", color: "var(--gold-mid)", cursor: "pointer" }}><Paperclip size={18} /></button>
                <button 
                  onClick={handleSendReply} 
                  disabled={sendingReply || (replyMode === "forward" ? !forwardRecipient : !replyText)} 
                  style={{ background: "var(--gold-mid)", color: "var(--bg-body)", border: "none", borderRadius: "8px", padding: "8px 24px", fontWeight: "700", cursor: "pointer", opacity: sendingReply ? 0.6 : 1 }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!isUnlocked) {
    return (
      <div style={{ 
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center", 
        background: "var(--bg-body)", padding: "20px", position: "relative", overflow: "hidden" 
      }}>
        {/* Animated Background Elements */}
        <div style={{ position: "absolute", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, var(--gold-mid) 0%, transparent 70%)", opacity: 0.05, top: "-100px", right: "-100px", filter: "blur(60px)", animation: "pulse 8s infinite alternate" }} />
        <div style={{ position: "absolute", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, var(--gold-mid) 0%, transparent 70%)", opacity: 0.03, bottom: "-50px", left: "-50px", filter: "blur(40px)", animation: "pulse 12s infinite alternate-reverse" }} />
        
        <style>{`
          @keyframes pulse { from { transform: scale(1); opacity: 0.03; } to { transform: scale(1.2); opacity: 0.07; } }
          @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `}</style>

        <div style={{ 
          width: "100%", maxWidth: "420px", background: "var(--bg-card)", borderRadius: "24px", 
          padding: "48px 40px", border: "1px solid #141414", 
          boxShadow: "0 20px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(212, 175, 55, 0.1)",
          textAlign: "center", animation: "slideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)",
          zIndex: 10
        }}>
          <div style={{ 
            width: "72px", height: "72px", borderRadius: "20px", background: "rgba(212, 175, 55, 0.1)", 
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px",
            border: "1px solid rgba(212, 175, 55, 0.2)", color: "var(--gold-mid)",
            boxShadow: "0 10px 30px rgba(212, 175, 55, 0.1)"
          }}>
            <Lock size={32} />
          </div>
          
          <h2 style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-bright)", marginBottom: "12px" }}>Inbox Encrypted</h2>
          <p style={{ fontSize: "15px", color: "var(--text-dim)", marginBottom: "40px", lineHeight: "1.6" }}>
            Your decentralized inbox is protected by your Sovereign Identity. Enter your vault passphrase to synchronize and decrypt.
          </p>

          {unlockError && (
            <div style={{ 
              padding: "12px", borderRadius: "12px", background: "rgba(232, 66, 52, 0.08)", 
              border: "1px solid rgba(232, 66, 52, 0.2)", color: "#e84234", fontSize: "13px", 
              fontWeight: "600", marginBottom: "24px", animation: "shake 0.4s ease" 
            }}>
              {unlockError}
            </div>
          )}

          <div style={{ position: "relative", marginBottom: "24px" }}>
            <input 
              type={showUnlockPass ? "text" : "password"} 
              placeholder="Vault Passphrase" 
              value={unlockPassword} 
              onChange={(e) => { setUnlockPassword(e.target.value); setUnlockError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              autoFocus
              style={{ 
                width: "100%", padding: "16px 50px 16px 20px", background: "rgba(0,0,0,0.2)", 
                border: "1px solid #1F1F1F", borderRadius: "14px", color: "var(--text-bright)", 
                fontSize: "15px", outline: "none", transition: "all 0.3s ease",
                textAlign: "center"
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--gold-mid)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#1F1F1F"}
            />
            <button
              onClick={() => setShowUnlockPass(!showUnlockPass)}
              style={{
                position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer"
              }}
            >
              {showUnlockPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button 
            onClick={() => handleUnlock()}
            disabled={unlocking || !unlockPassword}
            style={{ 
              width: "100%", padding: "16px", background: "var(--gold-mid)", 
              color: "var(--bg-body)", border: "none", borderRadius: "14px", 
              fontSize: "15px", fontWeight: "800", cursor: "pointer", 
              transition: "all 0.3s ease", display: "flex", alignItems: "center", 
              justifyContent: "center", gap: "12px",
              opacity: (unlocking || !unlockPassword) ? 0.6 : 1,
              boxShadow: "0 10px 30px rgba(212, 175, 55, 0.2)"
            }}
          >
            {unlocking ? (
              <span style={{ 
                width: "18px", height: "18px", border: "2px solid rgba(0,0,0,0.1)", 
                borderTopColor: "#000", borderRadius: "50%", animation: "spin 0.8s linear infinite" 
              }} />
            ) : <Shield size={18} />}
            {unlocking ? "Decrypting Mesh..." : "Unlock Vault"}
          </button>
          
          <p style={{ marginTop: "32px", fontSize: "12px", color: "var(--text-dim)" }}>
            Need help? Your passphrase is the same one you used during registration.
          </p>
        </div>
        
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes shake { 
            0%, 100% { transform: translateX(0); } 
            25% { transform: translateX(-5px); } 
            75% { transform: translateX(5px); } 
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg-body)", overflow: "hidden" }}>
      <div 
        className={`mail-list-pane ${currentSelectedMail ? "has-selected" : ""}`}
        style={{ 
          width: currentSelectedMail ? "360px" : "100%", display: "flex", flexDirection: "column", flexShrink: 0,
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)", maxWidth: currentSelectedMail ? "360px" : "100%", margin: currentSelectedMail ? "0" : "0 auto",
          willChange: "width"
        }}>
        <div style={{ padding: "24px 24px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Inbox size={24} color="var(--gold-mid)" />
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif" }}>
                  {activeLabelId ? (userLabels.find(l => l.id === activeLabelId)?.name || "Label") : "Inbox"}
                </h1>
                <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "2px 0 0 0" }}>Manage your incoming secure messages</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {activeLabelId && (
                <button 
                  onClick={() => {
                    setActiveLabelId(null)
                    router.push("/dashboard/inbox")
                  }}
                  style={{ 
                    background: "rgba(212, 175, 55, 0.1)", color: "var(--gold-mid)", border: "none", 
                    borderRadius: "4px", padding: "4px 8px", fontSize: "11px", fontWeight: "700", cursor: "pointer" 
                  }}
                >
                  Clear Filter
                </button>
              )}
              <button
                onClick={() => {
                  setLoading(true)
                  initMailStore(userEmail, true)
                  setTimeout(() => setLoading(false), 800)
                }}
                style={{
                  background: "none", border: "none", color: "var(--text-dim)",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  transition: "color 0.2s, transform 0.3s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--gold-mid)"
                  e.currentTarget.style.transform = "rotate(180deg)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-dim)"
                  e.currentTarget.style.transform = "rotate(0deg)"
                }}
                title="Refresh Inbox"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
          
          <SearchFiltersPanel
            filters={filters}
            onChange={setFilters}
            onClear={() => setFilters(emptyFilters())}
            placeholder="Search mail..."
          />

          <div style={{ display: "flex", gap: "4px", background: "var(--bg-card)", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
            {(["All", "Unread", "Starred"] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "6px 20px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", background: activeTab === tab ? "var(--gold-mid)" : "transparent", color: activeTab === tab ? "var(--bg-body)" : "var(--text-dim)", border: "none" }}>{tab}</button>
            ))}
          </div>
        </div>

        <div style={{ 
          display: "flex", alignItems: "center", gap: "16px",
          padding: "12px 24px", borderBottom: "1px solid #141414",
          background: selectedIds.size > 0 ? "rgba(212, 175, 55, 0.04)" : "rgba(255,255,255,0.02)",
          transition: "background 0.2s"
        }}>
          <button 
            onClick={handleToggleSelectAll}
            style={{ 
              display: "flex", alignItems: "center", gap: "10px", 
              background: "none", border: "none", color: isAllSelected ? "var(--gold-mid)" : "var(--text-dim)",
              fontSize: "13px", fontWeight: "600", cursor: "pointer", padding: "4px 8px",
              borderRadius: "6px", transition: "all 0.2s"
            }}
          >
            <div style={{ 
              width: "18px", height: "18px", borderRadius: "4px", 
              border: `2px solid ${isAllSelected ? "var(--gold-mid)" : "var(--text-dim)"}`,
              background: isAllSelected ? "var(--gold-mid)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {isAllSelected && <Check size={12} color="var(--bg-body)" strokeWidth={4} />}
            </div>
            <span>Select All</span>
          </button>

          {selectedIds.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
              <span style={{ fontSize: "12px", color: "var(--gold-mid)", fontWeight: "700", marginRight: "4px" }}>
                {selectedIds.size} selected
              </span>

              {/* Archive batch */}
              <button
                onClick={() => {
                  selectedIds.forEach(id => updateMailInStore(id, { status: "archive" }))
                  setSelectedIds(new Set())
                }}
                style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-bright)", border: "1px solid #222", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                title="Archive Selected"
              >
                <Archive size={14} /> Archive
              </button>

              {/* Mark Read/Unread batch */}
              <button
                onClick={() => {
                  const mailsToUpdate = mails.filter(m => selectedIds.has(m.id))
                  const allRead = mailsToUpdate.every(m => m.isRead)
                  selectedIds.forEach(id => updateMailInStore(id, { isRead: !allRead }))
                  setSelectedIds(new Set())
                }}
                style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-bright)", border: "1px solid #222", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                title="Toggle Read/Unread"
              >
                <Mail size={14} /> Read/Unread
              </button>

              {/* Delete batch */}
              <button
                onClick={handleBulkTrash}
                style={{ background: "rgba(232, 66, 52, 0.1)", color: "#e84234", border: "1px solid rgba(232, 66, 52, 0.2)", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                title="Delete Selected"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <MailSkeleton />
          ) : filteredMails.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-dim)" }}>No messages</div>
          ) : (
            (() => {
              const todayStr = new Date().toLocaleDateString()
              const yest = new Date()
              yest.setDate(yest.getDate() - 1)
              const yestStr = yest.toLocaleDateString()

              const groups: { [key: string]: any[] } = {
                "Today": [],
                "Yesterday": [],
                "Older": []
              }

              filteredMails.forEach(mail => {
                if (!mail.time || isNaN(Date.parse(mail.time))) {
                  groups["Older"].push(mail)
                } else {
                  const mDateStr = new Date(mail.time).toLocaleDateString()
                  if (mDateStr === todayStr) groups["Today"].push(mail)
                  else if (mDateStr === yestStr) groups["Yesterday"].push(mail)
                  else groups["Older"].push(mail)
                }
              })

              return Object.entries(groups)
                .filter(([_, groupMails]) => groupMails.length > 0)
                .map(([label, groupMails]) => (
                  <div key={label}>
                    <div style={{
                      padding: "8px 16px 6px",
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "var(--gold-mid)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      background: "rgba(255,255,255,0.015)",
                      borderBottom: "1px solid #141414",
                      userSelect: "none"
                    }}>
                      {label}
                    </div>
                    {groupMails.map(mail => (
                      <MailRow 
                        key={mail.id}
                        mail={mail}
                        isSelected={currentSelectedMail?.id === mail.id}
                        onOpen={openMail}
                        onToggleSelection={toggleSelection}
                        isSelectedInBulk={selectedIds.has(mail.id)}
                        onToggleStar={handleToggleStar}
                        layout={inboxLayout}
                        preview={emailPreview}
                        activeLabels={userLabels.filter(l => getMailLabels(userEmail, mail.id).includes(l.id))}
                      />
                    ))}
                  </div>
                ))
            })()
          )}
        </div>
      </div>

      {renderDetailView()}
    </div>
  )
}


export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageContent />
    </Suspense>
  );
}
