"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { db } from "@/utils/gun"
import { isStorageReady } from "@/utils/web3storage"
import { normalizeAndDedupeRecipients } from "@/utils/recipientUtils"
import { isInternalDmailAddress } from "@/utils/config"
import { getAllRaw } from "@/utils/mailStore"
import {
  PenLine, Save, Minus, Maximize2, Minimize2, X,
  Check, WifiOff, AlertCircle, Send, Calendar,
  Paperclip, Archive, Clock, ShieldCheck, AlertTriangle, Link, Lock,
  ChevronDown, ChevronUp,
  Type, Palette, UserCheck
} from "lucide-react"

type StatusType = "idle" | "sending" | "success" | "error"
type WindowState = "open" | "minimized" | "maximized"

interface AttachedFile {
  id: string
  name: string
  size: string
  type: "local" | "ipfs"
  cid?: string
  data?: string
  rawFile?: File
}

interface ComposeWindowProps {
  onClose: () => void
  defaultTo?: string
  defaultCc?: string
  defaultBcc?: string
  defaultSubject?: string
  defaultMessage?: string
  defaultDraftId?: string
}

let composeInstanceCount = 0

export default function ComposeWindow({
  onClose,
  defaultTo = "",
  defaultCc = "",
  defaultBcc = "",
  defaultSubject = "",
  defaultMessage = "",
  defaultDraftId,
}: ComposeWindowProps) {
  const instanceId = useRef(`cw_${++composeInstanceCount}`).current

  const [recipientEmail, setRecipientEmail] = useState<string>(() =>
    normalizeAndDedupeRecipients(defaultTo)
  )
  const [cc, setCc] = useState<string>(() =>
    normalizeAndDedupeRecipients(defaultCc)
  )
  const [bcc, setBcc] = useState<string>(() =>
    normalizeAndDedupeRecipients(defaultBcc)
  )

  const [isFocused, setIsFocused] = useState(false)
  const [activeField, setActiveField] = useState<"to" | "cc" | "bcc" | null>(null)
  const [contacts, setContacts] = useState<string[]>([])
  const [filteredContacts, setFilteredContacts] = useState<string[]>([])
  const [showCcBcc, setShowCcBcc] = useState(!!(defaultCc || defaultBcc))
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState(defaultMessage)
  const [status, setStatus] = useState<StatusType>("idle")
  const [statusMsg, setStatusMsg] = useState("")
  const [windowState, setWindowState] = useState<WindowState>("open")
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [ipfsCid, setIpfsCid] = useState("")
  const [showIpfsInput, setShowIpfsInput] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftLastSaved, setDraftLastSaved] = useState<string | null>(null)
  const [encryptionReady, setEncryptionReady] = useState<"checking" | "ready" | "no-key">("checking")
  const [storageReady, setStorageReady] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showFormatBar, setShowFormatBar] = useState(true)

  const editorRef = useRef<HTMLDivElement>(null)
  const currentDraftId = useRef<string | null>(defaultDraftId || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formatStates, setFormatStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertUnorderedList: false
  })

  const updateFormatStates = useCallback(() => {
    if (!editorRef.current) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer
    if (editorRef.current.contains(container) || editorRef.current === container) {
      setFormatStates({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList")
      })
    }
  }, [])

  useEffect(() => {
    document.addEventListener("selectionchange", updateFormatStates)
    return () => {
      document.removeEventListener("selectionchange", updateFormatStates)
    }
  }, [updateFormatStates])

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = defaultMessage || ""
    }
  }, [defaultMessage])

  // Extract unique contacts from past emails
  useEffect(() => {
    try {
      const rawMails = getAllRaw()
      const contactSet = new Set<string>()
      rawMails.forEach((m) => {
        if (m.senderEmail && m.senderEmail.includes("@")) contactSet.add(m.senderEmail.toLowerCase())
        if (m.receiverEmail && m.receiverEmail.includes("@")) contactSet.add(m.receiverEmail.toLowerCase())
      })
      setContacts(Array.from(contactSet))
    } catch (e) {
      console.warn("Could not load contact history:", e)
    }
  }, [])

  // Filter contacts based on current typing field
  const handleRecipientChange = (val: string, field: "to" | "cc" | "bcc") => {
    if (field === "to") setRecipientEmail(val)
    else if (field === "cc") setCc(val)
    else if (field === "bcc") setBcc(val)

    setActiveField(field)

    const query = val.split(",").pop()?.trim().toLowerCase() || ""
    if (query.length > 0) {
      const matches = contacts.filter((c) => c.toLowerCase().includes(query) && c.toLowerCase() !== val.toLowerCase())
      setFilteredContacts(matches.slice(0, 5))
    } else {
      setFilteredContacts([])
    }
  }

  const selectContact = (contact: string, field: "to" | "cc" | "bcc") => {
    if (field === "to") setRecipientEmail(contact)
    else if (field === "cc") setCc(contact)
    else if (field === "bcc") setBcc(contact)
    setFilteredContacts([])
    setActiveField(null)
  }

  // Encryption key check
  useEffect(() => {
    const normalizedRecipient = recipientEmail.trim().toLowerCase()
    if (!normalizedRecipient || !normalizedRecipient.includes("@")) {
      setEncryptionReady("checking")
      return
    }
    const isDmail = isInternalDmailAddress(normalizedRecipient)
    if (!isDmail) {
      setEncryptionReady("no-key")
      return
    }
    const timer = setTimeout(() => {
      db.getUser(normalizedRecipient, (data: any) => {
        setEncryptionReady(data?.publicKey ? "ready" : "no-key")
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [recipientEmail])

  useEffect(() => {
    isStorageReady().then(setStorageReady)
  }, [])

  // Auto-save draft
  useEffect(() => {
    if (!subject && !message && !recipientEmail && !cc && !bcc) return
    const timer = setInterval(() => saveDraft(true), 30000)
    return () => clearInterval(timer)
  }, [recipientEmail, cc, bcc, subject, message, attachments])

  const saveDraft = useCallback((auto = false) => {
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    if (!user.email) return

    const normalizedEmail = user.email.trim().toLowerCase()
    const stored = localStorage.getItem(`drafts_${normalizedEmail}`)
    let drafts: any[] = stored ? JSON.parse(stored) : []

    const cleanTo = normalizeAndDedupeRecipients(recipientEmail)
    const cleanCc = normalizeAndDedupeRecipients(cc)
    const cleanBcc = normalizeAndDedupeRecipients(bcc)
    const now = new Date()
    const savedAt = now.toLocaleString()

    const draft = {
      id: currentDraftId.current || `draft_${Date.now()}`,
      to: cleanTo,
      cc: cleanCc,
      bcc: cleanBcc,
      subject,
      message,
      savedAt,
      attachmentNames: attachments.map(a => ({ name: a.name, size: a.size, type: a.type, cid: a.cid })),
    }

    if (currentDraftId.current) {
      const idx = drafts.findIndex(d => d.id === currentDraftId.current)
      if (idx !== -1) {
        drafts[idx] = draft
      } else {
        drafts.unshift(draft)
      }
    } else {
      currentDraftId.current = draft.id
      drafts.unshift(draft)
    }

    localStorage.setItem(`drafts_${normalizedEmail}`, JSON.stringify(drafts.slice(0, 50)))
    setDraftLastSaved(savedAt)

    if (!auto) {
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 2500)
    }
  }, [recipientEmail, cc, bcc, subject, message, attachments])

  const deleteDraftOnSend = () => {
    if (!currentDraftId.current) return
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    if (!user.email) return
    const normalizedEmail = user.email.trim().toLowerCase()
    const stored = localStorage.getItem(`drafts_${normalizedEmail}`)
    if (!stored) return
    const drafts = JSON.parse(stored).filter((d: any) => d.id !== currentDraftId.current)
    localStorage.setItem(`drafts_${normalizedEmail}`, JSON.stringify(drafts))
  }

  // Save last known selection range in the editor
  const savedRangeRef = useRef<Range | null>(null)

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const restoreSelection = () => {
    const sel = window.getSelection()
    if (savedRangeRef.current && sel) {
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
    }
  }

  // Formatting tool action handler using execCommand
  const applyFormatting = (command: string, value: string = "") => {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(command, false, value)
    if (editorRef.current) {
      setMessage(editorRef.current.innerHTML)
    }
    updateFormatStates()
  }

  // File handling
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const newFile: AttachedFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: file.name,
          size: file.size < 1024 * 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          type: "local",
          data: reader.result as string,
          rawFile: file,
        }
        setAttachments((prev) => [...prev, newFile])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }

  const handleIpfsAttach = () => {
    const cid = ipfsCid.trim()
    if (!cid || (!cid.startsWith("Qm") && !cid.startsWith("bafy"))) return
    const newFile: AttachedFile = {
      id: `ipfs_${Date.now()}`,
      name: `IPFS: ${cid.slice(0, 12)}...`,
      size: "Decentralized",
      type: "ipfs",
      cid,
    }
    setAttachments((prev) => [...prev, newFile])
    setIpfsCid("")
    setShowIpfsInput(false)
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const sendMail = async () => {
    if (isSending) return
    const userJson = localStorage.getItem("user")
    const user = userJson ? JSON.parse(userJson) : {}

    const cleanTo = normalizeAndDedupeRecipients(recipientEmail)
    const cleanCc = normalizeAndDedupeRecipients(cc)
    const cleanBcc = normalizeAndDedupeRecipients(bcc)

    if (!cleanTo || !subject || !message) {
      setStatus("error")
      setStatusMsg("Please fill in all fields before sending.")
      return
    }

    setIsSending(true)

    try {
      const { sendMailInBackground } = await import("@/utils/backgroundSend")
      deleteDraftOnSend()

      sendMailInBackground({
        user,
        recipientEmail: cleanTo,
        subject,
        message,
        attachments,
        scheduleDate,
        scheduleTime,
        cc: cleanCc,
        bcc: cleanBcc,
      })

      onClose()
    } catch (err: any) {
      setIsSending(false)
      setStatus("error")
      setStatusMsg(`Dispatch Error: ${err?.message}`)
    }
  }

  if (windowState === "minimized") {
    return (
      <div
        onClick={() => setWindowState("open")}
        style={{
          position: "fixed", bottom: "0", right: "24px", zIndex: 1000,
          background: "var(--bg-card)", border: "1px solid var(--border-gold)",
          borderBottom: "none", borderRadius: "10px 10px 0 0",
          padding: "10px 20px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "10px",
          boxShadow: "var(--shadow-deep)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <span style={{ fontSize: "13px", color: "var(--text-bright)", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
          <PenLine size={14} color="var(--gold-mid)" /> {subject || "New Message"}
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {recipientEmail || "No recipient"}
        </span>
        <span style={{
          marginLeft: "8px", fontSize: "11px", color: "var(--text-muted)",
          padding: "2px 8px", borderRadius: "6px",
          background: "rgba(212, 175, 55,0.1)",
        }}>Expand</span>
      </div>
    )
  }

  const isMaximized = windowState === "maximized"

  return (
    <div
      className="compose-window-outer"
      style={{
        position: "fixed", zIndex: 1000,
        bottom: isMaximized ? "0" : "24px",
        right: isMaximized ? "0" : "24px",
        width: isMaximized ? "100vw" : "800px",
        height: isMaximized ? "100vh" : "640px",
        background: "var(--bg-input)",
        borderTop: "3px solid var(--gold-mid)",
        borderRadius: isMaximized ? "0" : "10px",
        boxShadow: "var(--shadow-deep)",
        display: "flex", flexDirection: "column",
        overflow: "hidden", transition: "all 0.2s ease",
        fontFamily: "Inter, sans-serif",
        border: "1px solid var(--border-color)",
        borderTopColor: "var(--gold-mid)",
      }}
    >
      {/* ── Mobile Full-Screen Top Bar ── */}
      <div className="compose-mobile-header">
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", color: "var(--gold-mid)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
            fontSize: "14px", fontWeight: "600", padding: "6px 8px", minHeight: "40px",
            borderRadius: "6px"
          }}
        >
          <X size={18} /> Close
        </button>
        <span className="mobile-header-title">New Message</span>
        <button
          onClick={sendMail}
          disabled={isSending}
          style={{
            background: "none", border: "none", color: "var(--gold-mid)",
            fontWeight: "700", fontSize: "14px", cursor: isSending ? "not-allowed" : "pointer",
            opacity: isSending ? 0.5 : 1, padding: "8px",
            display: "flex", alignItems: "center"
          }}
        >
          <Send size={18} />
        </button>
      </div>

      {/* ── Desktop Header ── */}
      <div className="compose-desktop-controls" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px",
        background: "var(--bg-compose-hdr)",
        borderBottom: "1px solid var(--border-color)",
      }}>
        <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--gold-mid)", display: "flex", alignItems: "center", gap: "8px" }}>
          <PenLine size={14} /> New Message
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            background: encryptionReady === "ready"
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(212, 175, 55, 0.08)",
            border: `1px solid ${encryptionReady === "ready" ? "rgba(34, 197, 94, 0.2)" : "rgba(212, 175, 55, 0.15)"}`,
            borderRadius: "20px", padding: "3px 10px",
            display: "flex", alignItems: "center", gap: "6px"
          }}>
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: encryptionReady === "ready" ? "#22c55e" : "var(--gold-mid)"
            }} />
            <span style={{
              fontSize: "10px",
              color: encryptionReady === "ready" ? "#22c55e" : "var(--gold-mid)",
              fontWeight: "700"
            }}>
              {encryptionReady === "ready" ? "E2E Encrypted" : "IPFS Storage"}
            </span>
          </div>

          <button
            onClick={() => setWindowState(windowState === "maximized" ? "open" : "maximized")}
            style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", display: "flex", padding: "4px" }}
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={() => setWindowState("minimized")}
            style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", display: "flex", padding: "4px" }}
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "var(--text-dim)",
              cursor: "pointer", display: "flex", padding: "4px",
              borderRadius: "4px", transition: "color 0.15s, background 0.15s"
            }}
            title="Close"
            onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.background = "none" }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Recipient Fields ── */}
      <div style={{ borderBottom: "1px solid var(--border-color)", flexShrink: 0, position: "relative" }}>
        {/* TO row */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid var(--border-color)", position: "relative" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "52px", letterSpacing: "0.05em" }}>TO</span>
          <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            {recipientEmail && recipientEmail.includes("@") && recipientEmail.split("@")[1]?.includes(".") && !isFocused ? (
              <div
                onClick={() => setIsFocused(true)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  background: "rgba(160, 114, 10, 0.1)",
                  color: "var(--gold-mid)",
                  padding: "3px 10px", borderRadius: "4px",
                  fontSize: "13px", fontWeight: "600", cursor: "text",
                  border: "1px solid rgba(160, 114, 10, 0.2)"
                }}
              >
                {recipientEmail}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setRecipientEmail(""); setIsFocused(true) }}
                  style={{ background: "none", border: "none", color: "var(--gold-mid)", cursor: "pointer", display: "flex", alignItems: "center", padding: "1px" }}
                >
                  <X size={11} />
                </button>
              </div>
            ) : (
              <input
                id={`${instanceId}_to`}
                name={`${instanceId}_to`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                style={{ background: "none", border: "none", outline: "none", color: "var(--text-bright)", fontSize: "13px", flex: 1, minWidth: "200px" }}
                placeholder="recipient@example.com"
                value={recipientEmail}
                onChange={(e) => handleRecipientChange(e.target.value, "to")}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  setTimeout(() => {
                    setIsFocused(false)
                    if (activeField === "to") setActiveField(null)
                  }, 200)
                }}
                autoFocus={isFocused}
              />
            )}
          </div>
          <button
            onClick={() => setShowCcBcc(!showCcBcc)}
            style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "4px" }}
            title={showCcBcc ? "Hide CC/BCC" : "Show CC/BCC"}
          >
            {showCcBcc ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            CC/BCC
          </button>
        </div>

        {/* CC row */}
        {showCcBcc && (
          <>
            <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid var(--border-color)", position: "relative" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "52px", letterSpacing: "0.05em" }}>CC</span>
              <input
                id={`${instanceId}_cc`}
                name={`${instanceId}_cc`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text-bright)", fontSize: "13px" }}
                placeholder="cc@example.com"
                value={cc}
                onChange={(e) => handleRecipientChange(e.target.value, "cc")}
                onBlur={() => setTimeout(() => activeField === "cc" && setActiveField(null), 200)}
              />
            </div>

            {/* BCC row */}
            <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid var(--border-color)", position: "relative" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "52px", letterSpacing: "0.05em" }}>BCC</span>
              <input
                id={`${instanceId}_bcc`}
                name={`${instanceId}_bcc`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text-bright)", fontSize: "13px" }}
                placeholder="bcc@example.com"
                value={bcc}
                onChange={(e) => handleRecipientChange(e.target.value, "bcc")}
                onBlur={() => setTimeout(() => activeField === "bcc" && setActiveField(null), 200)}
              />
            </div>
          </>
        )}

        {/* Contact Autocomplete Suggestions Popup */}
        {activeField && filteredContacts.length > 0 && (
          <div style={{
            position: "absolute",
            top: activeField === "to" ? "42px" : activeField === "cc" ? "84px" : "126px",
            left: "70px", zIndex: 1100,
            background: "var(--bg-card)", border: "1px solid var(--gold-mid)",
            borderRadius: "6px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            minWidth: "260px", overflow: "hidden"
          }}>
            {filteredContacts.map((contact) => (
              <div
                key={contact}
                onMouseDown={() => selectContact(contact, activeField)}
                style={{
                  padding: "8px 14px", fontSize: "12px", color: "var(--text-bright)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                  borderBottom: "1px solid var(--border-color)", transition: "background 0.15s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(160,114,10,0.15)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <UserCheck size={13} color="var(--gold-mid)" />
                {contact}
              </div>
            ))}
          </div>
        )}

        {/* SUBJECT row */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 20px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "52px", letterSpacing: "0.05em" }}>SUBJ</span>
          <input
            id={`${instanceId}_subject`}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text-bright)", fontSize: "14px", fontWeight: "500" }}
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {/* ── Formatting Bar ── */}
      {showFormatBar && (
        <div className="compose-format-bar" style={{
          display: "flex", alignItems: "center", gap: "4px",
          padding: "6px 20px", background: "var(--bg-deep)",
          borderBottom: "1px solid var(--border-color)", flexShrink: 0,
          overflowX: "auto", WebkitOverflowScrolling: "touch" as any
        }}>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const url = prompt("Enter URL:")
              if (url) applyFormatting("createLink", url)
            }}
            style={{ padding: "4px 8px", background: "none", border: "1px solid var(--border-color)", borderRadius: "4px", color: "var(--text-bright)", cursor: "pointer" }}
            title="Insert Link"
          >
            <Link size={13} />
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div
        ref={editorRef}
        contentEditable
        data-placeholder="Write your message..."
        onBlur={() => {
          saveSelection()
          if (editorRef.current) {
            setMessage(editorRef.current.innerHTML)
          }
        }}
        onInput={() => {
          if (editorRef.current) {
            setMessage(editorRef.current.innerHTML)
          }
        }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        style={{
          flex: 1, background: "none", border: "none", outline: "none",
          padding: "20px", fontSize: "14px", color: "var(--text-bright)",
          lineHeight: "1.8", resize: "none", overflowY: "auto",
          minHeight: "100px"
        }}
        suppressContentEditableWarning
      />

      {/* ── Status message ── */}
      {status === "error" && (
        <div style={{
          padding: "8px 20px", background: "rgba(239,68,68,0.08)",
          borderTop: "1px solid rgba(239,68,68,0.2)",
          color: "#ef4444", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px"
        }}>
          <AlertCircle size={14} /> {statusMsg}
        </div>
      )}

      {/* ── Attachments chips ── */}
      {attachments.length > 0 && (
        <div style={{ padding: "8px 20px", flexShrink: 0, borderTop: "1px solid var(--border-color)", display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {attachments.map((att) => (
            <div key={att.id} style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "4px 10px", borderRadius: "6px",
              background: "var(--bg-deep)", border: "1px solid var(--border-color)",
              fontSize: "12px", color: "var(--text-muted)"
            }}>
              {att.type === "ipfs" ? <Archive size={11} /> : <Paperclip size={11} />}
              <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
              <button onClick={() => removeAttachment(att.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", alignItems: "center" }}><X size={11} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── IPFS CID input ── */}
      {showIpfsInput && (
        <div style={{ padding: "10px 20px", flexShrink: 0, borderTop: "1px solid var(--border-color)", display: "flex", gap: "8px", alignItems: "center", background: "var(--bg-deep)" }}>
          <input
            style={{ flex: 1, padding: "7px 12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-bright)", fontSize: "12px", outline: "none" }}
            placeholder="Paste IPFS CID (Qm...)"
            value={ipfsCid}
            onChange={(e) => setIpfsCid(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleIpfsAttach()}
            autoFocus
          />
          <button onClick={handleIpfsAttach} style={{ padding: "7px 14px", borderRadius: "6px", cursor: "pointer", background: "var(--gold-mid)", border: "none", color: "#fff", fontSize: "11px", fontWeight: "700" }}>Attach</button>
          <button onClick={() => { setShowIpfsInput(false); setIpfsCid("") }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)" }}><X size={16} /></button>
        </div>
      )}

      {/* ── Schedule picker ── */}
      {showSchedule && (
        <div style={{ padding: "10px 20px", flexShrink: 0, borderTop: "1px solid var(--border-color)", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", background: "var(--bg-deep)" }}>
          <span style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: "700" }}>SEND AT:</span>
          <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
            style={{ padding: "5px 10px", borderRadius: "6px", background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-bright)", fontSize: "11px", outline: "none" }}
          />
          <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: "6px", background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-bright)", fontSize: "11px", outline: "none" }}
          />
          <button onClick={() => { setShowSchedule(false); setScheduleDate(""); setScheduleTime("") }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold-mid)", fontSize: "11px", fontWeight: "700" }}>CLEAR</button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="compose-bottom-toolbar" style={{ padding: "12px 20px", background: "var(--bg-compose-hdr)", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", flexShrink: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
        <div className="compose-toolbar-left" style={{ display: "flex", gap: "4px", alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={() => setShowFormatBar(!showFormatBar)}
            style={{ width: "32px", height: "32px", background: showFormatBar ? "rgba(160,114,10,0.1)" : "none", border: `1px solid ${showFormatBar ? "var(--gold-mid)" : "var(--border-color)"}`, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: showFormatBar ? "var(--gold-mid)" : "var(--text-dim)", transition: "all 0.15s" }}
            title="Formatting Options"
          >
            <Type size={15} />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ width: "32px", height: "32px", background: "none", border: "1px solid var(--border-color)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-dim)", transition: "all 0.15s" }}
            title="Attach Local File"
            onMouseEnter={e => { e.currentTarget.style.color = "var(--gold-mid)"; e.currentTarget.style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.background = "none" }}
          >
            <Paperclip size={15} />
          </button>
          <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleFileAttach} />

          <button
            onClick={() => setShowIpfsInput(!showIpfsInput)}
            style={{ width: "32px", height: "32px", background: showIpfsInput ? "rgba(160,114,10,0.1)" : "none", border: `1px solid ${showIpfsInput ? "var(--gold-mid)" : "var(--border-color)"}`, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: showIpfsInput ? "var(--gold-mid)" : "var(--text-dim)", transition: "all 0.15s" }}
            title="Attach IPFS CID"
          >
            <Archive size={15} />
          </button>

          <button
            onClick={() => setShowSchedule(!showSchedule)}
            style={{ width: "32px", height: "32px", background: showSchedule ? "rgba(160,114,10,0.1)" : "none", border: `1px solid ${showSchedule ? "var(--gold-mid)" : "var(--border-color)"}`, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: showSchedule ? "var(--gold-mid)" : "var(--text-dim)", transition: "all 0.15s" }}
            title="Schedule Send"
          >
            <Clock size={15} />
          </button>

          <div style={{ width: "1px", height: "24px", background: "var(--border-color)", margin: "0 4px" }} />

          <button
            onClick={() => saveDraft(false)}
            style={{ height: "32px", padding: "0 10px", background: draftSaved ? "rgba(34,197,94,0.1)" : "none", border: `1px solid ${draftSaved ? "rgba(34,197,94,0.3)" : "var(--border-color)"}`, borderRadius: "6px", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", color: draftSaved ? "#22c55e" : "var(--text-dim)", fontSize: "11px", fontWeight: "600", transition: "all 0.2s", whiteSpace: "nowrap" }}
            title="Save Draft"
            onMouseEnter={e => { if (!draftSaved) { e.currentTarget.style.color = "var(--gold-mid)"; e.currentTarget.style.borderColor = "var(--gold-mid)" } }}
            onMouseLeave={e => { if (!draftSaved) { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border-color)" } }}
          >
            {draftSaved ? <Check size={13} /> : <Save size={13} />}
            <span>{draftSaved ? "Saved!" : "Draft"}</span>
          </button>
        </div>

        <div className="compose-toolbar-right" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {draftLastSaved && !draftSaved && (
            <span className="hide-on-mobile" style={{ fontSize: "10px", color: "var(--text-dim)", opacity: 0.7 }}>
              Saved {draftLastSaved}
            </span>
          )}

          <button
            onClick={sendMail}
            disabled={isSending}
            style={{
              background: "var(--gold-mid)", color: "#000", border: "none",
              padding: "8px 16px", borderRadius: "8px", fontWeight: "700",
              fontSize: "12px", cursor: isSending ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "6px",
              boxShadow: "0 2px 8px rgba(160, 114, 10, 0.3)",
              opacity: isSending ? 0.7 : 1, whiteSpace: "nowrap",
              transition: "all 0.15s"
            }}
            onMouseEnter={e => { if (!isSending) e.currentTarget.style.transform = "translateY(-1px)" }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)" }}
          >
            <Send size={13} />
            {isSending ? "Sending..." : "Send Encrypted"}
          </button>
        </div>
      </div>
    </div>
  )
}

