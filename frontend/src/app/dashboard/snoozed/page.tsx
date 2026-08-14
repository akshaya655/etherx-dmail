"use client"

import { useEffect, useState, useMemo } from "react"
import { Clock, ArrowLeft, Trash2, MailOpen } from "lucide-react"
import { subscribe, getMails, updateMailInStore, initMailStore } from "@/utils/mailStore"
import MailSkeleton from "@/components/MailSkeleton"
import MailRow from "@/components/MailRow"
import EmailBodyViewer from "@/components/EmailBodyViewer"

export default function SnoozedPage() {
  const [loading, setLoading] = useState(true)
  const [mails, setMails] = useState<any[]>([])
  const [selectedMail, setSelectedMail] = useState<any>(null)
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    if (!user.email) return

    setUserEmail(user.email)
    initMailStore(user.email)

    const updateMails = () => {
      const allSnoozed = getMails("snoozed")
      setMails(allSnoozed)
      setLoading(false)
    }

    updateMails()
    const unsub = subscribe(updateMails)
    return unsub
  }, [])

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg-body)", overflow: "hidden" }}>
      <div style={{
        width: selectedMail ? "360px" : "100%", display: "flex", flexDirection: "column", flexShrink: 0,
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)", maxWidth: selectedMail ? "360px" : "100%", margin: selectedMail ? "0" : "0 auto"
      }}>
        <div style={{ padding: "24px 24px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Clock size={24} color="var(--gold-mid)" />
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif" }}>Snoozed</h1>
                <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "2px 0 0 0" }}>Messages snoozed to reappear in your Inbox at a scheduled time</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <MailSkeleton />
          ) : mails.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-dim)" }}>
              No snoozed messages
            </div>
          ) : (
            mails.map(mail => (
              <MailRow
                key={mail.id}
                mail={mail}
                isSelected={selectedMail?.id === mail.id}
                onOpen={(m) => setSelectedMail(m)}
                onToggleSelection={() => {}}
                isSelectedInBulk={false}
                onToggleStar={(id, e) => {
                  e.stopPropagation()
                  updateMailInStore(id, { isStarred: !mail.isStarred })
                }}
              />
            ))
          )}
        </div>
      </div>

      {selectedMail && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-body)", padding: "32px 40px", borderLeft: "1px solid #141414", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
            <button onClick={() => setSelectedMail(null)} style={{ background: "none", border: "none", color: "var(--gold-mid)", cursor: "pointer" }}>
              <ArrowLeft size={20} />
            </button>
            <h1 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-bright)", margin: 0 }}>
              {selectedMail.subject}
            </h1>
          </div>

          <div style={{ padding: "16px", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: "10px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--gold-mid)", fontWeight: "600" }}>
              Snoozed until {selectedMail.snoozeUntil ? new Date(selectedMail.snoozeUntil).toLocaleString() : "scheduled time"}
            </span>
            <button
              onClick={() => {
                updateMailInStore(selectedMail.id, { status: "inbox", snoozeUntil: null })
                setSelectedMail(null)
              }}
              style={{ padding: "6px 14px", borderRadius: "6px", background: "var(--gold-mid)", border: "none", color: "#000", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
            >
              Unsnooze
            </button>
          </div>

          <EmailBodyViewer
            content={selectedMail.message}
            html={selectedMail.html}
            minHeight="250px"
            style={{ marginTop: "12px" }}
          />
        </div>
      )}
    </div>
  )
}
