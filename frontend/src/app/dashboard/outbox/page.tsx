"use client"

import { useEffect, useState, useMemo, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Clock, RefreshCw, Trash2, RotateCcw, AlertTriangle,
  ArrowLeft, Star, Reply, Forward, Tag, Check, Paperclip, Download
} from "lucide-react"
import { subscribe, updateMailInStore, getMails, initMailStore } from "@/utils/mailStore"
import { getLabels, getMailLabels, toggleMailLabel, subscribeLabelStore, type Label } from "@/utils/labelStore"
import { useLabel } from "@/context/LabelContext"
import MailSkeleton from "@/components/MailSkeleton"
import MailRow from "@/components/MailRow"
import EmailBodyViewer from "@/components/EmailBodyViewer"
import SearchFiltersPanel, { SearchFilters, emptyFilters } from "@/components/SearchFiltersPanel"

type Tab = "All" | "Failed" | "Starred"

function OutboxPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get("search") || ""
  const { activeLabelId, setActiveLabelId } = useLabel()

  const [loading, setLoading] = useState(true)
  const [mails, setMails] = useState<any[]>([])
  const [selectedMail, setSelectedMail] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<Tab>("All")
  const [userEmail, setUserEmail] = useState("")
  const [filters, setFilters] = useState<SearchFilters>({ ...emptyFilters(), query: urlSearch })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [retrying, setRetrying] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [inboxLayout, setInboxLayout] = useState("comfortable")
  const [emailPreview, setEmailPreview] = useState("2lines")
  const [userLabels, setUserLabels] = useState<Label[]>([])
  const [showLabelMenu, setShowLabelMenu] = useState(false)
  const [replyMode, setReplyMode] = useState<"reply" | "forward" | null>(null)
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [forwardRecipient, setForwardRecipient] = useState("")
  const [replyAttachments, setReplyAttachments] = useState<any[]>([])
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [debouncedSearch, setDebouncedSearch] = useState(filters.query)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.query), 300)
    return () => clearTimeout(timer)
  }, [filters.query])

  useEffect(() => {
    if (urlSearch) setFilters(prev => ({ ...prev, query: urlSearch }))
  }, [urlSearch])

  const loadMails = useCallback(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    if (user.email) {
      setUserEmail(user.email)
      setUserLabels(getLabels(user.email))
    }
    setMails(getMails("outbox"))
    setLoading(false)
    setIsRefreshing(false)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    if (user.email) {
      setUserEmail(user.email)
      initMailStore(user.email)
    }

    setInboxLayout(localStorage.getItem("settings_inboxLayout") || "comfortable")
    setEmailPreview(localStorage.getItem("settings_emailPreview") || "2lines")

    loadMails()
    const unsub = subscribe(loadMails)
    const unsubLabels = subscribeLabelStore(loadMails)

    return () => {
      unsub()
      unsubLabels()
    }
  }, [loadMails])

  const handleRefresh = () => {
    setIsRefreshing(true)
    if (userEmail) {
      initMailStore(userEmail, true)
    }
    loadMails()
    setTimeout(() => setIsRefreshing(false), 800)
  }

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
        if (activeTab === "Failed" && !m.error && !m.subject?.startsWith("⚠️ Failed:")) return false
        if (activeTab === "Starred" && !m.isStarred) return false
        if (activeLabelId && !getMailLabels(userEmail, m.id).includes(activeLabelId)) return false

        // Advanced filter: starred only
        if (filters.starredOnly && !m.isStarred) return false

        // Advanced filter: has attachment
        if (filters.hasAttachment && !m.cid && !m.attachments?.length && !m.originalParams?.attachmentMeta?.length) return false

        // Advanced filter: from sender
        if (filters.from) {
          const q = filters.from.toLowerCase()
          if (!m.senderEmail?.toLowerCase().includes(q) && !m.senderName?.toLowerCase().includes(q)) return false
        }

        // Advanced filter: to recipient
        if (filters.to) {
          const q = filters.to.toLowerCase()
          const toEmail = m.receiverEmail || m.originalParams?.recipientEmail || ""
          if (!toEmail.toLowerCase().includes(q)) return false
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
          const toEmail = m.receiverEmail || m.originalParams?.recipientEmail || ""
          const msg = m.originalParams?.message || m.message || ""
          return (
            m.subject?.toLowerCase().includes(q) ||
            toEmail.toLowerCase().includes(q) ||
            m.senderEmail?.toLowerCase().includes(q) ||
            msg.toLowerCase().includes(q) ||
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
      updateMailInStore(id, { status: "trash", isPending: false })
    })
    setSelectedIds(new Set())
    if (selectedMail && selectedIds.has(selectedMail.id)) {
      setSelectedMail(null)
    }
  }

  const handleDiscard = (id: string) => {
    updateMailInStore(id, { status: "trash", isPending: false })
    if (selectedMail?.id === id) setSelectedMail(null)
  }

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const mail = mails.find(m => m.id === id)
    if (mail) {
      updateMailInStore(id, { isStarred: !mail.isStarred })
    }
  }

  const openMail = (mail: any) => {
    setSelectedMail(mail)
    setReplyMode(null)
    if (!mail.isRead) {
      updateMailInStore(mail.id, { isRead: true })
    }
  }

  const currentSelectedMail = useMemo(() => {
    if (!selectedMail) return null
    return mails.find(m => m.id === selectedMail.id) || selectedMail
  }, [mails, selectedMail])

  /**
   * Retry a failed email.
   * Reads originalParams stored during background send.
   */
  const handleRetry = useCallback(async (mail: any) => {
    if (!mail || retrying.has(mail.id)) return

    const params = mail.originalParams
    if (!params) {
      alert("Retry data unavailable for this message. Please compose a new message.")
      return
    }

    setRetrying(prev => new Set(prev).add(mail.id))

    try {
      updateMailInStore(mail.id, { status: "purged" })

      const user = JSON.parse(localStorage.getItem("user") || "{}")
      if (!user.email) throw new Error("Not logged in")

      const { sendMailInBackground } = await import("@/utils/backgroundSend")
      sendMailInBackground({
        user,
        recipientEmail: params.recipientEmail,
        subject: params.subject?.replace(/^⚠️ Failed:\s*/, "") || params.subject || "(No subject)",
        message: params.message || "",
        attachments: (params.attachmentMeta || []).filter((a: any) => a.type === "ipfs" || a.type === "ipfs_hybrid"),
        cc: params.cc || "",
        bcc: params.bcc || "",
        threadId: params.threadId,
      })

      setSelectedMail(null)
    } catch (err: any) {
      console.error("[Outbox] Retry failed:", err)
      updateMailInStore(mail.id, { status: "outbox" })
    } finally {
      setRetrying(prev => {
        const next = new Set(prev)
        next.delete(mail.id)
        return next
      })
    }
  }, [retrying])

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
    const recipient = replyMode === "reply"
      ? (currentSelectedMail.receiverEmail || currentSelectedMail.originalParams?.recipientEmail || currentSelectedMail.senderEmail)
      : forwardRecipient
    if (!recipient) return
    if (replyMode === "reply" && !replyText) return
    setSendingReply(true)
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      const { sendMailInBackground } = await import("@/utils/backgroundSend")
      
      const cleanSub = currentSelectedMail.subject?.replace(/^⚠️ Failed:\s*/, "") || "(No subject)"
      let messageBody = replyText
      if (replyMode === "forward") {
        const originalContent = currentSelectedMail.originalParams?.message || currentSelectedMail.message || ""
        const fwdHeader = `\n\n---------- Forwarded message ----------\nTo: ${currentSelectedMail.receiverEmail || currentSelectedMail.originalParams?.recipientEmail}\nDate: ${currentSelectedMail.time}\nSubject: ${cleanSub}\n\n`
        messageBody = (replyText ? replyText + "\n" : "") + fwdHeader + originalContent
      }

      sendMailInBackground({
        user,
        recipientEmail: recipient,
        subject: `${replyMode === "reply" ? "Re:" : "Fwd:"} ${cleanSub}`,
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

    const recipient = mail.originalParams?.recipientEmail || mail.receiverEmail || "Unknown recipient"
    const ccList = mail.originalParams?.cc || mail.cc || ""
    const bccList = mail.originalParams?.bcc || mail.bcc || ""
    const isRetryingThis = retrying.has(mail.id)
    const isFailed = Boolean(mail.error || mail.subject?.startsWith("⚠️ Failed:"))

    // Parse attachments if present
    let parsedAttachments: any[] = []
    if (mail.originalParams?.attachmentMeta) {
      parsedAttachments = mail.originalParams.attachmentMeta
    } else if (mail.attachments) {
      if (typeof mail.attachments === "string") {
        try { parsedAttachments = JSON.parse(mail.attachments) } catch {}
      } else if (Array.isArray(mail.attachments)) {
        parsedAttachments = mail.attachments
      }
    }

    return (
      <div
        className="mail-detail-pane"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-body)",
          padding: "32px 40px 40px",
          borderLeft: "1px solid #141414",
          position: "relative",
          overflowY: "auto"
        }}
      >
        {/* Header Navigation with Back Button */}
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
            aria-label="Back to Outbox"
            title="Back to Outbox"
          >
            <ArrowLeft size={17} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif", lineHeight: 1.3, letterSpacing: "-0.3px", wordBreak: "break-word" }}>
              {mail.subject || "(No subject)"}
            </h1>
          </div>
        </div>

        {/* Failed Notice Banner */}
        {isFailed && (
          <div
            className="outbox-failed-banner"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              width: "100%",
              boxSizing: "border-box"
            }}
          >
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#ef4444", marginBottom: "4px" }}>
                Message failed to send
              </div>
              {mail.error && (
                <div style={{ fontSize: "12px", color: "#ef4444", opacity: 0.9, fontFamily: "monospace", wordBreak: "break-word", lineHeight: 1.4 }}>
                  {mail.error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recipient Card */}
        <div style={{
          display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px",
          padding: "16px 20px", borderRadius: "14px",
          background: "rgba(255,255,255,0.03)", border: "1px solid #1a1a1a"
        }}>
          <div style={{
            width: "46px", height: "46px", borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, rgba(212,175,55,0.3) 0%, rgba(212,175,55,0.08) 100%)",
            border: "1.5px solid rgba(212,175,55,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", fontWeight: "800", color: "var(--gold-mid)",
            boxShadow: "0 0 20px rgba(212,175,55,0.1)"
          }}>
            {(mail.receiverName || recipient || "U").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-bright)", fontFamily: "Inter, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                To: {mail.receiverName || recipient.split("@")[0]}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-dim)", flexShrink: 0 }}>
                {mail.time && !isNaN(Date.parse(mail.time))
                  ? new Date(mail.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  : mail.time}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "3px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ opacity: 0.7 }}>{mail.senderEmail || userEmail}</span>
              <span style={{ color: "var(--gold-mid)", opacity: 0.5 }}>→</span>
              <span style={{ opacity: 0.7 }}>{recipient}</span>
            </div>
            {(ccList || bccList) && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                {ccList && <span>CC: {ccList} </span>}
                {bccList && <span>BCC: {bccList}</span>}
              </div>
            )}
            {/* Labels */}
            {userLabels.filter(l => getMailLabels(userEmail, mail.id).includes(l.id)).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
                {userLabels.filter(l => getMailLabels(userEmail, mail.id).includes(l.id)).map(lbl => (
                  <span key={lbl.id} style={{
                    fontSize: "9px", padding: "2px 7px", borderRadius: "4px",
                    background: `${lbl.color}22`, color: lbl.color, border: `1px solid ${lbl.color}44`,
                    fontWeight: "700", textTransform: "uppercase"
                  }}>{lbl.emoji && <span>{lbl.emoji} </span>}{lbl.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "28px", position: "relative", flexWrap: "wrap" }}>
          {/* Retry Button */}
          {mail.originalParams && (
            <button
              onClick={() => handleRetry(mail)}
              disabled={isRetryingThis}
              style={{
                background: "var(--gold-mid)", color: "#000", border: "none", borderRadius: "8px",
                padding: "9px 20px", fontSize: "13px", fontWeight: "700", cursor: isRetryingThis ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "7px", boxShadow: "0 4px 15px rgba(212,175,55,0.25)",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => { if (!isRetryingThis) { e.currentTarget.style.boxShadow = "0 6px 20px rgba(212,175,55,0.4)"; e.currentTarget.style.transform = "translateY(-1px)" } }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 15px rgba(212,175,55,0.25)"; e.currentTarget.style.transform = "translateY(0)" }}
            >
              {isRetryingThis ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <RotateCcw size={15} />}
              {isRetryingThis ? "Retrying..." : "Retry Send"}
            </button>
          )}

          <button
            onClick={() => setReplyMode("reply")}
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-bright)", border: "1px solid #222", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
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
            onClick={() => handleDiscard(mail.id)}
            style={{ background: "rgba(232,66,52,0.06)", color: "#e84234", border: "1px solid rgba(232,66,52,0.2)", borderRadius: "8px", padding: "9px 14px", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(232,66,52,0.12)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(232,66,52,0.06)"}
            title="Discard / Move to Trash"
          ><Trash2 size={15} /></button>
        </div>

        {/* Main Content Area (Attachments + Message + Reply) */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Attachments */}
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

          {/* Email Body */}
          <EmailBodyViewer
            content={mail.originalParams?.message || mail.message}
            html={mail.html}
            minHeight="150px"
            style={{ margin: "8px 0" }}
          />

          {/* Reply Composition Box */}
          {replyMode && (
            <div style={{ marginTop: "24px", border: "1px solid #1F1F1F", borderRadius: "12px", background: "var(--bg-card)", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
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

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          style={{ display: "none" }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg-body)", overflow: "hidden" }}>
      {/* ── Mail List Pane ── */}
      <div
        className={`mail-list-pane ${currentSelectedMail ? "has-selected" : ""}`}
        style={{
          width: currentSelectedMail ? "360px" : "100%",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          maxWidth: currentSelectedMail ? "360px" : "100%",
          margin: currentSelectedMail ? "0" : "0 auto",
          willChange: "width"
        }}
      >
        {/* Header with Title & Search */}
        <div style={{ padding: "24px 24px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Clock size={24} color="var(--gold-mid)" />
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif" }}>
                  {activeLabelId ? (userLabels.find(l => l.id === activeLabelId)?.name || "Label") : "Outbox"}
                </h1>
                <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "2px 0 0 0" }}>
                  {mails.length === 0 ? "No queued messages" : `${mails.length} message${mails.length > 1 ? "s" : ""} queued`}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {activeLabelId && (
                <button
                  onClick={() => {
                    setActiveLabelId(null)
                    router.push("/dashboard/outbox")
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
                onClick={handleRefresh}
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
                title="Refresh Outbox"
                aria-label="Refresh Outbox"
              >
                <RefreshCw size={18} style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }} />
              </button>
            </div>
          </div>

          <SearchFiltersPanel
            filters={filters}
            onChange={setFilters}
            onClear={() => setFilters(emptyFilters())}
            placeholder="Search outbox..."
          />

          <div style={{ display: "flex", gap: "4px", background: "var(--bg-card)", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
            {(["All", "Failed", "Starred"] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "6px 20px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer",
                  background: activeTab === tab ? "var(--gold-mid)" : "transparent",
                  color: activeTab === tab ? "var(--bg-body)" : "var(--text-dim)",
                  border: "none"
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Selection / Bulk Actions Toolbar */}
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

              {/* Delete / Discard batch */}
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

        {/* Mail List Area */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <MailSkeleton />
          ) : filteredMails.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-dim)" }}>
              No messages in outbox
            </div>
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
                        showToRecipient={true}
                        badge={mail.error ? { label: "Failed", color: "#ef4444" } : (mail.isPending ? { label: "Queued", color: "var(--gold-mid)" } : undefined)}
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

      {/* ── Detail Pane ── */}
      {renderDetailView()}
    </div>
  )
}

export default function OutboxPage() {
  return (
    <Suspense fallback={null}>
      <OutboxPageContent />
    </Suspense>
  )
}
