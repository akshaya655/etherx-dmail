"use client"
import { memo, useState, useEffect } from "react"
import { Lock, Star, Check, Paperclip, Archive, Trash2, Mail, MailOpen, Clock } from "lucide-react"
import { cleanMessage } from "@/utils/gun"
import { updateMailInStore } from "@/utils/mailStore"
import { useToast } from "@/context/ToastContext"

interface MailRowProps {
  mail: any
  isSelected: boolean
  onOpen: (mail: any) => void
  onToggleSelection: (id: string, e: React.MouseEvent) => void
  isSelectedInBulk: boolean
  onToggleStar: (id: string, e: React.MouseEvent) => void
  layout?: string
  preview?: string
  showToRecipient?: boolean
  activeLabels?: any[]
  badge?: { label: string, color: string }
}

const getAvatarColor = (email: string = "default") => {
  const colors = [
    { bg: "#C5A059", text: "#000000" },
    { bg: "#3B82F6", text: "#FFFFFF" },
    { bg: "#10B981", text: "#FFFFFF" },
    { bg: "#EF4444", text: "#FFFFFF" },
    { bg: "#8B5CF6", text: "#FFFFFF" },
    { bg: "#F59E0B", text: "#000000" },
    { bg: "#EC4899", text: "#FFFFFF" },
    { bg: "#06B6D4", text: "#FFFFFF" },
    { bg: "#F97316", text: "#FFFFFF" },
    { bg: "#6366F1", text: "#FFFFFF" },
    { bg: "#14B8A6", text: "#FFFFFF" },
    { bg: "#A855F7", text: "#FFFFFF" },
  ]
  let hash = 0
  const str = email.toLowerCase()
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

const formatTime = (time: string) => {
  if (!time || isNaN(Date.parse(time))) return time || ""
  const d = new Date(time)
  const today = new Date()
  if (d.toLocaleDateString() === today.toLocaleDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (d.getFullYear() === today.getFullYear())
    return d.toLocaleDateString([], { month: "short", day: "numeric" })
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" })
}

const MailRow = memo(({
  mail,
  isSelected,
  onOpen,
  onToggleSelection,
  isSelectedInBulk,
  onToggleStar,
  layout = "comfortable",
  preview = "2lines",
  showToRecipient = false,
  activeLabels = [],
  badge
}: MailRowProps) => {
  const { showToast } = useToast()
  const [isHovered, setIsHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const isUnread = !mail.isRead
  const isCompact = layout === "compact"

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const nameToDisplay = showToRecipient
    ? (mail.receiverName || mail.receiverEmail?.split("@")[0] || "Unknown")
    : (mail.senderName || mail.senderEmail?.split("@")[0] || "Unknown")

  const senderInitial = nameToDisplay.charAt(0).toUpperCase()
  const avatarColors = getAvatarColor(mail.senderEmail || mail.senderName || mail.id || "default")

  const subject = mail.subject || "(No subject)"
  const snippet = preview !== "none" ? cleanMessage(mail.message || "").slice(0, 120) : ""
  const hasAttachment = mail.hasAttachments || mail.attachmentCount > 0

  const rowHeight = isCompact ? "44px" : "52px"

  // ─────────────────────────────────────────────────
  // Mobile: Compact two-line Gmail-style row
  // ─────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div
        onClick={() => onOpen(mail)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          padding: "10px 12px",
          borderBottom: "1px solid #141414",
          cursor: "pointer",
          position: "relative",
          background: isSelected
            ? "linear-gradient(90deg, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.06) 60%, rgba(212,175,55,0.02) 100%)"
            : isSelectedInBulk
            ? "rgba(212, 175, 55, 0.10)"
            : isUnread ? "rgba(255,255,255,0.02)" : "transparent",
          boxShadow: isSelected ? "inset 0 0 0 1px rgba(212,175,55,0.12)" : "none",
          userSelect: "none",
          minHeight: "62px",
          gap: "10px",
        }}
      >
        {/* Selected indicator bar */}
        {(isSelected || isSelectedInBulk) && (
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: isSelected ? "4px" : "3px",
            background: "var(--gold-mid)",
            boxShadow: isSelected ? "0 0 12px rgba(212,175,55,0.7)" : "none",
            zIndex: 2,
            borderRadius: "0 2px 2px 0"
          }} />
        )}

        {/* Avatar */}
        <div
          onClick={e => { e.stopPropagation(); onToggleSelection(mail.id, e) }}
          style={{
            width: "36px", height: "36px", borderRadius: "50%",
            background: isSelectedInBulk ? "var(--gold-mid)" : avatarColors.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: "800",
            color: isSelectedInBulk ? "var(--bg-body)" : avatarColors.text,
            flexShrink: 0, cursor: "pointer",
            border: isSelectedInBulk ? "2px solid var(--gold-mid)" : "2px solid transparent",
            marginTop: "1px",
          }}
        >
          {isSelectedInBulk ? <Check size={16} strokeWidth={4} /> : senderInitial}
        </div>

        {/* Main content: two lines */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
          {/* Line 1: Sender + timestamp */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <span style={{
              fontSize: "13px",
              fontWeight: isUnread ? "700" : "500",
              color: isUnread ? "var(--text-bright)" : "var(--text-muted)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, fontFamily: "Inter, sans-serif",
            }}>
              {showToRecipient ? "To: " : ""}{nameToDisplay}
              {mail.message?.includes("-----BEGIN PGP MESSAGE-----") && (
                <Lock size={10} color="var(--gold-mid)" style={{ marginLeft: "4px", display: "inline" }} />
              )}
            </span>
            <span style={{
              fontSize: "11px",
              fontWeight: isUnread ? "700" : "400",
              color: isUnread ? "var(--text-bright)" : "var(--text-dim)",
              whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {formatTime(mail.time)}
            </span>
          </div>

          {/* Line 2: Subject + snippet */}
          <div style={{
            fontSize: "13px",
            fontWeight: isUnread ? "600" : "400",
            color: isUnread ? "var(--text-bright)" : "var(--text-dim)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontFamily: "Inter, sans-serif",
          }}>
            {subject}
            {snippet && (
              <span style={{ fontWeight: "400", color: "var(--text-dim)", opacity: 0.7 }}>
                {" – "}{snippet}
              </span>
            )}
          </div>
        </div>

        {/* Star */}
        <button
          onClick={e => onToggleStar(mail.id, e)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "4px", flexShrink: 0,
            color: mail.isStarred ? "var(--gold-mid)" : "var(--text-dim)",
            opacity: mail.isStarred ? 1 : 0.4,
            display: "flex", alignItems: "flex-start", marginTop: "2px",
            minWidth: "32px", minHeight: "32px", justifyContent: "center",
          }}
        >
          <Star size={15} fill={mail.isStarred ? "var(--gold-mid)" : "none"} strokeWidth={mail.isStarred ? 0 : 1.5} />
        </button>

        {/* Unread dot */}
        {isUnread && (
          <div style={{
            position: "absolute", left: "6px", top: "50%", transform: "translateY(-50%)",
            width: "6px", height: "6px", borderRadius: "50%",
            background: "var(--gold-mid)", boxShadow: "0 0 6px rgba(212,175,55,0.6)",
          }} />
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────
  // Desktop: Original full-width single-line layout
  // ─────────────────────────────────────────────────
  return (
    <div
      onClick={() => onOpen(mail)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        height: rowHeight,
        padding: "0 16px",
        borderBottom: "1px solid #141414",
        cursor: "pointer",
        position: "relative",
        background: isSelected
          ? "linear-gradient(90deg, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.06) 60%, rgba(212,175,55,0.02) 100%)"
          : isSelectedInBulk
          ? "rgba(212, 175, 55, 0.10)"
          : isUnread ? "rgba(255,255,255,0.02)" : "transparent",
        boxShadow: isSelected ? "inset 0 0 0 1px rgba(212,175,55,0.12)" : "none",
        transition: "background 0.15s ease, box-shadow 0.15s ease",
        userSelect: "none",
      }}
    >
      {/* Selected indicator bar */}
      {(isSelected || isSelectedInBulk) && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: isSelected ? "4px" : "3px",
          background: "var(--gold-mid)",
          boxShadow: isSelected ? "0 0 12px rgba(212,175,55,0.7), 0 0 4px rgba(212,175,55,0.5)" : "none",
          zIndex: 2,
          borderRadius: "0 2px 2px 0"
        }} />
      )}

      {/* Unread dot */}
      <div style={{ width: "10px", flexShrink: 0, display: "flex", justifyContent: "center", marginRight: "6px" }}>
        {isUnread && (
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--gold-mid)", boxShadow: "0 0 6px rgba(212,175,55,0.6)", flexShrink: 0 }} />
        )}
      </div>

      {/* Avatar — click to bulk-select */}
      <div
        onClick={e => { e.stopPropagation(); onToggleSelection(mail.id, e) }}
        style={{
          width: "32px", height: "32px", borderRadius: "50%",
          background: isSelectedInBulk ? "var(--gold-mid)" : avatarColors.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", fontWeight: "800",
          color: isSelectedInBulk ? "var(--bg-body)" : avatarColors.text,
          flexShrink: 0, marginRight: "12px", cursor: "pointer",
          transition: "all 0.2s ease",
          border: isSelectedInBulk ? "2px solid var(--gold-mid)" : "2px solid transparent",
        }}
      >
        {isSelectedInBulk ? <Check size={16} strokeWidth={4} /> : senderInitial}
      </div>

      {/* Sender name */}
      <div style={{
        width: "160px", flexShrink: 0, marginRight: "12px",
        display: "flex", alignItems: "center", gap: "6px", overflow: "hidden"
      }}>
        <span style={{
          fontSize: "13px",
          fontWeight: isUnread ? "700" : "500",
          color: isUnread ? "var(--text-bright)" : "var(--text-muted)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          fontFamily: "Inter, sans-serif",
        }}>
          {showToRecipient ? "To: " : ""}{nameToDisplay}
        </span>
        {badge && (
          <span style={{
            fontSize: "9px", padding: "1px 5px", borderRadius: "5px",
            background: `${badge.color}22`, border: `1px solid ${badge.color}44`,
            color: badge.color, fontWeight: "800", textTransform: "uppercase", flexShrink: 0
          }}>{badge.label}</span>
        )}
        {mail.message?.includes("-----BEGIN PGP MESSAGE-----") && (
          <Lock size={11} color="var(--gold-mid)" style={{ flexShrink: 0 }} />
        )}
      </div>

      {/* Labels */}
      {activeLabels.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexShrink: 0, marginRight: "8px", maxWidth: "120px", overflow: "hidden" }}>
          {activeLabels.slice(0, 2).map(lbl => (
            <span key={lbl.id} style={{
              fontSize: "9px", padding: "1px 5px", borderRadius: "4px",
              background: `${lbl.color}22`, color: lbl.color,
              border: `1px solid ${lbl.color}44`,
              fontWeight: "700", textTransform: "uppercase", whiteSpace: "nowrap"
            }}>{lbl.name}</span>
          ))}
        </div>
      )}

      {/* Subject + preview snippet on ONE line */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", overflow: "hidden" }}>
        <span style={{
          fontSize: "13px",
          fontWeight: isUnread ? "600" : "400",
          color: isUnread ? "var(--text-bright)" : "var(--text-dim)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          fontFamily: "Inter, sans-serif",
        }}>
          {subject}
          {snippet && (
            <span style={{ fontWeight: "400", color: "var(--text-dim)", opacity: 0.65 }}>
              {" – "}{snippet}
            </span>
          )}
        </span>
      </div>

      {/* Attachment icon */}
      {hasAttachment && !isHovered && (
        <div style={{ flexShrink: 0, marginLeft: "8px", color: "var(--text-dim)", opacity: 0.6, display: "flex", alignItems: "center" }}>
          <Paperclip size={13} />
        </div>
      )}

      {/* Timestamp OR Quick Hover Action Buttons (Gmail-style) */}
      {isHovered ? (
        <div
          onClick={e => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "12px", flexShrink: 0 }}
        >
          {/* Snooze */}
          <div style={{ position: "relative" }}>
            <button
              title="Snooze"
              onClick={e => {
                e.stopPropagation()
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                tomorrow.setHours(8, 0, 0, 0)
                updateMailInStore(mail.id, { status: "snoozed", snoozeUntil: tomorrow.getTime() })
                showToast({
                  message: "Snoozed until tomorrow 8:00 AM",
                  actionLabel: "Undo",
                  onAction: () => updateMailInStore(mail.id, { status: "inbox", snoozeUntil: null })
                })
              }}
              style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "4px", padding: "5px", color: "var(--text-bright)", cursor: "pointer", display: "flex", alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.2)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
            >
              <Clock size={14} />
            </button>
          </div>

          {/* Archive */}
          <button
            title="Archive"
            onClick={e => {
              e.stopPropagation()
              const prevStatus = mail.status || "inbox"
              updateMailInStore(mail.id, { status: "archived" })
              showToast({
                message: "Conversation archived",
                actionLabel: "Undo",
                onAction: () => updateMailInStore(mail.id, { status: prevStatus })
              })
            }}
            style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "4px", padding: "5px", color: "var(--text-bright)", cursor: "pointer", display: "flex", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
          >
            <Archive size={14} />
          </button>

          {/* Delete / Trash */}
          <button
            title="Delete"
            onClick={e => {
              e.stopPropagation()
              const prevStatus = mail.status || "inbox"
              updateMailInStore(mail.id, { status: "trash" })
              showToast({
                message: "Conversation moved to Trash",
                actionLabel: "Undo",
                onAction: () => updateMailInStore(mail.id, { status: prevStatus })
              })
            }}
            style={{ background: "rgba(232,66,52,0.1)", border: "none", borderRadius: "4px", padding: "5px", color: "#e84234", cursor: "pointer", display: "flex", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(232,66,52,0.25)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(232,66,52,0.1)"}
          >
            <Trash2 size={14} />
          </button>

          {/* Mark Read/Unread */}
          <button
            title={isUnread ? "Mark as read" : "Mark as unread"}
            onClick={e => {
              e.stopPropagation()
              const newIsRead = !mail.isRead
              updateMailInStore(mail.id, { isRead: newIsRead })
              showToast({
                message: newIsRead ? "Marked as read" : "Marked as unread",
                actionLabel: "Undo",
                onAction: () => updateMailInStore(mail.id, { isRead: !newIsRead })
              })
            }}
            style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "4px", padding: "5px", color: "var(--text-bright)", cursor: "pointer", display: "flex", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
          >
            {isUnread ? <MailOpen size={14} /> : <Mail size={14} />}
          </button>
        </div>
      ) : (
        <div style={{
          width: "52px", flexShrink: 0, textAlign: "right", marginLeft: "12px",
          fontSize: "12px",
          fontWeight: isUnread ? "700" : "400",
          color: isUnread ? "var(--text-bright)" : "var(--text-dim)",
          whiteSpace: "nowrap",
        }}>
          {formatTime(mail.time)}
        </div>
      )}

      {/* Star */}
      <button
        onClick={e => onToggleStar(mail.id, e)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          marginLeft: "8px", padding: "4px", flexShrink: 0,
          color: mail.isStarred ? "var(--gold-mid)" : "var(--text-dim)",
          opacity: mail.isStarred ? 1 : 0.4,
          transition: "opacity 0.2s, transform 0.2s",
          display: "flex", alignItems: "center"
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1.15)" }}
        onMouseLeave={e => { e.currentTarget.style.opacity = mail.isStarred ? "1" : "0.4"; e.currentTarget.style.transform = "scale(1)" }}
      >
        <Star size={15} fill={mail.isStarred ? "var(--gold-mid)" : "none"} strokeWidth={mail.isStarred ? 0 : 1.5} />
      </button>
    </div>
  )
})

MailRow.displayName = "MailRow"
export default MailRow
