"use client"

import { useEffect, useState, useRef, memo } from "react"
import { useRouter } from "next/navigation"
import { subscribe, getMails, getAllRaw } from "@/utils/mailStore"
import AccountSwitcher from "@/components/AccountSwitcher"
import Logo from "@/components/Logo"
import { getSavedAccounts, getAvatarColor } from "@/utils/accounts"

import { Search, Menu, X } from "lucide-react"

interface HeaderProps {
  onToggle: () => void
  onCompose?: () => void
}

interface SearchResult {
  id: string
  subject: string
  senderEmail: string
  receiverEmail: string
  time: string
  status: string
  snippet: string
  isReply?: boolean
  isForward?: boolean
}

function Header({ onToggle }: HeaderProps) {
  const router = useRouter()

  const [currentUser, setCurrentUser] = useState<any>({})
  const [unreadCount, setUnreadCount] = useState(0)
  const [, setSearchFocused] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [nodeStatus, setNodeStatus] = useState<"active" | "connecting">("active")
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false)
  const [, setAccountCount] = useState(0)
  // Mobile search overlay state
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [mobileSearchQuery, setMobileSearchQuery] = useState("")
  const [mobileSearchResults, setMobileSearchResults] = useState<SearchResult[]>([])

  const searchRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)

  const updateUserInfo = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    setCurrentUser(user)
    if (user.email) {
      const storedPhoto = localStorage.getItem(`profile_photo_${user.email}`)
      setProfilePhoto(storedPhoto || null)
    } else {
      setProfilePhoto(null)
    }
  }

  useEffect(() => {
    updateUserInfo()
    document.documentElement.setAttribute("data-theme", "dark")

    const handleStorage = () => updateUserInfo()
    window.addEventListener("storage", handleStorage)
    window.addEventListener("focus", handleStorage)

    const interval = setInterval(async () => {
      try {
        const { checkGunServer } = await import("@/utils/gun")
        const res = await checkGunServer()
        setNodeStatus(res.reachable ? "active" : "connecting")
      } catch {
        setNodeStatus("connecting")
      }
    }, 10000)

    return () => {
      clearInterval(interval)
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("focus", handleStorage)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const updateUnread = () => {
      const inbox = getMails("inbox")
      setUnreadCount(inbox.filter((m: any) => !m.isRead).length)
    }
    updateUnread()
    const unsub = subscribe(updateUnread)
    return unsub
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    const all = getAllRaw()
    const q = searchQuery.toLowerCase()
    const filtered = all.filter(m => 
      m.subject?.toLowerCase().includes(q) ||
      m.senderEmail?.toLowerCase().includes(q) ||
      m.receiverEmail?.toLowerCase().includes(q) ||
      m.message?.toLowerCase().includes(q) ||
      m.id?.toLowerCase().includes(q) ||
      m.time?.toLowerCase().includes(q)
    ).slice(0, 8) 

    setSearchResults(filtered.map(m => ({
      id: m.id,
      subject: m.subject || "(No Subject)",
      senderEmail: m.senderEmail,
      receiverEmail: m.receiverEmail,
      time: m.time,
      status: m.status,
      snippet: m.message?.slice(0, 50) || ""
    })))
    setShowResults(true)
  }, [searchQuery])

  // Mobile search effect
  useEffect(() => {
    if (!mobileSearchQuery.trim()) {
      setMobileSearchResults([])
      return
    }
    const all = getAllRaw()
    const q = mobileSearchQuery.toLowerCase()
    const filtered = all.filter(m =>
      m.subject?.toLowerCase().includes(q) ||
      m.senderEmail?.toLowerCase().includes(q) ||
      m.receiverEmail?.toLowerCase().includes(q) ||
      m.message?.toLowerCase().includes(q) ||
      m.id?.toLowerCase().includes(q) ||
      m.time?.toLowerCase().includes(q)
    ).slice(0, 8)
    setMobileSearchResults(filtered.map(m => ({
      id: m.id,
      subject: m.subject || "(No Subject)",
      senderEmail: m.senderEmail,
      receiverEmail: m.receiverEmail,
      time: m.time,
      status: m.status,
      snippet: m.message?.slice(0, 50) || ""
    })))
  }, [mobileSearchQuery])

  // Auto-focus mobile search input when overlay opens
  useEffect(() => {
    if (showMobileSearch) {
      setTimeout(() => mobileInputRef.current?.focus(), 100)
    } else {
      setMobileSearchQuery("")
      setMobileSearchResults([])
    }
  }, [showMobileSearch])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
        setSearchFocused(false)
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setShowAccountSwitcher(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false)
    setSearchQuery("")
    router.push(`/dashboard/inbox?highlight=${result.id}`)
  }

  const handleMobileResultClick = (result: SearchResult) => {
    setShowMobileSearch(false)
    router.push(`/dashboard/inbox?highlight=${result.id}`)
  }

  return (
    <>
      {/* ── Mobile Search Overlay ────────────────────────────────── */}
      {showMobileSearch && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
            display: "flex", flexDirection: "column",
            padding: "16px"
          }}
        >
          {/* Search input row */}
          <div style={{
            display: "flex", alignItems: "center", gap: "12px",
            background: "var(--bg-input)", border: "1px solid var(--gold-mid)",
            borderRadius: "12px", padding: "0 16px", height: "48px",
          }}>
            <Search size={18} color="var(--gold-mid)" />
            <input
              ref={mobileInputRef}
              suppressHydrationWarning
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: "var(--text-bright)", fontSize: "15px",
                fontFamily: "Inter, sans-serif"
              }}
              placeholder="Search mail, contacts..."
              value={mobileSearchQuery}
              onChange={(e) => setMobileSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowMobileSearch(false)
                  router.push(`/dashboard/inbox?search=${encodeURIComponent(mobileSearchQuery)}`)
                }
                if (e.key === "Escape") setShowMobileSearch(false)
              }}
            />
            <button
              onClick={() => setShowMobileSearch(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-dim)", padding: "4px",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Results */}
          {mobileSearchResults.length > 0 && (
            <div style={{
              marginTop: "12px", background: "var(--bg-card)",
              border: "1px solid var(--border-color)", borderRadius: "12px",
              overflow: "hidden"
            }}>
              {mobileSearchResults.map((r) => (
                <div
                  key={r.id}
                  onClick={() => handleMobileResultClick(r)}
                  style={{ padding: "14px 16px", cursor: "pointer", borderBottom: "1px solid #1F1F1F" }}
                >
                  <div style={{ fontSize: "14px", color: "var(--text-bright)", fontWeight: "600" }}>{r.subject}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "2px" }}>{r.senderEmail}</div>
                </div>
              ))}
            </div>
          )}

          {mobileSearchQuery.trim() && mobileSearchResults.length === 0 && (
            <div style={{
              marginTop: "24px", textAlign: "center",
              color: "var(--text-dim)", fontSize: "14px"
            }}>
              No results found for &ldquo;{mobileSearchQuery}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* ── Main Header ─────────────────────────────────────────── */}
      <header className="header" suppressHydrationWarning style={{ height: "64px", borderBottom: "1px solid var(--border-gold)", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="header-left" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            suppressHydrationWarning
            onClick={onToggle}
            style={{
              background: "none", border: "none", color: "var(--gold-mid)",
              cursor: "pointer", padding: "8px", borderRadius: "8px",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
            title="Toggle Navigation Menu"
          >
            <Menu size={22} />
          </button>
          <Logo size={24} />
        </div>

        {/* ── Desktop: full search bar (hidden on mobile via CSS) ── */}
        <div className="header-middle header-search-desktop" style={{ flex: 1, display: "flex", justifyContent: "center", position: "relative" }}>
          <div ref={searchRef} style={{ width: "100%", maxWidth: "580px", position: "relative" }}>
            <div style={{
              display: "flex", alignItems: "center",
              background: "var(--bg-input)", border: "1px solid var(--border-color)",
              borderRadius: "10px", height: "40px", padding: "0 16px",
              transition: "all 0.2s ease"
            }}>
              <Search size={16} color="var(--text-dim)" />
              <input
                suppressHydrationWarning={true}
                ref={inputRef}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "var(--text-bright)", fontSize: "14px", marginLeft: "12px",
                  fontFamily: "Inter, sans-serif"
                }}
                placeholder="Search mail, contacts, attachments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setShowResults(false)
                    router.push(`/dashboard/inbox?search=${encodeURIComponent(searchQuery)}`)
                  }
                }}
                onFocus={() => setSearchFocused(true)}
              />
            </div>
            
            {showResults && searchResults.length > 0 && (
               <div style={{
                 position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
                 background: "var(--bg-card)", border: "1px solid var(--border-color)",
                 borderRadius: "10px", overflow: "hidden", zIndex: 1000,
                 boxShadow: "var(--shadow-deep)"
               }}>
                 {searchResults.map((r) => (
                   <div 
                     key={r.id} 
                     onClick={() => handleResultClick(r)}
                     style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #1F1F1F" }}
                   >
                     <div style={{ fontSize: "13px", color: "var(--text-bright)", fontWeight: "600" }}>{r.subject}</div>
                     <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{r.senderEmail}</div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>

        {/* ── Mobile: search icon (visible on mobile only via CSS) ── */}
        <button
          suppressHydrationWarning
          className="header-search-mobile-btn"
          onClick={() => setShowMobileSearch(true)}
          style={{
            background: "none", border: "none", color: "var(--gold-mid)",
            cursor: "pointer", padding: "10px", borderRadius: "8px",
            display: "none", /* shown via CSS on mobile */
            alignItems: "center", justifyContent: "center",
            minWidth: "44px", minHeight: "44px"
          }}
          title="Search"
          aria-label="Open search"
        >
          <Search size={22} />
        </button>

        <div className="header-right" suppressHydrationWarning style={{ 
          flex: 1, 
          display: "flex", 
          justifyContent: "flex-end", 
          alignItems: "center", 
          gap: "24px",
          paddingLeft: "20px"
        }}>
          
          {/* Node Status Badge — hidden on mobile */}
          <div className="header-desktop-only" style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "var(--bg-hover)", border: "1px solid var(--border-gold)",
            padding: "6px 14px", borderRadius: "10px",
            transition: "all 0.3s ease",
            marginRight: "4px"
          }}>
            <div style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: nodeStatus === "active" ? "var(--gold-mid)" : "#E84234",
              boxShadow: nodeStatus === "active" ? "0 0 10px var(--gold-mid)" : "none"
            }} />
            <span style={{ 
              fontSize: "11px", fontWeight: "800", color: "var(--gold-mid)", 
              letterSpacing: "0.5px", textTransform: "uppercase" 
            }}>
              {nodeStatus === "active" ? "Active" : "Syncing"}
            </span>
          </div>


          {/* Notifications bell — hidden on mobile */}

          <button 
            suppressHydrationWarning
            className="header-icon-btn header-desktop-only"
            style={{ 
              background: "rgba(255, 255, 255, 0.04)", 
              border: "1px solid rgba(255, 255, 255, 0.02)", 
              cursor: "pointer", 
              color: "var(--text-muted)", position: "relative",
              width: "36px", height: "36px", borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
            }}
          >
            <span style={{ fontSize: "16px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))", transform: "translateY(-1px)" }}>🔔</span>
            {unreadCount > 0 && (
              <div style={{
                position: "absolute", top: "-4px", right: "-4px",
                minWidth: "18px", height: "18px", borderRadius: "9px",
                background: "#D93025", border: "2px solid var(--bg-header)",
                color: "#FFF", fontSize: "10px", fontWeight: "800",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 4px", boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
              }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </div>
            )}
          </button>

          {/* Profile Avatar — always visible */}
          <div ref={accountRef} style={{ position: "relative" }}>
            <button
              suppressHydrationWarning
              onClick={() => {
                setShowAccountSwitcher((prev) => !prev)
                setAccountCount(getSavedAccounts().length)
              }}
              title="Switch account"
              style={{ 
                background: "none", border: "none", cursor: "pointer", padding: "0", 
                position: "relative", display: "flex", alignItems: "center",
                minWidth: "44px", minHeight: "44px", justifyContent: "center"
              }}
            >
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Avatar"
                  style={{
                    width: "32px", height: "32px", borderRadius: "50%",
                    objectFit: "cover",
                    border: showAccountSwitcher ? "2px solid var(--gold-mid)" : "1px solid var(--border-gold)"
                  }}
                />
              ) : (
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  background: currentUser.email
                    ? getAvatarColor(currentUser.email)
                    : "linear-gradient(135deg, var(--gold-rich), var(--gold-light))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: "800", color: "var(--bg-body)",
                  border: showAccountSwitcher ? "2px solid var(--gold-mid)" : "1px solid var(--border-color)"
                }}>
                  {(currentUser.email || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {showAccountSwitcher && (
              <AccountSwitcher onClose={() => setShowAccountSwitcher(false)} />
            )}
          </div>
        </div>
      </header>
    </>
  )
}

export default memo(Header)
