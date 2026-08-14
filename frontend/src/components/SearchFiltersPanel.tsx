"use client"

import { useState, useRef, useEffect } from "react"
import { SlidersHorizontal, X, Search, Paperclip, Star, Calendar, ChevronDown } from "lucide-react"

export interface SearchFilters {
  query: string
  from: string
  to: string
  subject: string
  hasAttachment: boolean
  starredOnly: boolean
  dateAfter: string
  dateBefore: string
}

export const emptyFilters = (): SearchFilters => ({
  query: "",
  from: "",
  to: "",
  subject: "",
  hasAttachment: false,
  starredOnly: false,
  dateAfter: "",
  dateBefore: "",
})

export function hasActiveFilters(f: SearchFilters): boolean {
  return !!(f.from || f.to || f.subject || f.hasAttachment || f.starredOnly || f.dateAfter || f.dateBefore)
}

interface SearchFiltersPanelProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  onClear: () => void
  placeholder?: string
}

export default function SearchFiltersPanel({
  filters,
  onChange,
  onClear,
  placeholder = "Search mail...",
}: SearchFiltersPanelProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const active = hasActiveFilters(filters)

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const set = (key: keyof SearchFilters, value: any) =>
    onChange({ ...filters, [key]: value })

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    padding: "9px 12px",
    color: "var(--text-bright)",
    fontSize: "13px",
    outline: "none",
    fontFamily: "Inter, sans-serif",
    transition: "border-color 0.2s",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: "700",
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "6px",
    display: "block",
  }

  return (
    <div ref={panelRef} style={{ position: "relative", marginBottom: "16px" }}>
      {/* Search Bar Row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Main search input */}
        <div style={{ flex: 1, position: "relative" }}>
          <Search
            size={15}
            color="var(--text-dim)"
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          />
          <input
            type="text"
            placeholder={placeholder}
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            style={{
              width: "100%",
              background: "var(--bg-card)",
              border: open ? "1px solid rgba(212,175,55,0.4)" : "1px solid #141414",
              borderRadius: "10px",
              padding: "10px 40px 10px 38px",
              color: "var(--text-bright)",
              fontSize: "13px",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={() => setOpen(true)}
          />
          {/* Active filter badge inside input */}
          {active && (
            <span style={{
              position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
              background: "var(--gold-mid)", color: "var(--bg-body)", borderRadius: "10px",
              fontSize: "10px", fontWeight: "800", padding: "2px 7px",
            }}>
              Filtered
            </span>
          )}
        </div>

        {/* Filter toggle button */}
        <button
          onClick={() => setOpen(!open)}
          title="Advanced Filters"
          style={{
            flexShrink: 0,
            width: "38px", height: "38px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: active
              ? "rgba(212,175,55,0.15)"
              : open ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
            border: active
              ? "1px solid rgba(212,175,55,0.4)"
              : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            cursor: "pointer",
            color: active ? "var(--gold-mid)" : "var(--text-dim)",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--gold-mid)" }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--text-dim)" }}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Dropdown Filter Panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0, right: 0,
            zIndex: 200,
            background: "var(--bg-card)",
            border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: "16px",
            padding: "20px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,175,55,0.1)",
            animation: "filterPanelIn 0.18s cubic-bezier(0.4,0,0.2,1)",
            maxHeight: "min(80dvh, 520px)",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <style>{`
            @keyframes filterPanelIn {
              from { opacity: 0; transform: translateY(-8px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {/* Panel Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SlidersHorizontal size={15} color="var(--gold-mid)" />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-bright)", fontFamily: "Inter, sans-serif" }}>
                Advanced Filters
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {active && (
                <button
                  onClick={() => { onClear(); setOpen(false) }}
                  style={{
                    background: "rgba(232,66,52,0.1)", color: "#e84234", border: "none",
                    borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: "700",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
                  }}
                >
                  <X size={11} /> Clear All
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Fields Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: "14px", marginBottom: "16px" }}>
            {/* From */}
            <div>
              <label style={labelStyle}>From</label>
              <input
                type="text"
                placeholder="Sender email or name"
                value={filters.from}
                onChange={(e) => set("from", e.target.value)}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
              />
            </div>

            {/* To */}
            <div>
              <label style={labelStyle}>To</label>
              <input
                type="text"
                placeholder="Recipient email or name"
                value={filters.to}
                onChange={(e) => set("to", e.target.value)}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
              />
            </div>

            {/* Subject */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Subject</label>
              <input
                type="text"
                placeholder="Subject contains..."
                value={filters.subject}
                onChange={(e) => set("subject", e.target.value)}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
              />
            </div>

            {/* Date After */}
            <div>
              <label style={labelStyle}>
                <Calendar size={10} style={{ display: "inline", marginRight: "4px" }} />
                After Date
              </label>
              <input
                type="date"
                value={filters.dateAfter}
                onChange={(e) => set("dateAfter", e.target.value)}
                style={{ ...inputStyle, colorScheme: "dark" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
              />
            </div>

            {/* Date Before */}
            <div>
              <label style={labelStyle}>
                <Calendar size={10} style={{ display: "inline", marginRight: "4px" }} />
                Before Date
              </label>
              <input
                type="date"
                value={filters.dateBefore}
                onChange={(e) => set("dateBefore", e.target.value)}
                style={{ ...inputStyle, colorScheme: "dark" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
              />
            </div>
          </div>

          {/* Toggle Chips Row */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: "600", whiteSpace: "nowrap" }}>Quick filters:</span>

            {/* Has Attachment */}
            <button
              onClick={() => set("hasAttachment", !filters.hasAttachment)}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "5px 10px", borderRadius: "20px", cursor: "pointer",
                fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", flexShrink: 0,
                background: filters.hasAttachment ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.04)",
                border: filters.hasAttachment ? "1px solid rgba(212,175,55,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: filters.hasAttachment ? "var(--gold-mid)" : "var(--text-dim)",
                transition: "all 0.18s",
              }}
            >
              <Paperclip size={12} />
              Has Attachment
            </button>

            {/* Starred Only */}
            <button
              onClick={() => set("starredOnly", !filters.starredOnly)}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "5px 10px", borderRadius: "20px", cursor: "pointer",
                fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", flexShrink: 0,
                background: filters.starredOnly ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.04)",
                border: filters.starredOnly ? "1px solid rgba(212,175,55,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: filters.starredOnly ? "var(--gold-mid)" : "var(--text-dim)",
                transition: "all 0.18s",
              }}
            >
              <Star size={12} fill={filters.starredOnly ? "var(--gold-mid)" : "none"} />
              Starred Only
            </button>

            {/* Apply button */}
            <button
              onClick={() => setOpen(false)}
              style={{
                marginLeft: "auto", flexShrink: 0,
                padding: "6px 18px", borderRadius: "20px",
                background: "linear-gradient(135deg, var(--gold-rich, #c9a227), var(--gold-light, #e8cc6e))",
                border: "none", color: "var(--bg-body, #0a0a0a)",
                fontSize: "12px", fontWeight: "800", cursor: "pointer",
                fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
                boxShadow: "0 4px 14px rgba(212,175,55,0.3)",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
