"use client"

import {
  Inbox, Send, FileText, AlertTriangle, Trash2,
  Star, Mail, Archive, Users, Settings,
  Plus, ChevronDown, LogOut, Tag, UserPlus, Clock
} from "lucide-react"

import { useEffect, useState, memo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { getCounts, subscribe } from "@/utils/mailStore"
import { getLabels, subscribeLabelStore, type Label } from "@/utils/labelStore"
import { useLabel } from "@/context/LabelContext"
// NetworkStatus is used internally but not shown in the sidebar UI
import Logo from "@/components/Logo"

interface SidebarProps {
  isOpen: boolean
  onClose?: () => void
  onCompose: () => void
}

function Sidebar({ isOpen, onClose, onCompose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const [counts, setCounts] = useState<{ inbox: number; starred: number; spam: number; drafts: number; request: number; sent: number; outbox: number; allUnread: number }>({ inbox: 0, starred: 0, spam: 0, drafts: 0, request: 0, sent: 0, outbox: 0, allUnread: 0 })
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [labels, setLabels] = useState<Label[]>([])
  const [labelsOpen, setLabelsOpen] = useState(true)
  const { activeLabelId, setActiveLabelId } = useLabel()

  useEffect(() => {
    if (typeof window === "undefined") return
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    if (!user.email) return

    setUserEmail(user.email)
    setUserName(user.name || user.email.split("@")[0])
    setCounts(getCounts(user.email))
    setLabels(getLabels(user.email))

    let throttleTimer: NodeJS.Timeout | null = null
    const throttledUpdate = () => {
      if (throttleTimer) return
      throttleTimer = setTimeout(() => {
        setCounts(getCounts(user.email))
        setLabels(getLabels(user.email))
        throttleTimer = null
      }, 500)
    }

    const onStorage = () => {
      const u = JSON.parse(localStorage.getItem("user") || "{}")
      if (u.email) setLabels(getLabels(u.email))
    }
    window.addEventListener("storage", onStorage)

    const unsub = subscribe(throttledUpdate)
    const unsubLabel = subscribeLabelStore(throttledUpdate)

    return () => {
      unsub()
      unsubLabel()
      if (throttleTimer) clearTimeout(throttleTimer)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("user")
    window.location.href = "/login"
  }

  const handleNavClick = () => {
    if (onClose) onClose()
  }

  const isActive = (segment: string) => pathname.includes(segment)

  const renderNavContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
      <div>
        <div style={{ padding: "8px 16px 20px" }}>
          <button title="Compose" suppressHydrationWarning onClick={() => { onCompose(); if (onClose) onClose(); }} className="compose-btn" style={{ 
            width: "100%", padding: "12px 24px", borderRadius: "16px",
            boxShadow: "var(--shadow-deep)"
          }}>
            <Plus size={24} style={{ color: "var(--bg-body)" }} />
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--bg-body)" }}>Compose</span>
          </button>
        </div>

        <nav className="nav-menu">
          <div className="nav-section-label">Mail</div>

          <Link title="Inbox" href="/dashboard/inbox" onClick={handleNavClick} className={`menu-link ${isActive("inbox") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <Inbox size={20} style={{ opacity: isActive("inbox") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Inbox</span>
              {counts.inbox > 0 && (
                <span className="count-badge" style={{ 
                  fontSize: "11px", fontWeight: "700",
                  background: isActive("inbox") ? "var(--gold-mid)" : "rgba(212, 175, 55,0.1)",
                  color: isActive("inbox") ? "var(--bg-body)" : "var(--gold-mid)",
                  padding: "2px 8px", borderRadius: "10px"
                }}>{counts.inbox}</span>
              )}
            </div>
          </Link>

          <Link title="Starred" href="/dashboard/starred" onClick={handleNavClick} className={`menu-link ${isActive("starred") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <Star size={20} style={{ opacity: isActive("starred") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Starred</span>
              {counts.starred > 0 && (
                <span className="count-badge" style={{ 
                  fontSize: "11px", fontWeight: "700",
                  background: "rgba(212, 175, 55,0.1)", color: "var(--gold-mid)",
                  padding: "2px 8px", borderRadius: "10px"
                }}>{counts.starred}</span>
              )}
            </div>
          </Link>

          <Link title="Important" href="/dashboard/important" onClick={handleNavClick} className={`menu-link ${isActive("important") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <AlertTriangle size={20} style={{ opacity: isActive("important") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Important</span>
            </div>
          </Link>

          <Link title="Sent" href="/dashboard/sent" onClick={handleNavClick} className={`menu-link ${isActive("sent") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <Send size={20} style={{ opacity: isActive("sent") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Sent</span>
            </div>
          </Link>

          <Link title="Drafts" href="/dashboard/drafts" onClick={handleNavClick} className={`menu-link ${isActive("drafts") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <FileText size={20} style={{ opacity: isActive("drafts") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Drafts</span>
              {counts.drafts > 0 && (
                <span className="count-badge" style={{ 
                  fontSize: "11px", fontWeight: "700",
                  background: "rgba(212, 175, 55,0.1)", color: "var(--gold-mid)",
                  padding: "2px 8px", borderRadius: "10px"
                }}>{counts.drafts}</span>
              )}
            </div>
          </Link>

          <Link title="Outbox" href="/dashboard/outbox" onClick={handleNavClick} className={`menu-link ${isActive("outbox") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <Clock size={20} style={{ opacity: isActive("outbox") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Outbox</span>
              {counts.outbox > 0 && (
                <span className="count-badge" style={{
                  fontSize: "11px", fontWeight: "700",
                  background: isActive("outbox") ? "var(--gold-mid)" : "rgba(212, 175, 55,0.1)",
                  color: isActive("outbox") ? "var(--bg-body)" : "var(--gold-mid)",
                  padding: "2px 8px", borderRadius: "10px"
                }}>{counts.outbox}</span>
              )}
            </div>
          </Link>

          <Link title="Requests" href="/dashboard/requests" onClick={handleNavClick} className={`menu-link ${isActive("requests") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <UserPlus size={20} style={{ opacity: isActive("requests") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Requests</span>
              {counts.request > 0 && (
                <span className="count-badge" style={{
                  fontSize: "11px", fontWeight: "700",
                  background: "rgba(212, 175, 55, 0.15)", color: "var(--gold-mid)",
                  padding: "2px 8px", borderRadius: "10px"
                }}>{counts.request}</span>
              )}
            </div>
          </Link>

          <Link title="All Mail" href="/dashboard/all-mail" onClick={handleNavClick} className={`menu-link ${isActive("all-mail") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <Mail size={20} style={{ opacity: isActive("all-mail") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>All Mail</span>
              {counts.allUnread > 0 && (
                <span className="count-badge" style={{ 
                  fontSize: "11px", fontWeight: "700",
                  background: isActive("all-mail") ? "var(--gold-mid)" : "rgba(212, 175, 55,0.1)",
                  color: isActive("all-mail") ? "var(--bg-body)" : "var(--gold-mid)",
                  padding: "2px 8px", borderRadius: "10px"
                }}>{counts.allUnread}</span>
              )}
            </div>
          </Link>

          <Link title="Snoozed" href="/dashboard/snoozed" onClick={handleNavClick} className={`menu-link ${isActive("snoozed") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <Clock size={20} style={{ opacity: isActive("snoozed") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Snoozed</span>
            </div>
          </Link>

          <Link title="Archive" href="/dashboard/archive" onClick={handleNavClick} className={`menu-link ${isActive("archive") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <Archive size={20} style={{ opacity: isActive("archive") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Archive</span>
            </div>
          </Link>

          <Link title="Spam" href="/dashboard/spam" onClick={handleNavClick} className={`menu-link ${isActive("spam") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <AlertTriangle size={20} style={{ opacity: isActive("spam") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Spam</span>
              {counts.spam > 0 && (
                <span className="count-badge" style={{
                  background: "#d93025", color: "#fff",
                  fontSize: "11px", padding: "2px 10px", borderRadius: "12px",
                  fontWeight: "800"
                }}>{counts.spam}</span>
              )}
            </div>
          </Link>

          <Link title="Trash" href="/dashboard/trash" onClick={handleNavClick} className={`menu-link ${isActive("trash") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <Trash2 size={20} style={{ opacity: isActive("trash") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Trash</span>
            </div>
          </Link>

          {/* Labels Section */}
          <div
            className="nav-section-label"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none", marginTop: "16px" }}
            onClick={() => setLabelsOpen(!labelsOpen)}
          >
            <span>Labels</span>
            <ChevronDown size={12} style={{ transform: labelsOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s ease" }} />
          </div>

          {labelsOpen && (
            <>
              {labels.map((label) => (
                <button
                  key={label.id}
                  onClick={() => { setActiveLabelId(activeLabelId === label.id ? null : label.id); handleNavClick(); }}
                  className={`menu-link ${activeLabelId === label.id ? "active" : ""}`}
                  style={{
                    background: activeLabelId === label.id ? `${label.color}15` : "none",
                    borderLeft: activeLabelId === label.id ? `3px solid ${label.color}` : "none",
                    color: activeLabelId === label.id ? label.color : "var(--text-muted)",
                  }}
                >
                  <div className="link-content" style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px" }}>
                    <Tag size={18} style={{ color: label.color }} />
                    <span style={{ fontWeight: activeLabelId === label.id ? 600 : 400, fontSize: "14px" }}>{label.name}</span>
                    {label.emoji && <span style={{ marginLeft: "auto", opacity: 0.8 }}>{label.emoji}</span>}
                  </div>
                </button>
              ))}

              <Link
                href="/dashboard/settings#labels"
                onClick={handleNavClick}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "5px 16px", fontSize: "11px",
                  color: "var(--gold-mid)", textDecoration: "none",
                  fontFamily: "Raleway, sans-serif", opacity: 0.8,
                }}
              >
                <Plus size={11} /> Manage Labels
              </Link>
            </>
          )}

          <div className="nav-section-label" style={{ marginTop: "24px" }}>More</div>

          <Link title="Contacts" href="/dashboard/contacts" onClick={handleNavClick} className={`menu-link ${isActive("contacts") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <Users size={20} style={{ opacity: isActive("contacts") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Contacts</span>
            </div>
          </Link>

          <Link title="Settings" href="/dashboard/settings" onClick={handleNavClick} className={`menu-link ${isActive("settings") ? "active" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "12px" }}>
              <Settings size={20} style={{ opacity: isActive("settings") ? 1 : 0.7 }} />
              <span style={{ flex: 1, fontSize: "14px" }}>Settings</span>
            </div>
          </Link>
        </nav>
      </div>

      <div style={{ marginTop: "auto", paddingTop: "16px" }}>

        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{userName}</div>
            <div className="sidebar-user-email">{userEmail}</div>
          </div>
        </div>

        <div className="sidebar-footer" style={{ marginTop: "8px" }}>
          <button suppressHydrationWarning className="logout-btn" onClick={() => setShowLogoutModal(true)}>
            <LogOut size={18} />
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside suppressHydrationWarning className={`sidebar hide-on-mobile ${isOpen ? "" : "closed"}`}>
        <div className="sidebar-top" style={{ height: "100%" }}>
          {renderNavContent()}
        </div>
      </aside>

      {/* Mobile Gmail-style Slide Drawer */}
      <div 
        className={`mobile-drawer-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      >
        <div className="mobile-drawer-content" onClick={e => e.stopPropagation()}>
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-gold)" }}>
            <Logo size={22} />
            <button suppressHydrationWarning onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}>
              ✕
            </button>
          </div>
          <div style={{ padding: "12px 0", flex: 1, overflowY: "auto" }}>
            {renderNavContent()}
          </div>
        </div>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "400px", textAlign: "center" }}>
            <h3 style={{ marginBottom: "12px", fontSize: "20px", fontWeight: "700" }}>Sign Out?</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "32px", lineHeight: 1.6 }}>
              You are about to sign out of your current session. Your credentials will remain saved in your vault.
            </p>
            <div className="modal-actions" style={{ display: "flex", gap: "12px" }}>
              <button suppressHydrationWarning className="btn-secondary" onClick={() => setShowLogoutModal(false)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button suppressHydrationWarning className="btn" onClick={handleLogout} style={{ flex: 1, background: "linear-gradient(135deg, var(--gold-rich), var(--gold-light))" }}>
                Confirm Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default memo(Sidebar)
