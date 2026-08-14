"use client"

import { Search, X, RefreshCw } from "lucide-react"
import { useState } from "react"
import { initMailStore } from "@/utils/mailStore"

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  count?: number
  searchQuery: string
  onSearchChange: (value: string) => void
  placeholder?: string
  rightElement?: React.ReactNode
  showSearch?: boolean
}

export default function PageHeader({
  title,
  subtitle,
  icon,
  count,
  searchQuery,
  onSearchChange,
  placeholder = "Search...",
  rightElement,
  showSearch = true
}: PageHeaderProps) {
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = () => {
    setIsSyncing(true)
    const userJson = typeof window !== "undefined" ? localStorage.getItem("user") : null
    const user = JSON.parse(userJson || "{}")
    if (user.email) {
      initMailStore(user.email, true)
    }
    setTimeout(() => setIsSyncing(false), 2000)
  }

  return (
    <div style={{ padding: "24px 20px 0 20px", flexShrink: 0 }}>
      {/* Header Row — unified design: icon + title + subtitle + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {icon && (
            <div style={{ color: "var(--gold-mid)", display: "flex", alignItems: "center" }}>
              {icon}
            </div>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-bright)", margin: 0, fontFamily: "Inter, sans-serif" }}>
                {title}
              </h1>
              {count !== undefined && count > 0 && (
                <span style={{
                  background: "linear-gradient(135deg, var(--gold-rich), var(--gold-light))",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "2px 8px",
                  borderRadius: "10px",
                }}>
                  {count}
                </span>
              )}
            </div>
            {subtitle && (
              <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "2px 0 0 0" }}>{subtitle}</p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {rightElement && <div>{rightElement}</div>}
          <button
            onClick={handleSync}
            title="Sync Global Network"
            style={{
              background: "none", border: "none", padding: "4px",
              color: "var(--text-dim)", cursor: "pointer", display: "flex", alignItems: "center",
              transition: "color 0.2s, transform 0.3s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--gold-mid)"; e.currentTarget.style.transform = "rotate(180deg)" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.transform = "rotate(0deg)" }}
          >
            <RefreshCw size={16} style={{ animation: isSyncing ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="folder-search-container" style={{ marginBottom: "16px", maxWidth: "450px" }}>
          <Search size={16} className="folder-search-icon" />
          <input
            type="text"
            className="folder-search-input"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: "0 8px",
                display: "flex",
                alignItems: "center"
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
