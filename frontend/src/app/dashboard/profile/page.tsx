"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { copyToClipboard } from "@/utils/clipboard"
import { useToast } from "@/context/ToastContext"
import { 
  User, Key, Copy, Download, Lock, Shield, X, 
  RefreshCw, CheckCircle2, XCircle, Camera, Trash2, Image as ImageIcon
} from "lucide-react"

export default function ProfilePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [showFullPublicKey, setShowFullPublicKey] = useState(false)
  const [showFullPrivateKey, setShowFullPrivateKey] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle")
  
  // Profile Photo State
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadCurrentUser = () => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem("user")
      if (!raw) return
      const localUser = JSON.parse(raw)
      if (!localUser.email) return
      setUser(localUser)

      // Load persistent profile photo for this specific user email
      const storedPhoto = localStorage.getItem(`profile_photo_${localUser.email}`)
      if (storedPhoto) {
        setProfilePhoto(storedPhoto)
      } else {
        setProfilePhoto(null)
      }
    } catch {
      // Corrupted localStorage — ignore
    }
  }

  useEffect(() => {
    loadCurrentUser()

    // Re-read active account whenever it changes (cross-tab via storage event)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user") {
        loadCurrentUser()
      }
    }

    // Re-read active account on same-tab switches
    const handleAccountSwitch = () => loadCurrentUser()
    const handleFocus = () => loadCurrentUser()

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("accountSwitch", handleAccountSwitch)
    window.addEventListener("focus", handleFocus)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("accountSwitch", handleAccountSwitch)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  // ── Profile Photo Handlers ──
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.email) return

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!validTypes.includes(file.type.toLowerCase())) {
      showToast("❌ Invalid image format. Please select JPG, PNG, or WEBP.")
      return
    }

    // Size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      showToast("❌ Image size too large. Maximum allowed size is 5MB.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64Url = reader.result as string
      setProfilePhoto(base64Url)
      localStorage.setItem(`profile_photo_${user.email}`, base64Url)
      showToast("✓ Profile photo updated successfully")
    }
    reader.onerror = () => {
      showToast("❌ Failed to process image file")
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    if (!user?.email) return
    setProfilePhoto(null)
    localStorage.removeItem(`profile_photo_${user.email}`)
    showToast("✓ Profile photo removed")
  }

  // ── Copy Handlers with Spec Toasts ──
  const handleCopyEmail = async () => {
    if (!user?.email) return
    try {
      await copyToClipboard(user.email)
      showToast("✓ DMail address copied to clipboard")
    } catch {
      showToast("❌ Failed to copy DMail address")
    }
  }

  const handleCopyPublicKey = async () => {
    if (!user?.publicKey) {
      showToast("❌ Public key not found")
      return
    }
    try {
      await copyToClipboard(user.publicKey)
      showToast("✓ Public key copied to clipboard")
    } catch {
      showToast("❌ Failed to copy public key")
    }
  }

  const handleCopyPrivateKey = async () => {
    const privateKeyToCopy = user?.privateKey || user?.privateKeyArmored
    if (!privateKeyToCopy) {
      showToast("❌ Private key not available to copy")
      return
    }
    try {
      await copyToClipboard(privateKeyToCopy)
      showToast("✓ Private key copied to clipboard")
    } catch {
      showToast("❌ Failed to copy private key")
    }
  }

  const syncIdentity = async () => {
    setSyncing(true)
    setSyncStatus("idle")
    
    try {
      const { isKeyValid, db } = await import("@/utils/gun")
      const localUser = JSON.parse(localStorage.getItem("user") || "{}")
      
      const isValid = await isKeyValid(localUser.publicKey)
      if (!isValid) {
        console.warn("🚨 Local public key is corrupted. Attempting Auto-Repair...")
        const repair = await db.repairIdentity()
        if (repair.success) {
           setSyncStatus("success")
           showToast("✅ Identity Repaired & Synced!")
           setSyncing(false)
           return
        } else {
           setSyncStatus("error")
           showToast("❌ Identity Repair failed. Please re-login.")
           setSyncing(false)
           return
        }
      }

      await db.reannounceUser()
      setSyncStatus("success")
      showToast("✓ Identity synced with network")
      setTimeout(() => setSyncStatus("idle"), 3000)
    } catch (e) {
      console.error("Sync failed:", e)
      setSyncStatus("error")
      showToast("❌ Identity sync failed")
    }
    
    setSyncing(false)
  }

  const downloadPublicKey = () => {
    if (!user?.publicKey) return
    const blob = new Blob([user.publicKey], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${user.email}_publickey.asc`
    a.click()
    URL.revokeObjectURL(url)
    showToast("✓ Downloaded PGP public key (.asc)")
  }

  const getKeyPreview = (key: string) => {
    if (!key) return ""
    const body = key
      .replace("-----BEGIN PGP PUBLIC KEY BLOCK-----", "")
      .replace("-----END PGP PUBLIC KEY BLOCK-----", "")
      .replace(/\s/g, "")
    return `-----BEGIN PGP PUBLIC KEY----- ··· ${body.slice(0, 16)}...`
  }

  const generateFingerprint = (key: string) => {
    if (!key) return ""
    const clean = key.replace(/\s/g, "").slice(0, 40).toUpperCase()
    return clean.match(/.{1,4}/g)?.join(" ") || ""
  }

  if (!user) return <div className="empty-state">Loading profile...</div>

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-body)" }}>
      
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handlePhotoSelect}
      />

      {/* Profile Header */}
      <div className="inbox-header-row" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #141414" }}>
        <h2 className="inbox-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", fontWeight: "800", color: "var(--text-bright)" }}>
          <User size={22} color="var(--gold-mid)" /> Profile Details
        </h2>
        <button 
          onClick={() => router.push('/dashboard/inbox')}
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-gold)", borderRadius: "8px", 
            padding: "6px 14px", color: "var(--text-bright)", cursor: "pointer", fontSize: "13px", 
            fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: "6px",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
        >
          <X size={16} /> Close
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* ── PROFILE CARD (Avatar, Photo Upload, Name, DMail Address) ── */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border-gold)",
            borderRadius: "16px", padding: "24px 20px", textAlign: "center",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
            display: "flex", flexDirection: "column", alignItems: "center"
          }}>
            {/* Avatar Circle with Camera Overlay */}
            <div style={{ position: "relative", width: "88px", height: "88px", marginBottom: "16px" }}>
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  style={{
                    width: "88px", height: "88px", borderRadius: "50%",
                    objectFit: "cover", border: "2px solid var(--gold-mid)",
                    boxShadow: "0 0 20px rgba(212, 175, 55, 0.4)",
                  }}
                />
              ) : (
                <div style={{
                  width: "88px", height: "88px", borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--gold-rich), var(--gold-light))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "36px", fontWeight: "800", color: "#1a1200",
                  boxShadow: "0 0 24px rgba(212, 175, 55, 0.4)",
                }}>
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </div>
              )}

              {/* Camera Edit Badge */}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Change profile photo"
                style={{
                  position: "absolute", bottom: "0", right: "0",
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: "var(--gold-mid)", border: "2px solid var(--bg-card)",
                  color: "#000", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "transform 0.15s ease",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.5)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <Camera size={14} />
              </button>
            </div>

            {/* Photo Action Buttons */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "rgba(212, 175, 55, 0.1)", border: "1px solid var(--gold-mid)",
                  borderRadius: "6px", padding: "5px 12px", color: "var(--gold-mid)",
                  fontSize: "11px", fontWeight: "700", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "6px"
                }}
              >
                <ImageIcon size={12} />
                {profilePhoto ? "Change Photo" : "Add Profile Photo"}
              </button>
              {profilePhoto && (
                <button
                  onClick={handleRemovePhoto}
                  style={{
                    background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px", padding: "5px 12px", color: "#ef4444",
                    fontSize: "11px", fontWeight: "700", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "6px"
                  }}
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              )}
            </div>

            <h2 style={{ color: "var(--text-bright)", margin: "0 0 6px 0", fontSize: "20px", fontWeight: "700" }}>{user.name}</h2>
            
            {/* DMail Address & Copy */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)",
              padding: "6px 14px", borderRadius: "8px", maxWidth: "100%", overflow: "hidden"
            }}>
              <span style={{ color: "var(--gold-mid)", fontSize: "13px", fontFamily: "Courier New, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </span>
              <button 
                onClick={handleCopyEmail}
                style={{ 
                  background: "none", border: "none", cursor: "pointer", 
                  color: "var(--gold-mid)", display: "flex", alignItems: "center",
                  padding: "4px", flexShrink: 0
                }}
                title="Copy DMail address"
              >
                <Copy size={15} />
              </button>
            </div>

            {/* Account Status Badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", marginTop: "12px" }}>
              <span style={{
                fontSize: "11px", padding: "3px 10px", borderRadius: "20px",
                background: "rgba(76,175,110,0.1)", color: "#4caf6e",
                border: "1px solid rgba(76,175,110,0.25)", fontWeight: "600"
              }}> ● Active Secure Account</span>
              {user.did && (
                <span style={{
                  fontSize: "10px", color: "var(--text-muted)",
                  fontFamily: "Courier New, monospace",
                  padding: "3px 10px", background: "rgba(212, 175, 55,0.06)",
                  borderRadius: "20px", border: "1px solid var(--border-gold)",
                  maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>
                  ID: {user.did}
                </span>
              )}
            </div>

            {/* Sync Identity Button */}
            <button 
              onClick={syncIdentity} 
              disabled={syncing}
              style={{ 
                marginTop: "16px",
                fontSize: "12px", padding: "8px 20px", borderRadius: "20px", 
                cursor: syncing ? "not-allowed" : "pointer",
                fontFamily: "Inter, sans-serif", fontWeight: "700",
                border: "1px solid var(--border-gold)",
                transition: "all 0.2s ease",
                display: "inline-flex", alignItems: "center", gap: "6px",
                background: 
                  syncStatus === "success" ? "rgba(76,175,110,0.2)" : 
                  syncStatus === "error" ? "rgba(217,48,37,0.2)" : 
                  syncing ? "rgba(212, 175, 55,0.1)" : "rgba(212, 175, 55,0.05)",
                color: 
                  syncStatus === "success" ? "#4caf6e" : 
                  syncStatus === "error" ? "#e84234" : "var(--gold-mid)"
              }}
            >
              {syncing ? <><RefreshCw size={14} className="spin" /> Syncing...</> : 
               syncStatus === "success" ? <><CheckCircle2 size={14} /> Identity Synced!</> : 
               syncStatus === "error" ? <><XCircle size={14} /> Sync Failed</> : 
               <><RefreshCw size={14} /> Sync Identity with Network</>}
            </button>
          </div>

          {/* ── PUBLIC KEY CARD ── */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border-gold)",
            borderRadius: "14px", padding: "20px", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
              <p style={{
                color: "var(--text-muted)", fontSize: "11px", margin: 0,
                textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700",
                display: "flex", alignItems: "center", gap: "6px"
              }}>
                <Key size={14} color="var(--gold-mid)" /> Public Key (Identity)
              </p>
              <button
                onClick={handleCopyPublicKey}
                style={{
                  background: "rgba(212, 175, 55, 0.12)", border: "1px solid var(--gold-mid)",
                  borderRadius: "6px", padding: "4px 12px", color: "var(--gold-mid)",
                  fontSize: "12px", fontWeight: "700", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s"
                }}
              >
                <Copy size={13} /> Copy Public Key
              </button>
            </div>
            
            <p style={{ color: "var(--text-dim)", fontSize: "12px", marginBottom: "12px", lineHeight: "1.4" }}>
              Your public identity used by DMail to encrypt incoming messages sent to your email address.
            </p>

            <div style={{
              background: "var(--bg-panel)", border: "1px solid var(--border-gold)",
              borderRadius: "8px", padding: "10px 14px", marginBottom: "12px",
              display: "flex", alignItems: "center", gap: "10px", overflow: "hidden"
            }}>
              <span style={{
                fontFamily: "Courier New, monospace", fontSize: "11px",
                color: "var(--gold-light)", flex: 1, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {getKeyPreview(user.publicKey)}
              </span>
              <button onClick={() => setShowFullPublicKey(true)} style={{
                background: "none", border: "1px solid var(--gold-mid)",
                borderRadius: "6px", padding: "3px 10px", cursor: "pointer",
                color: "var(--gold-mid)", fontSize: "11px", fontWeight: "600",
                fontFamily: "Inter, sans-serif", flexShrink: 0
              }}>View</button>
            </div>

            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px", wordBreak: "break-all" }}>
              Fingerprint: <span style={{ fontFamily: "Courier New, monospace", color: "var(--text-bright)" }}>
                {generateFingerprint(user.publicKey)}
              </span>
            </p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {user.did && (
                <button onClick={() => {
                  copyToClipboard(user.did)
                  showToast("✓ DID copied to clipboard")
                }} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                  <Copy size={14} /> Copy DID
                </button>
              )}
              <button onClick={downloadPublicKey} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                <Download size={14} /> Download .asc
              </button>
            </div>
          </div>

          {/* ── PRIVATE KEY CARD ── */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid rgba(217,48,37,0.3)",
            borderRadius: "14px", padding: "20px", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
              <p style={{
                color: "#ef4444", fontSize: "11px", margin: 0,
                textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700",
                display: "flex", alignItems: "center", gap: "6px"
              }}>
                <Lock size={14} color="#ef4444" /> Private Key (Master Decryption)
              </p>
              <button
                onClick={handleCopyPrivateKey}
                style={{
                  background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "6px", padding: "4px 12px", color: "#ef4444",
                  fontSize: "12px", fontWeight: "700", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s"
                }}
              >
                <Copy size={13} /> Copy Private Key
              </button>
            </div>

            <p style={{ color: "var(--text-dim)", fontSize: "12px", marginBottom: "12px", lineHeight: "1.4" }}>
              Linked directly to your local account credentials. Never share it; it decrypts your incoming emails.
            </p>

            <div style={{
              background: "var(--bg-panel)", border: "1px solid rgba(217,48,37,0.2)",
              borderRadius: "8px", padding: "10px 14px",
              display: "flex", alignItems: "center", gap: "10px", overflow: "hidden"
            }}>
              <span style={{
                fontFamily: "Courier New, monospace", fontSize: "11px",
                color: "#e84234", flex: 1, letterSpacing: "1px", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                -----BEGIN PGP PRIVATE KEY----- ··· ████████...
              </span>
              <button onClick={() => setShowFullPrivateKey(true)} style={{
                background: "rgba(217,48,37,0.12)", border: "1px solid rgba(217,48,37,0.25)",
                borderRadius: "6px", padding: "3px 10px", cursor: "pointer",
                color: "#e84234", fontSize: "11px", fontWeight: "600",
                fontFamily: "Inter, sans-serif", flexShrink: 0
              }}>View Secret</button>
            </div>
          </div>

          {/* ── SECURITY INFO CARD ── */}
          <div style={{
            background: "rgba(76,175,110,0.06)", border: "1px solid rgba(76,175,110,0.2)",
            borderRadius: "14px", padding: "16px", fontSize: "13px",
            color: "var(--text-muted)", lineHeight: "1.6",
          }}>
            <p style={{ marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Shield size={16} color="#4caf6e" /> <strong style={{ color: "var(--text-bright)" }}>PGP End-to-End Encrypted Identity</strong>
            </p>
            <p style={{ margin: 0, fontSize: "12px" }}>
              Messages are encrypted with RSA PGP keys. Only you hold your decryption keys in local browser vault. Private keys are never logged or stored on remote servers.
            </p>
          </div>

        </div>
      </div>

      {/* ── Full Public Key Modal ── */}
      {showFullPublicKey && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content" style={{ maxWidth: "520px", width: "92%", padding: "20px" }}>
            <div style={{ marginBottom: "8px", color: "var(--gold-mid)", display: "flex", justifyContent: "center" }}><Key size={32} /></div>
            <h3 style={{ textAlign: "center", marginBottom: "8px", fontSize: "18px", color: "var(--text-bright)" }}>Your PGP Public Key</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px", textAlign: "center" }}>
              Safe to share — used by others to encrypt messages sent to you.
            </p>
            <textarea readOnly value={user.publicKey} style={{
              width: "100%", height: "200px",
              background: "var(--bg-panel)", border: "1px solid var(--border-gold)",
              borderRadius: "8px", padding: "12px",
              fontFamily: "Courier New, monospace", fontSize: "10px",
              color: "var(--gold-light)", resize: "none",
              lineHeight: "1.5", boxSizing: "border-box", wordBreak: "break-all"
            }} />
            <div className="modal-actions" style={{ marginTop: "16px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setShowFullPublicKey(false)}>
                Close
              </button>
              <button className="btn" onClick={() => { handleCopyPublicKey(); setShowFullPublicKey(false) }} style={{ background: "var(--gold-mid)", color: "#000", fontWeight: "700" }}>
                Copy Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full Private Key Modal ── */}
      {showFullPrivateKey && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content" style={{ maxWidth: "520px", width: "92%", padding: "20px", border: "1px solid rgba(217,48,37,0.4)" }}>
            <div style={{ marginBottom: "8px", color: "#e84234", display: "flex", justifyContent: "center" }}><Lock size={32} /></div>
            <h3 style={{ color: "#e84234", textAlign: "center", marginBottom: "8px", fontSize: "18px" }}>Your PGP Private Key</h3>
            <p style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "12px", background: "rgba(217,48,37,0.1)", padding: "10px", borderRadius: "8px", textAlign: "center" }}>
              <strong>DANGER:</strong> Never share this key with anyone. It grants full access to decrypt all your private messages.
            </p>
            <textarea readOnly value={user.privateKey || user.privateKeyArmored || "Private key not found locally"} style={{
              width: "100%", height: "200px",
              background: "var(--bg-panel)", border: "1px solid rgba(217,48,37,0.3)",
              borderRadius: "8px", padding: "12px",
              fontFamily: "Courier New, monospace", fontSize: "10px",
              color: "#e84234", resize: "none",
              lineHeight: "1.5", boxSizing: "border-box", wordBreak: "break-all"
            }} />
            <div className="modal-actions" style={{ marginTop: "16px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setShowFullPrivateKey(false)}>
                Close
              </button>
              <button className="btn" onClick={() => { handleCopyPrivateKey(); setShowFullPrivateKey(false) }} style={{ background: "#e84234", color: "#fff", fontWeight: "700", border: "none" }}>
                Copy Secret Key
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
