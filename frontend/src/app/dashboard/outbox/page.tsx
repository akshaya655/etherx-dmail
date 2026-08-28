"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter } from "next/navigation"
import { subscribe, getMails, updateMailInStore } from "@/utils/mailStore"
import {
  Send, RefreshCw, Trash2, AlertTriangle, RotateCcw,
  Clock, ChevronRight, ArrowLeft
} from "lucide-react"

const formatOutboxTime = (time: string) => {
  if (!time || isNaN(Date.parse(time))) return "Queued"
  const d = new Date(time)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  if (itemDate.getTime() === today.getTime()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } else if (itemDate.getTime() === yesterday.getTime()) {
    return "Yesterday"
  } else if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" })
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" })
}

function OutboxPageContent() {
  const router = useRouter()
  const [mails, setMails] = useState<any[]>([])
  const [retrying, setRetrying] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const load = useCallback(() => {
    setMails(getMails("outbox"))
  }, [])

  useEffect(() => {
    load()
    const unsub = subscribe(load)
    return () => unsub()
  }, [load])

  const handleRefresh = () => {
    setIsRefreshing(true)
    load()
    setTimeout(() => setIsRefreshing(false), 600)
  }

  /**
   * Retry a failed email.
   * Reads the `originalParams` stored by backgroundSend on failure.
   * Removes the failed entry then calls sendMailInBackground with the same params.
   * Double-click prevention via the `retrying` Set.
   */
  const handleRetry = useCallback(async (mail: any) => {
    if (retrying.has(mail.id)) return // Prevent double-send

    const params = mail.originalParams
    if (!params) {
      alert("Retry data unavailable for this message. Please compose a new message.")
      return
    }

    setRetrying(prev => new Set(prev).add(mail.id))

    try {
      // 1. Remove the failed entry so it doesn't double-display
      updateMailInStore(mail.id, { status: "purged" })

      // 2. Load user from localStorage
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      if (!user.email) throw new Error("Not logged in")

      // 3. Reuse the existing backgroundSend pipeline — no logic duplication
      const { sendMailInBackground } = await import("@/utils/backgroundSend")
      sendMailInBackground({
        user,
        recipientEmail: params.recipientEmail,
        subject: params.subject,
        message: params.message,
        // Attachments with binary data are no longer available (already uploaded or local).
        // We pass metadata-only IPFS attachments that survived the previous attempt.
        attachments: (params.attachmentMeta || []).filter((a: any) => a.type === "ipfs" || a.type === "ipfs_hybrid"),
        cc: params.cc || "",
        bcc: params.bcc || "",
        threadId: params.threadId,
      })

      setSelectedId(null)
    } catch (err: any) {
      console.error("[Outbox] Retry failed:", err)
      // Restore the failed status
      updateMailInStore(mail.id, { status: "outbox" })
    } finally {
      setRetrying(prev => {
        const next = new Set(prev)
        next.delete(mail.id)
        return next
      })
    }
  }, [retrying])

  const handleDiscard = (id: string) => {
    updateMailInStore(id, { status: "trash", isPending: false })
    if (selectedId === id) setSelectedId(null)
  }

  const selectedMail = mails.find(m => m.id === selectedId)

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", background: "var(--bg-body)", overflow: "hidden", position: "relative" }}>

      {/* ── List Panel ── */}
      <div
        className={`mail-list-pane ${selectedMail ? "has-selected" : ""}`}
        style={{
          width: selectedMail ? "360px" : "100%",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          maxWidth: selectedMail ? "360px" : "100%",
          margin: selectedMail ? "0" : "0 auto",
          borderRight: selectedMail ? "1px solid var(--border-color)" : "none",
          willChange: "width",
          overflowX: "hidden",
          height: "100%",
          minWidth: 0,
        }}
      >
        {/* Header with Back button for mobile navigation */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
              <button
                onClick={() => router.push("/dashboard/inbox")}
                style={{
                  background: "var(--mail-row-border, #141414)",
                  border: "1px solid var(--border-color, #1F1F1F)",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--gold-mid, #D4AF37)",
                  flexShrink: 0,
                  transition: "background 0.2s ease, transform 0.15s ease",
                }}
                aria-label="Back to Inbox"
                title="Back to Inbox"
              >
                <ArrowLeft size={17} />
              </button>

              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif", letterSpacing: "-0.01em" }}>
                  Outbox
                </h1>
                <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "2px 0 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {mails.length === 0 ? "No queued messages" : `${mails.length} message${mails.length > 1 ? "s" : ""} queued`}
                </p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                flexShrink: 0,
                transition: "color 0.2s, background 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--gold-mid)"; e.currentTarget.style.background = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.background = "transparent"; }}
              title="Refresh Outbox"
              aria-label="Refresh Outbox"
            >
              <RefreshCw size={17} style={{ animation: isRefreshing ? "spin 0.8s linear infinite" : "none" }} />
            </button>
          </div>

          {/* Info banner */}
          {mails.length > 0 && (
            <div
              className="outbox-info-banner"
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px",
                padding: "10px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                marginBottom: "2px",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                whiteSpace: "normal",
                writingMode: "horizontal-tb",
              }}
            >
              <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
              <p style={{
                fontSize: "12px",
                color: "#ef4444",
                margin: 0,
                lineHeight: 1.45,
                wordBreak: "normal",
                overflowWrap: "break-word",
                whiteSpace: "normal",
                writingMode: "horizontal-tb",
                flex: 1,
                minWidth: 0,
              }}>
                These messages failed to send. Click a message to <strong>Retry</strong> or <strong>Discard</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Mail list */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}>
          {mails.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", width: "100%", margin: "0 auto", maxWidth: "360px" }}>
              <div style={{ fontSize: "44px", marginBottom: "16px", opacity: 0.35 }}>📤</div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-bright)", marginBottom: "6px" }}>Outbox is clear</h3>
              <p style={{ color: "var(--text-dim)", fontSize: "13px", lineHeight: 1.5, marginBottom: "20px" }}>
                All outgoing messages have been sent. Messages that fail to dispatch will appear here.
              </p>
              <button
                onClick={() => router.push("/dashboard/inbox")}
                style={{
                  background: "rgba(212, 175, 55, 0.1)",
                  color: "var(--gold-mid)",
                  border: "1px solid rgba(212, 175, 55, 0.25)",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
              >
                <ArrowLeft size={14} /> Go to Inbox
              </button>
            </div>
          ) : (
            mails.map(mail => {
              const isRetryingThis = retrying.has(mail.id)
              const isSelected = selectedId === mail.id
              const originalSubject = mail.originalParams?.subject || mail.subject?.replace(/^⚠️ Failed: /, "") || "(No subject)"
              const recipient = mail.originalParams?.recipientEmail || mail.receiverEmail || "Unknown recipient"
              const formattedTime = formatOutboxTime(mail.time)
              const snippet = mail.originalParams?.message?.slice(0, 120) || mail.message?.slice(0, 120) || ""

              return (
                <div
                  key={mail.id}
                  onClick={() => setSelectedId(isSelected ? null : mail.id)}
                  className={`mail-row ${isSelected ? "selected" : ""}`}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--mail-row-border, #141414)",
                    cursor: "pointer",
                    background: isSelected ? "rgba(239,68,68,0.08)" : "transparent",
                    borderLeft: isSelected ? "3px solid #ef4444" : "3px solid transparent",
                    transition: "background 0.15s ease",
                    position: "relative",
                    minHeight: "62px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                >
                  {/* Status Avatar */}
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "rgba(239,68,68,0.12)",
                    border: "1.5px solid rgba(239,68,68,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "2px",
                  }}>
                    {isRetryingThis
                      ? <RefreshCw size={15} color="#ef4444" style={{ animation: "spin 1s linear infinite" }} />
                      : <AlertTriangle size={15} color="#ef4444" />
                    }
                  </div>

                  {/* Mail Row Info */}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                    {/* Line 1: Recipient + Timestamp */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", width: "100%" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-bright)", fontFamily: "Inter, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                        To: {recipient.split("@")[0]}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-dim)", flexShrink: 0, whiteSpace: "nowrap" }}>
                        {formattedTime}
                      </span>
                    </div>

                    {/* Line 2: Subject */}
                    <div style={{ fontSize: "13px", color: "var(--text-bright)", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                      {originalSubject}
                    </div>

                    {/* Line 3: Message preview snippet */}
                    {snippet && (
                      <div style={{ fontSize: "12px", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                        {snippet}
                      </div>
                    )}

                    {/* Line 4: Error details (if any) */}
                    {mail.error && (
                      <div style={{ fontSize: "11px", color: "#ef4444", opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", marginTop: "1px" }}>
                        ⚠️ {mail.error}
                      </div>
                    )}
                  </div>

                  <ChevronRight size={14} color="var(--text-dim)" style={{ flexShrink: 0, opacity: isSelected ? 1 : 0.4, marginTop: "10px" }} />
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {selectedMail && (() => {
        const originalSubject = selectedMail.originalParams?.subject || selectedMail.subject?.replace(/^⚠️ Failed: /, "") || "(No subject)"
        const recipient = selectedMail.originalParams?.recipientEmail || selectedMail.receiverEmail || "Unknown"
        const ccList = selectedMail.originalParams?.cc || ""
        const bccList = selectedMail.originalParams?.bcc || ""
        const isRetryingThis = retrying.has(selectedMail.id)

        return (
          <div
            className="mail-detail-pane"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-body)",
              padding: "24px 20px 40px",
              borderLeft: "1px solid var(--border-color, #1F1F1F)",
              position: "relative",
              overflowY: "auto",
              overflowX: "hidden",
              minWidth: 0,
              WebkitOverflowScrolling: "touch",
              paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {/* Top Navigation Row with Back Button */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", width: "100%", minWidth: 0 }}>
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  background: "var(--mail-row-border, #141414)",
                  border: "1px solid var(--border-color, #1F1F1F)",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--gold-mid, #D4AF37)",
                  flexShrink: 0,
                  transition: "background 0.2s ease",
                }}
                aria-label="Back to outbox list"
                title="Back to Outbox list"
              >
                <ArrowLeft size={17} />
              </button>

              <h1
                className="mail-detail-subject"
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "var(--text-bright)",
                  margin: 0,
                  fontFamily: "Inter, sans-serif",
                  flex: 1,
                  minWidth: 0,
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                  lineHeight: 1.3,
                }}
              >
                {originalSubject}
              </h1>
            </div>

            {/* Failed banner */}
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
                maxWidth: "100%",
                boxSizing: "border-box",
                whiteSpace: "normal",
                writingMode: "horizontal-tb",
              }}
            >
              <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div style={{
                flex: 1,
                minWidth: 0,
                width: "100%",
                whiteSpace: "normal",
                writingMode: "horizontal-tb",
              }}>
                <div style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#ef4444",
                  marginBottom: "4px",
                  whiteSpace: "normal",
                  writingMode: "horizontal-tb",
                  wordBreak: "normal",
                  overflowWrap: "break-word",
                  width: "100%",
                }}>
                  Message failed to send
                </div>
                {selectedMail.error && (
                  <div style={{
                    fontSize: "12px",
                    color: "#ef4444",
                    opacity: 0.85,
                    fontFamily: "monospace",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    lineHeight: 1.4,
                    whiteSpace: "normal",
                    writingMode: "horizontal-tb",
                    width: "100%",
                  }}>
                    {selectedMail.error}
                  </div>
                )}
              </div>
            </div>

            {/* Metadata (To, CC, BCC, Time) */}
            <div className="mail-detail-meta" style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", flexWrap: "wrap", width: "100%" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "36px", textTransform: "uppercase", paddingTop: "4px", flexShrink: 0 }}>To</span>
                <span style={{
                  fontSize: "13px",
                  color: "var(--text-bright)",
                  background: "var(--bg-deep)",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  wordBreak: "break-all",
                  overflowWrap: "anywhere",
                  maxWidth: "100%",
                  display: "inline-block",
                }}>
                  {recipient}
                </span>
              </div>
              {ccList && (
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", flexWrap: "wrap", width: "100%" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "36px", textTransform: "uppercase", paddingTop: "2px", flexShrink: 0 }}>CC</span>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)", wordBreak: "break-all", overflowWrap: "anywhere", flex: 1 }}>{ccList}</span>
                </div>
              )}
              {bccList && (
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", flexWrap: "wrap", width: "100%" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "36px", textTransform: "uppercase", paddingTop: "2px", flexShrink: 0 }}>BCC</span>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)", wordBreak: "break-all", overflowWrap: "anywhere", flex: 1 }}>{bccList}</span>
                </div>
              )}
              {selectedMail.time && (
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", flexWrap: "wrap", width: "100%" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "36px", textTransform: "uppercase", paddingTop: "2px", flexShrink: 0 }}>At</span>
                  <span style={{ fontSize: "12px", color: "var(--text-dim)", flex: 1 }}>{new Date(selectedMail.time).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "28px", flexWrap: "wrap", width: "100%" }}>
              <button
                onClick={() => handleRetry(selectedMail)}
                disabled={isRetryingThis}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background: isRetryingThis ? "rgba(212,175,55,0.15)" : "linear-gradient(135deg, var(--gold-rich), var(--gold-light))",
                  color: isRetryingThis ? "var(--gold-mid)" : "#000",
                  border: isRetryingThis ? "1px solid var(--gold-mid)" : "none",
                  padding: "10px 20px",
                  minHeight: "44px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: isRetryingThis ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  flex: "1 1 auto",
                  minWidth: "130px",
                  boxShadow: isRetryingThis ? "none" : "0 2px 8px rgba(212, 175, 55, 0.25)",
                }}
              >
                {isRetryingThis
                  ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> Retrying…</>
                  : <><RotateCcw size={15} /> Retry Send</>
                }
              </button>

              <button
                onClick={() => handleDiscard(selectedMail.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background: "rgba(239,68,68,0.08)",
                  color: "#ef4444",
                  border: "1px solid rgba(239,68,68,0.25)",
                  padding: "10px 18px",
                  minHeight: "44px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  flex: "1 1 auto",
                  minWidth: "110px",
                }}
              >
                <Trash2 size={15} /> Discard
              </button>
            </div>

            {/* Message preview */}
            {selectedMail.originalParams?.message && (
              <div style={{ width: "100%", minWidth: 0 }}>
                <div style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "var(--text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "10px",
                }}>
                  Message Preview
                </div>
                <div style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "10px",
                  padding: "16px",
                  fontSize: "13px",
                  lineHeight: "1.7",
                  color: "var(--text-muted)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                  fontFamily: "Inter, sans-serif",
                  maxHeight: "400px",
                  overflowY: "auto",
                }}>
                  {selectedMail.originalParams.message.slice(0, 1500)}
                  {selectedMail.originalParams.message.length > 1500 ? "…" : ""}
                </div>
              </div>
            )}
          </div>
        )
      })()}
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
