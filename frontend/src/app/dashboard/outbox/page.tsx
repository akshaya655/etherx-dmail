"use client"

import { useEffect, useState, useCallback } from "react"
import { subscribe, getMails, updateMailInStore, removeMailFromStore } from "@/utils/mailStore"
import {
  Send, RefreshCw, Trash2, AlertTriangle, RotateCcw,
  Clock, Mail, ChevronRight, X
} from "lucide-react"

export default function OutboxPage() {
  const [mails, setMails] = useState<any[]>([])
  const [retrying, setRetrying] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const load = () => setMails(getMails("outbox"))
    load()
    const unsub = subscribe(load)
    return () => unsub()
  }, [])

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
    <div style={{ display: "flex", height: "100%", background: "var(--bg-body)", overflow: "hidden" }}>

      {/* ── List Panel ── */}
      <div style={{
        width: selectedMail ? "380px" : "100%",
        display: "flex", flexDirection: "column", flexShrink: 0,
        transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
        maxWidth: selectedMail ? "380px" : "100%",
        margin: selectedMail ? "0" : "0 auto",
        borderRight: selectedMail ? "1px solid var(--border-color)" : "none",
      }}>
        {/* Header */}
        <div style={{ padding: "24px 24px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Send size={24} color="var(--gold-mid)" />
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif" }}>Outbox</h1>
                <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "2px 0 0 0" }}>Messages queued for dispatch</p>
              </div>
            </div>
          </div>

          {/* Info banner */}
          {mails.length > 0 && (
            <div style={{
              background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: "10px", padding: "12px 16px",
              display: "flex", alignItems: "flex-start", gap: "10px",
              marginBottom: "8px"
            }}>
              <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }} />
              <p style={{ fontSize: "12px", color: "#ef4444", margin: 0, lineHeight: 1.5 }}>
                These messages failed to send. Click <strong>Retry</strong> to attempt resend, or <strong>Discard</strong> to remove them.
              </p>
            </div>
          )}
        </div>

        {/* Mail list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {mails.length === 0 ? (
            <div style={{ padding: "80px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>📤</div>
              <p style={{ color: "var(--text-dim)", fontSize: "14px" }}>All messages sent successfully.</p>
            </div>
          ) : (
            mails.map(mail => {
              const isRetryingThis = retrying.has(mail.id)
              const isSelected = selectedId === mail.id
              const originalSubject = mail.originalParams?.subject || mail.subject?.replace(/^⚠️ Failed: /, "") || "(No subject)"
              const recipient = mail.originalParams?.recipientEmail || mail.receiverEmail || "Unknown recipient"

              return (
                <div
                  key={mail.id}
                  onClick={() => setSelectedId(isSelected ? null : mail.id)}
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border-color)",
                    cursor: "pointer",
                    background: isSelected ? "rgba(239,68,68,0.04)" : "transparent",
                    borderLeft: isSelected ? "3px solid #ef4444" : "3px solid transparent",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    {/* Avatar */}
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                      background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isRetryingThis
                        ? <RefreshCw size={16} color="#ef4444" style={{ animation: "spin 1s linear infinite" }} />
                        : <AlertTriangle size={16} color="#ef4444" />
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-bright)", fontFamily: "Inter, sans-serif" }}>
                          To: {recipient.split("@")[0]}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-dim)", flexShrink: 0, marginLeft: "8px" }}>
                          {mail.time && !isNaN(Date.parse(mail.time))
                            ? new Date(mail.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "Unknown time"}
                        </span>
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "4px" }}>
                        {originalSubject}
                      </div>
                      {mail.error && (
                        <div style={{ fontSize: "11px", color: "#ef4444", opacity: 0.8 }}>
                          {mail.error.slice(0, 60)}{mail.error.length > 60 ? "…" : ""}
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
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            background: "var(--bg-body)", padding: "40px",
            overflowY: "auto"
          }}>
            {/* Back button (mobile) */}
            <button
              onClick={() => setSelectedId(null)}
              style={{
                display: "none", // shown via media query override
                background: "none", border: "none", color: "var(--text-dim)",
                cursor: "pointer", fontSize: "13px", marginBottom: "24px",
                alignItems: "center", gap: "6px"
              }}
            >
              ← Back
            </button>

            {/* Failed banner */}
            <div style={{
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "12px", padding: "16px 20px", marginBottom: "32px",
              display: "flex", alignItems: "center", gap: "12px"
            }}>
              <AlertTriangle size={20} color="#ef4444" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#ef4444", marginBottom: "4px" }}>
                  Message failed to send
                </div>
                {selectedMail.error && (
                  <div style={{ fontSize: "12px", color: "#ef4444", opacity: 0.75, fontFamily: "monospace" }}>
                    {selectedMail.error}
                  </div>
                )}
              </div>
            </div>

            {/* Subject */}
            <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-bright)", margin: "0 0 24px", fontFamily: "Inter, sans-serif" }}>
              {originalSubject}
            </h1>

            {/* Metadata */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "40px", textTransform: "uppercase" }}>To</span>
                <span style={{ fontSize: "13px", color: "var(--text-bright)", background: "var(--bg-deep)", padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>{recipient}</span>
              </div>
              {ccList && (
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "40px", textTransform: "uppercase" }}>CC</span>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{ccList}</span>
                </div>
              )}
              {bccList && (
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "40px", textTransform: "uppercase" }}>BCC</span>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{bccList}</span>
                </div>
              )}
              {selectedMail.time && (
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", width: "40px", textTransform: "uppercase" }}>At</span>
                  <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>{new Date(selectedMail.time).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "40px", flexWrap: "wrap" }}>
              <button
                onClick={() => handleRetry(selectedMail)}
                disabled={isRetryingThis}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  background: isRetryingThis ? "rgba(160,114,10,0.1)" : "var(--gold-mid)",
                  color: isRetryingThis ? "var(--gold-mid)" : "#fff",
                  border: `1px solid ${isRetryingThis ? "var(--gold-mid)" : "transparent"}`,
                  padding: "10px 24px", borderRadius: "8px",
                  fontSize: "13px", fontWeight: "700", cursor: isRetryingThis ? "not-allowed" : "pointer",
                  transition: "all 0.15s"
                }}
              >
                {isRetryingThis
                  ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> Retrying…</>
                  : <><RotateCcw size={15} /> Retry Send</>
                }
              </button>

              <button
                onClick={() => handleRetry(selectedMail)}
                disabled={isRetryingThis}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  background: "var(--bg-deep)", color: "var(--text-bright)",
                  border: "1px solid var(--border-color)",
                  padding: "10px 20px", borderRadius: "8px",
                  fontSize: "13px", fontWeight: "600", cursor: isRetryingThis ? "not-allowed" : "pointer",
                }}
              >
                <Send size={15} /> Send Again
              </button>

              <button
                onClick={() => handleDiscard(selectedMail.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  background: "rgba(239,68,68,0.08)", color: "#ef4444",
                  border: "1px solid rgba(239,68,68,0.2)",
                  padding: "10px 20px", borderRadius: "8px",
                  fontSize: "13px", fontWeight: "600", cursor: "pointer",
                }}
              >
                <Trash2 size={15} /> Discard
              </button>
            </div>

            {/* Message preview */}
            {selectedMail.originalParams?.message && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                  Message Preview
                </div>
                <div style={{
                  background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "10px",
                  padding: "20px", fontSize: "14px", lineHeight: "1.7",
                  color: "var(--text-muted)", whiteSpace: "pre-wrap", fontFamily: "Inter, sans-serif"
                }}>
                  {selectedMail.originalParams.message.slice(0, 800)}
                  {selectedMail.originalParams.message.length > 800 ? "…" : ""}
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
