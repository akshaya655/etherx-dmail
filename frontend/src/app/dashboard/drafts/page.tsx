"use client"

import { useEffect, useState, useMemo, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cleanMessage } from "@/utils/gun"
import {
  Star, Trash2, Mail, Edit3, Lock, Search, ArrowLeft,
  Paperclip, Send, RefreshCw, Check, Clock
} from "lucide-react"

interface Draft {
  id: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  message: string
  savedAt: string
  attachmentNames?: { name: string; size: string; type: string; cid?: string }[]
}

function DraftsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get("search") || ""

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null)
  const [searchQuery, setSearchQuery] = useState(urlSearch)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (urlSearch) setSearchQuery(urlSearch)
  }, [urlSearch])

  const loadDrafts = () => {
    if (typeof window === "undefined") return
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    if (!user.email) return
    const stored = localStorage.getItem(`drafts_${user.email}`)
    setDrafts(stored ? JSON.parse(stored) : [])
  }

  useEffect(() => {
    loadDrafts()
  }, [])

  const deleteDraft = (id: string) => {
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    const updated = drafts.filter((d) => d.id !== id)
    localStorage.setItem(`drafts_${user.email}`, JSON.stringify(updated))
    setDrafts(updated)
    if (selectedDraft?.id === id) setSelectedDraft(null)
  }

  const filteredDrafts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return drafts
      .filter((d) =>
        (d.subject?.toLowerCase() || "").includes(q) ||
        (d.to?.toLowerCase() || "").includes(q) ||
        (d.message?.toLowerCase() || "").includes(q)
      )
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
  }, [drafts, searchQuery])

  const handleToggleSelectAll = () => {
    if (selectedIds.size > 0 && selectedIds.size === filteredDrafts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredDrafts.map(d => d.id)))
    }
  }

  const isAllSelected = filteredDrafts.length > 0 && selectedIds.size === filteredDrafts.length

  const handleBulkTrash = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    const updated = drafts.filter((d) => !selectedIds.has(d.id))
    localStorage.setItem(`drafts_${user.email}`, JSON.stringify(updated))
    setDrafts(updated)
    setSelectedIds(new Set())
    setSelectedDraft(null)
  }

  /**
   * Opens a draft in the compose window.
   * Passes draftId in the URL so ComposeWindow can update-in-place instead of creating a new draft.
   * Does NOT delete the draft here — ComposeWindow handles deletion on send.
   */
  const openInCompose = (draft: Draft) => {
    const params = new URLSearchParams()
    if (draft.to) params.set("to", draft.to)
    if (draft.cc) params.set("cc", draft.cc)
    if (draft.bcc) params.set("bcc", draft.bcc)
    if (draft.subject) params.set("subject", draft.subject)
    if (draft.message) params.set("message", draft.message)
    // Pass draftId so compose window can update-in-place
    params.set("draftId", draft.id)
    router.push(`/dashboard/compose?${params.toString()}`)
  }

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  const renderDraftRow = (draft: Draft) => {
    const isSelected = selectedDraft?.id === draft.id
    const isRowChecked = selectedIds.has(draft.id)
    const recipientName = draft.to?.split("@")[0] || "Draft"
    const hasAttachments = (draft.attachmentNames?.length || 0) > 0

    return (
      <div
        key={draft.id}
        onClick={() => setSelectedDraft(draft)}
        style={{
          display: "flex", alignItems: "center", padding: "16px 20px",
          borderBottom: "1px solid var(--border-color)", cursor: "pointer",
          position: "relative",
          background: isSelected || isRowChecked ? "rgba(232, 66, 52, 0.04)" : "transparent",
          borderLeft: isSelected ? "3px solid #e84234" : "3px solid transparent",
          transition: "all 0.15s ease"
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)" }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isRowChecked ? "rgba(232, 66, 52, 0.04)" : "transparent" }}
      >
        {/* Profile Avatar / Selection Trigger */}
        <div
          onClick={(e) => { e.stopPropagation(); toggleSelection(draft.id, e) }}
          style={{
            width: "40px", height: "40px", borderRadius: "50%",
            background: isRowChecked ? "#e84234" : "rgba(232, 66, 52, 0.08)",
            border: `2px solid ${isRowChecked ? "#e84234" : "rgba(232,66,52,0.2)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: "700",
            color: isRowChecked ? "#fff" : "#e84234",
            marginRight: "16px", flexShrink: 0,
            cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        >
          {isRowChecked ? <Check size={18} strokeWidth={3} /> : "D"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{
              fontSize: "13px", fontWeight: "700", color: "#e84234",
              fontFamily: "Inter, sans-serif",
              display: "flex", alignItems: "center", gap: "6px"
            }}>
              Draft to: {recipientName}
              {hasAttachments && <Paperclip size={11} />}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-dim)", flexShrink: 0 }}>
              {draft.savedAt}
            </span>
          </div>
          <div style={{
            fontSize: "13px", fontWeight: "600", color: "var(--text-bright)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {draft.subject || "(No subject)"}
          </div>
          <div style={{
            fontSize: "12px", color: "var(--text-dim)", marginTop: "2px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {cleanMessage(draft.message || "").slice(0, 70)}
          </div>
        </div>
      </div>
    )
  }

  const renderDetailView = () => {
    if (!selectedDraft) return null
    const hasAttachments = (selectedDraft.attachmentNames?.length || 0) > 0

    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-body)", padding: "40px", borderLeft: "1px solid var(--border-color)", position: "relative", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
          <button
            onClick={() => setSelectedDraft(null)}
            style={{
              background: "var(--bg-deep)", border: "1px solid var(--border-color)", borderRadius: "50%",
              width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--text-muted)", flexShrink: 0
            }}
          >
            <ArrowLeft size={18} />
          </button>

          <h1 style={{
            fontSize: "22px", fontWeight: "700", color: "var(--text-bright)",
            margin: 0, fontFamily: "Inter, sans-serif", flex: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {selectedDraft.subject || "(No subject)"}
          </h1>
        </div>

        {/* Sender info */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%",
            background: "rgba(232, 66, 52, 0.08)", border: "1px solid rgba(232, 66, 52, 0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", fontWeight: "800", color: "#e84234", marginRight: "16px", flexShrink: 0
          }}>
            D
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ fontSize: "15px", fontWeight: "700", color: "#e84234" }}>Local Draft</span>
              <span style={{ fontSize: "12px", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Clock size={11} /> {selectedDraft.savedAt}
              </span>
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-dim)" }}>
              To: <strong style={{ color: "var(--text-bright)" }}>{selectedDraft.to || "(No recipient)"}</strong>
              {selectedDraft.cc && <span> · CC: {selectedDraft.cc}</span>}
              {selectedDraft.bcc && <span> · BCC: {selectedDraft.bcc}</span>}
            </div>
          </div>
        </div>

        {/* Draft status banner */}
        <div style={{
          background: "rgba(232, 66, 52, 0.04)", border: "1px solid rgba(232, 66, 52, 0.12)",
          borderRadius: "8px", padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px",
          marginBottom: "28px"
        }}>
          <Lock size={13} color="#e84234" />
          <span style={{ fontSize: "12px", color: "#e84234", fontWeight: "600" }}>Unencrypted Local Draft</span>
          <p style={{ fontSize: "11px", color: "var(--text-dim)", margin: 0, flex: 1, textAlign: "right" }}>
            Resuming will encrypt before sending.
          </p>
        </div>

        {/* Attachment names */}
        {hasAttachments && (
          <div style={{ marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {selectedDraft.attachmentNames!.map((att, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "var(--bg-deep)", border: "1px solid var(--border-color)",
                padding: "4px 10px", borderRadius: "6px", fontSize: "12px", color: "var(--text-muted)"
              }}>
                <Paperclip size={11} />
                <span style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {att.name}
                </span>
                <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>{att.size}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "36px" }}>
          <button
            onClick={() => openInCompose(selectedDraft)}
            style={{
              background: "var(--gold-mid)", color: "#fff", border: "none", borderRadius: "8px",
              padding: "10px 24px", fontSize: "13px", fontWeight: "700", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px",
              boxShadow: "0 2px 8px rgba(160,114,10,0.25)"
            }}
          >
            <Edit3 size={15} /> Resume Draft
          </button>
          <button
            onClick={() => deleteDraft(selectedDraft.id)}
            style={{
              background: "var(--bg-deep)", color: "var(--text-muted)", border: "1px solid var(--border-color)", borderRadius: "8px",
              padding: "10px 20px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px"
            }}
          >
            <Trash2 size={15} /> Discard
          </button>
        </div>

        {/* Message body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{
            color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.7",
            whiteSpace: "pre-wrap", fontFamily: "Inter, sans-serif",
          }}>
            {selectedDraft.message || "(No body content)"}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg-body)", overflow: "hidden" }}>
      <div style={{
        width: selectedDraft ? "380px" : "100%",
        display: "flex", flexDirection: "column", flexShrink: 0,
        transition: "width 0.3s ease",
        maxWidth: selectedDraft ? "380px" : "100%",
        margin: selectedDraft ? "0" : "0 auto",
        borderRight: selectedDraft ? "1px solid var(--border-color)" : "none",
      }}>
        <div style={{ padding: "24px 24px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Edit3 size={24} color="var(--gold-mid)" />
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif" }}>Drafts</h1>
                <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "2px 0 0 0" }}>Saved message drafts</p>
              </div>
            </div>
            <button
              onClick={() => { setIsRefreshing(true); loadDrafts(); setTimeout(() => setIsRefreshing(false), 800) }}
              style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", display: "flex", alignItems: "center", transition: "color 0.2s, transform 0.3s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--gold-mid)"; e.currentTarget.style.transform = "rotate(180deg)" }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.transform = "rotate(0deg)" }}
              title="Refresh"
            >
              <RefreshCw size={18} style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: "12px" }}>
            <Search size={14} color="var(--text-dim)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search drafts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", background: "var(--bg-deep)", border: "1px solid var(--border-color)", borderRadius: "8px",
                padding: "9px 12px 9px 38px", color: "var(--text-bright)", fontSize: "13px", outline: "none"
              }}
            />
          </div>

          <div style={{
            background: "rgba(232, 100, 52, 0.04)", border: "1px solid rgba(232, 100, 52, 0.1)",
            padding: "8px 12px", borderRadius: "8px", fontSize: "11px", color: "var(--text-muted)"
          }}>
            Drafts are saved locally — they persist across refreshes.
          </div>
        </div>

        {/* Select all toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "16px",
          padding: "10px 20px", borderBottom: "1px solid var(--border-color)",
          borderTop: "1px solid var(--border-color)",
          background: "var(--bg-card)"
        }}>
          <button
            onClick={handleToggleSelectAll}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: "none", border: "none",
              color: isAllSelected ? "#e84234" : "var(--text-dim)",
              fontSize: "13px", fontWeight: "600", cursor: "pointer", padding: "4px 8px",
              borderRadius: "6px"
            }}
          >
            <div style={{
              width: "16px", height: "16px", borderRadius: "4px",
              border: `2px solid ${isAllSelected ? "#e84234" : "var(--text-dim)"}`,
              background: isAllSelected ? "#e84234" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {isAllSelected && <Check size={11} color="#fff" strokeWidth={4} />}
            </div>
            <span>Select All</span>
          </button>

          {selectedIds.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto" }}>
              <span style={{ fontSize: "12px", color: "var(--gold-mid)", fontWeight: "600" }}>{selectedIds.size} selected</span>
              <button onClick={handleBulkTrash} style={{ background: "rgba(232, 66, 52, 0.08)", color: "#e84234", border: "1px solid rgba(232,66,52,0.15)", borderRadius: "6px", padding: "5px 12px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                <Trash2 size={13} /> Discard All
              </button>
            </div>
          )}
        </div>

        {/* Draft list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredDrafts.length === 0 ? (
            <div style={{ padding: "80px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>📝</div>
              <p style={{ color: "var(--text-dim)", fontSize: "14px" }}>No drafts found</p>
            </div>
          ) : (
            filteredDrafts.map(renderDraftRow)
          )}
        </div>
      </div>

      {renderDetailView()}
    </div>
  )
}


export default function DraftsPage() {
  return (
    <Suspense fallback={null}>
      <DraftsPageContent />
    </Suspense>
  )
}
