"use client"

import { useEffect, useState, useCallback } from "react"
import { subscribe, getMails, updateMailInStore } from "@/utils/mailStore"
import {
  Send, RefreshCw, Trash2, AlertTriangle, RotateCcw,
  Clock, ChevronRight, ArrowLeft
} from "lucide-react"

export default function OutboxPage() {
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
        {/* Header */}
        <div style={{ padding: "20px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
              <Send size={24} color="var(--gold-mid)" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif", letterSpacing: "-0.01em" }}>
                  Outbox
                </h1>
                <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "2px 0 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {mails.length === 0 ? "No queued messages" : `${mails.length} message${mails.length > 1 ? "s" : ""} queued for dispatch`}
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
              <RefreshCw size={18} style={{ animation: isRefreshing ? "spin 0.8s linear infinite" : "none" }} />
            </button>
          </div>

          {/* Info banner */}
          {mails.length > 0 && (
            <div style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "10px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: "4px",
              width: "100%",
              boxSizing: "border-box",
            }}>
              <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
              <p style={{ fontSize: "12px", color: "#ef4444", margin: 0, lineHeight: 1.45, wordBreak: "break-word", overflowWrap: "break-word" }}>
                These messages failed to send. Click a message to <strong>Retry</strong> or <strong>Discard</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Mail list */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}>
          {mails.length === 0 ? (
            <div style={{ padding: "80px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "44px", marginBottom: "16px", opacity: 0.35 }}>📤</div>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-bright)", marginBottom: "6px" }}>Outbox is clear</h3>
              <p style={{ color: "var(--text-dim)", fontSize: "13px", maxWidth: "260px", margin: "0 auto", lineHeight: 1.5 }}>
                All messages sent successfully.
              </p>
            </div>
          ) : (
            mails.map(mail => {
              const isRetryingThis = retrying.has(mail.id)
              const isSelected = selectedId === mail.id
              const originalSubject = mail.originalParams?.subject || mail.subject?.replace(/^⚠️ Failed: /, "") || "(No subject)"
              const recipient = mail.originalParams?.recipientEmail || mail.receiverEmail || "Unknown recipient"
              const formattedTime = mail.time && !isNaN(Date.parse(mail.time))
                ? new Date(mail.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "Queued"

              return (
                <div
                  key={mail.id}
                  onClick={() => setSelectedId(isSelected ? null : mail.id)}
                  className={`mail-row ${isSelected ? "selected" : ""}`}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--mail-row-border, #141414)",
                    cursor: "pointer",
                    background: isSelected ? "rgba(239,68,68,0.08)" : "transparent",
                    borderLeft: isSelected ? "3px solid #ef4444" : "3px solid transparent",
                    transition: "background 0.15s ease",
                    position: "relative",
                    minHeight: "56px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", minWidth: 0 }}>
                    {/* Avatar */}
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
                    }}>
                      {isRetryingThis
                        ? <RefreshCw size={15} color="#ef4444" style={{ animation: "spin 1s linear infinite" }} />
                        : <AlertTriangle size={15} color="#ef4444" />
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", width: "100%" }}>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-bright)", fontFamily: "Inter, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                          To: {recipient.split("@")[0]}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-dim)", flexShrink: 0, whiteSpace: "nowrap" }}>
                          {formattedTime}
                        </span>
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                        {originalSubject}
                      </div>
                      {mail.error && (
                        <div style={{ fontSize: "11px", color: "#ef4444", opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                          {mail.error}
                        </div>
                      )}
                    </div>

                    <ChevronRight size={14} color="var(--text-dim)" style={{ flexShrink: 0, opacity: isSelected ? 1 : 0.4 }} />
                  </div>
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
              padding: "32px 36px 40px",
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
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", width: "100%", minWidth: 0 }}>
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  background: "var(--mail-row-border, #141414)",
                  border: "1px solid var(--border-color, #1F1F1F)",
                  borderRadius: "50%",
                  width: "38px",
                  height: "38px",
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
                <ArrowLeft size={18} />
              </button>

              <h1
                className="mail-detail-subject"
                style={{
                  fontSize: "22px",
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
            <div style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              width: "100%",
              boxSizing: "border-box",
            }}>
              <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#ef4444", marginBottom: "4px" }}>
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
                  }}>
                    {selectedMail.error}
                  </div>
                )}
              </div>
            </div>

            {/* Metadata (To, CC, BCC, Time) */}
            <div className="mail-detail-meta" style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px", width: "100%" }}>
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
            <div style={{ display: "flex", gap: "10px", marginBottom: "32px", flexWrap: "wrap", width: "100%" }}>
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
