"use client"

import { useEffect, useState, useMemo, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { decryptMessage, db, cleanMessage } from "@/utils/gun"
import { Star, Trash2, Mail, Reply, Forward, Lock, Search, ArrowLeft, Paperclip, Send, RefreshCw, Check, Tag } from "lucide-react"
import { subscribe, updateMailInStore, getMails, initMailStore } from "@/utils/mailStore"
import { getLabels, getMailLabels, toggleMailLabel, subscribeLabelStore, type Label } from "@/utils/labelStore"
import { useLabel } from "@/context/LabelContext"
import MailRow from "@/components/MailRow"
import EmailBodyViewer from "@/components/EmailBodyViewer"
import SearchFiltersPanel, { SearchFilters, emptyFilters } from "@/components/SearchFiltersPanel"

function SentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get("search") || ""
  const { activeLabelId, setActiveLabelId } = useLabel()
  
  const [mails, setMails] = useState<any[]>([])
  const [selectedMail, setSelectedMail] = useState<any>(null)
  const [userEmail, setUserEmail] = useState("")
  const [searchQuery, setSearchQuery] = useState(urlSearch)
  const [filters, setFilters] = useState<SearchFilters>({ ...emptyFilters(), query: urlSearch })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [userLabels, setUserLabels] = useState<Label[]>([])
  const [showLabelMenu, setShowLabelMenu] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.query), 300)
    return () => clearTimeout(timer)
  }, [filters.query])

  useEffect(() => {
    if (urlSearch) setSearchQuery(urlSearch)
  }, [urlSearch])

  useEffect(() => {
    if (typeof window === "undefined") return
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    if (user.email) {
      setUserEmail(user.email)
      initMailStore(user.email)
    }

    const updateMails = () => {
      setMails(getMails("sent"))
      setUserLabels(getLabels(user.email))
      setIsRefreshing(false)
    }
    updateMails()
    const unsub = subscribe(updateMails)
    const unsubLabels = subscribeLabelStore(updateMails)
    
    return () => {
      unsub()
      unsubLabels()
    }
  }, [])

  const currentSelectedMail = useMemo(() => {
    if (!selectedMail) return null
    return mails.find(m => m.id === selectedMail.id) || selectedMail
  }, [mails, selectedMail])

  const filteredMails = useMemo(() => {
    return mails
      .filter(m => {
        if (activeLabelId && !getMailLabels(userEmail, m.id).includes(activeLabelId)) return false
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase()
          return (
            m.subject?.toLowerCase().includes(q) ||
            m.receiverEmail?.toLowerCase().includes(q) ||
            m.message?.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        const getTime = (m: any) => m.time ? new Date(m.time).getTime() : 0
        return getTime(b) - getTime(a)
      })
  }, [mails, debouncedSearch, activeLabelId, userEmail])

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

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

  const openMail = (mail: any) => {
    setSelectedMail(mail)
    if (!mail.isRead) updateMailInStore(mail.id, { isRead: true })
  }

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const mail = mails.find(m => m.id === id)
    if (mail) {
      updateMailInStore(id, { isStarred: !mail.isStarred })
    }
  }

  const renderDetailView = () => {
    const mail = currentSelectedMail
    if (!mail) return null

    return (
      <div className="mail-detail-pane" style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-body)", padding: "32px 40px 40px", borderLeft: "1px solid #141414", position: "relative", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "28px" }}>
          <button
            onClick={() => setSelectedMail(null)}
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid #222", borderRadius: "50%",
              width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--gold-mid)", flexShrink: 0, marginTop: "4px", transition: "background 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
          >
            <ArrowLeft size={17} />
          </button>
          <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, flex: 1, lineHeight: 1.3, letterSpacing: "-0.3px" }}>
            {mail.subject || "(No subject)"}
          </h1>
        </div>

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
            {(mail.receiverName || mail.receiverEmail || "U").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-bright)", fontFamily: "Inter, sans-serif" }}>
                To: {mail.receiverName || mail.receiverEmail?.split("@")[0]}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-dim)", flexShrink: 0 }}>
                {mail.time && !isNaN(Date.parse(mail.time))
                  ? new Date(mail.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  : mail.time}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ opacity: 0.7 }}>{mail.senderEmail}</span>
              <span style={{ color: "var(--gold-mid)", opacity: 0.5 }}>→</span>
              <span style={{ opacity: 0.7 }}>{mail.receiverEmail}</span>
            </div>
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
        <div style={{ display: "flex", gap: "8px", marginBottom: "32px", position: "relative", flexWrap: "wrap" }}>
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
            style={{ background: "rgba(255,255,255,0.05)", color: mail.isStarred ? "var(--gold-mid)" : "var(--text-bright)", border: `1px solid ${mail.isStarred ? "rgba(212,175,55,0.4)" : "#222"}`, borderRadius: "8px", padding: "9px 14px", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }}
          ><Star size={15} fill={mail.isStarred ? "var(--gold-mid)" : "none"} strokeWidth={mail.isStarred ? 0 : 1.8} /></button>
          <button
            onClick={() => { updateMailInStore(mail.id, { status: "trash" }); setSelectedMail(null); }}
            style={{ background: "rgba(232,66,52,0.06)", color: "#e84234", border: "1px solid rgba(232,66,52,0.2)", borderRadius: "8px", padding: "9px 14px", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(232,66,52,0.12)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(232,66,52,0.06)"}
          ><Trash2 size={15} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <EmailBodyViewer content={mail.message} html={mail.html} />
        </div>
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
              <Send size={24} color="var(--gold-mid)" />
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif" }}>Sent</h1>
                <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "2px 0 0 0" }}>Messages sent to recipients</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {activeLabelId && (
                <button onClick={() => { setActiveLabelId(null); router.push("/dashboard/sent"); }} style={{ background: "rgba(212, 175, 55, 0.1)", color: "var(--gold-mid)", border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Clear Filter</button>
              )}
              <button 
                onClick={() => { 
                  setIsRefreshing(true); 
                  initMailStore(userEmail, true);
                  setTimeout(() => setIsRefreshing(false), 800);
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
                title="Refresh Sent Mail"
              >
                <RefreshCw size={18} style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }} />
              </button>
            </div>
          </div>
          
          <SearchFiltersPanel
            filters={filters}
            onChange={setFilters}
            onClear={() => setFilters(emptyFilters())}
            placeholder="Search sent mail..."
          />
        </div>

        <div style={{ 
          display: "flex", alignItems: "center", gap: "16px",
          padding: "12px 24px", borderBottom: "1px solid #141414",
          background: "rgba(255,255,255,0.02)"
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
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto" }}>
              <span style={{ fontSize: "12px", color: "var(--gold-mid)", fontWeight: "600" }}>{selectedIds.size} selected</span>
              <button onClick={handleBulkTrash} style={{ background: "rgba(232, 66, 52, 0.1)", color: "#e84234", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredMails.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-dim)" }}>No sent messages</div>
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
                        isSelected={selectedMail?.id === mail.id}
                        onOpen={openMail}
                        onToggleSelection={toggleSelection}
                        isSelectedInBulk={selectedIds.has(mail.id)}
                        onToggleStar={handleToggleStar}
                        showToRecipient={true}
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


export default function SentPage() {
  return (
    <Suspense fallback={null}>
      <SentPageContent />
    </Suspense>
  );
}
