"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Logo from "@/components/Logo"
import {
  Eye, EyeOff, CheckCircle, Clipboard, ShieldCheck, ShieldAlert,
  ArrowRight, ArrowLeft, Check, X, AlertTriangle, Loader2, Sparkles
} from "lucide-react"
import { MAIL_DOMAIN } from "@/utils/config"

// ─────────────────────────────────────────────
// Step Progress Indicator
// ─────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 0,
      marginBottom: "20px",
    }}>
      {/* Step 1 dot */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
        <div style={{
          width: "10px", height: "10px", borderRadius: "50%",
          background: "var(--gold-mid)",
          boxShadow: "0 0 8px rgba(212,175,55,0.6)",
          transition: "all 0.3s ease"
        }} />
        <span style={{
          fontSize: "10px", fontWeight: "600", color: "var(--gold-mid)",
          letterSpacing: "0.5px", textTransform: "uppercase", whiteSpace: "nowrap"
        }}>Account</span>
      </div>

      {/* Connector line */}
      <div style={{
        width: "60px", height: "2px",
        background: step === 2
          ? "linear-gradient(90deg, var(--gold-mid), var(--gold-mid))"
          : "linear-gradient(90deg, var(--gold-mid), #2a2a2a)",
        margin: "0 0 16px 0",
        transition: "background 0.4s ease",
        flexShrink: 0
      }} />

      {/* Step 2 dot */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
        <div style={{
          width: "10px", height: "10px", borderRadius: "50%",
          background: step === 2 ? "var(--gold-mid)" : "#2a2a2a",
          border: step === 2 ? "none" : "1.5px solid #444",
          boxShadow: step === 2 ? "0 0 8px rgba(212,175,55,0.6)" : "none",
          transition: "all 0.3s ease"
        }} />
        <span style={{
          fontSize: "10px", fontWeight: "600",
          color: step === 2 ? "var(--gold-mid)" : "var(--text-dim)",
          letterSpacing: "0.5px", textTransform: "uppercase", whiteSpace: "nowrap",
          transition: "color 0.3s ease"
        }}>Password</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Password Strength Checklist
// ─────────────────────────────────────────────
function PasswordChecklist({ password }: { password: string }) {
  const checks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter", ok: /[a-z]/.test(password) },
    { label: "Number", ok: /\d/.test(password) },
    { label: "Special character (@$!%*?&)", ok: /[@$!%*?&]/.test(password) },
  ]

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "4px",
      marginTop: "8px", padding: "10px 12px",
      background: "rgba(212,175,55,0.03)",
      border: "1px solid rgba(212,175,55,0.1)",
      borderRadius: "8px"
    }}>
      {checks.map(({ label, ok }) => (
        <div key={label} style={{
          display: "flex", alignItems: "center", gap: "7px",
          fontSize: "11px", fontWeight: "500",
          color: ok ? "#4caf6e" : "var(--text-dim)",
          transition: "color 0.2s ease"
        }}>
          {ok
            ? <Check size={11} color="#4caf6e" />
            : <div style={{ width: 11, height: 11, borderRadius: "50%", border: "1.5px solid #444", flexShrink: 0 }} />
          }
          {label}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Signup Component
// ─────────────────────────────────────────────
export default function SignupForm({ onSwitchMode }: { onSwitchMode?: () => void }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  // ── Step control ──────────────────────────
  const [step, setStep] = useState<1 | 2>(1)

  // ── Step 1 state ──────────────────────────
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean
    available?: boolean
    status?: "available" | "taken" | "reserved" | "invalid" | "error"
    message?: string
  }>({ checking: false })

  // ── Step 2 state ──────────────────────────
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // ── Shared state ──────────────────────────
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [createdEmail, setCreatedEmail] = useState("")
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedMnemonic, setCopiedMnemonic] = useState(false)
  const [mnemonic, setMnemonic] = useState("")

  const checkAbortRef = useRef<AbortController | null>(null)
  const suggestAbortRef = useRef<AbortController | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // ─── Client-side username format validation ───────────────
  const validateFormat = (val: string): { valid: boolean; error?: string } => {
    if (!val) return { valid: false, error: "Username is required." }
    const clean = val.trim().toLowerCase()
    if (clean.includes(" ")) return { valid: false, error: "Spaces are not allowed in DMail usernames." }
    if (clean.length < 3) return { valid: false, error: "Must be at least 3 characters long." }
    if (clean.length > 30) return { valid: false, error: "Must not exceed 30 characters." }
    if (!/^[a-z0-9._-]+$/.test(clean)) return { valid: false, error: "Only lowercase letters, numbers, dots, hyphens, and underscores are allowed." }
    if (/^[._-]/.test(clean) || /[._-]$/.test(clean)) return { valid: false, error: "Cannot start or end with a dot, hyphen, or underscore." }
    if (/[._-]{2,}/.test(clean)) return { valid: false, error: "Cannot contain consecutive special characters." }
    return { valid: true }
  }

  // ─── Availability check with debounce + AbortController ──
  const performCheck = useCallback(async (targetUsername: string) => {
    if (!targetUsername) {
      setUsernameStatus({ checking: false })
      return
    }

    const clean = targetUsername.trim().toLowerCase()
    const fmt = validateFormat(clean)
    if (!fmt.valid) {
      setUsernameStatus({ checking: false, available: false, status: "invalid", message: fmt.error })
      return
    }

    setUsernameStatus({ checking: true })

    if (checkAbortRef.current) checkAbortRef.current.abort()
    const controller = new AbortController()
    checkAbortRef.current = controller

    try {
      const backendUrl = process.env.NEXT_PUBLIC_GUN_RELAY || "http://localhost:8765"
      const res = await fetch(`${backendUrl}/api/auth/check-username?username=${encodeURIComponent(clean)}`, {
        signal: controller.signal
      })
      if (res.ok) {
        const data = await res.json()
        setUsernameStatus({ checking: false, available: data.available, status: data.status, message: data.message })
        return
      }
    } catch (err: any) {
      if (err.name === "AbortError") return
    }

    // GunDB mesh fallback
    try {
      const { db } = await import("@/utils/gun")
      const targetEmail = `${clean}@${MAIL_DOMAIN}`
      const meshData = await new Promise<{ publicKey?: string; password?: string } | null>(res => {
        const timeout = setTimeout(() => res(null), 1200)
        db.getUser(targetEmail, (data: any) => { clearTimeout(timeout); res(data) }, true)
      })
      if (meshData && (meshData.publicKey || meshData.password)) {
        setUsernameStatus({ checking: false, available: false, status: "taken", message: "Username is already taken in the network." })
      } else {
        setUsernameStatus({ checking: false, available: true, status: "available", message: "Username is available!" })
      }
    } catch {
      setUsernameStatus({ checking: false, available: true, status: "available", message: "Username is available!" })
    }
  }, [])

  // ─── Watch username changes — 400ms debounce ──────────────
  useEffect(() => {
    if (!username.trim()) { setUsernameStatus({ checking: false }); return }
    const timer = setTimeout(() => { performCheck(username) }, 400)
    return () => clearTimeout(timer)
  }, [username, performCheck])

  // ─── Generate suggestions — 400ms debounce ───────────────
  useEffect(() => {
    if (!name.trim()) { setSuggestions([]); return }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true)
      if (suggestAbortRef.current) suggestAbortRef.current.abort()
      const controller = new AbortController()
      suggestAbortRef.current = controller

      try {
        const backendUrl = process.env.NEXT_PUBLIC_GUN_RELAY || "http://localhost:8765"
        const res = await fetch(`${backendUrl}/api/auth/suggest-usernames?name=${encodeURIComponent(name.trim())}`, {
          signal: controller.signal
        })
        if (res.ok) {
          const data = await res.json()
          if (data.suggestions && Array.isArray(data.suggestions)) {
            setSuggestions(data.suggestions)
            setLoadingSuggestions(false)
            return
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return
      }

      // Local fallback
      const cleanParts = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean)
      if (cleanParts.length > 0) {
        const first = cleanParts[0]
        const last = cleanParts.length > 1 ? cleanParts[cleanParts.length - 1] : ""
        const yr = new Date().getFullYear().toString().slice(-2)
        const fallbacks = last
          ? [`${first}.${last}`, `${first}_${last}`, `${first}${last}${yr}`]
          : [`${first}`, `${first}${yr}`, `${first}_dmail`]
        setSuggestions(fallbacks)
      }
      setLoadingSuggestions(false)
    }, 400)

    return () => clearTimeout(timer)
  }, [name])

  const selectSuggestion = (sug: string) => {
    setSelectedSuggestion(sug)
    setUsername(sug)
    setMessage(null)
    performCheck(sug)
  }

  const handleCustomUsernameChange = (val: string) => {
    setSelectedSuggestion(null)
    setMessage(null)
    setUsername(val.toLowerCase().replace(/\s+/g, ""))
  }

  // ─── Step 1 → Step 2 ─────────────────────
  const handleContinue = () => {
    if (!isStep1Valid) return
    setMessage(null)
    setPassword("")
    setConfirmPassword("")
    setStep(2)
  }

  // ─── Step 2 → Step 1 ─────────────────────
  const handleBack = () => {
    setMessage(null)
    setStep(1)
  }

  // ─── Final account creation (Step 2) ─────
  const createAccount = async () => {
    if (!name || !password || !username) {
      setMessage({ text: "Please fill out all fields.", type: "error" })
      return
    }

    const nameRegex = /^[A-Za-z\s]+$/
    if (!nameRegex.test(name.trim())) {
      setMessage({ text: "Name should contain only letters and spaces.", type: "error" })
      return
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/
    if (!passwordRegex.test(password)) {
      setMessage({
        text: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
        type: "error",
      })
      return
    }

    if (password !== confirmPassword) {
      setMessage({ text: "Passwords do not match.", type: "error" })
      return
    }

    const fmt = validateFormat(username)
    if (!fmt.valid || !usernameStatus.available) {
      setMessage({ text: usernameStatus.message || "Please choose a valid available username.", type: "error" })
      return
    }

    setLoading(true)
    setMessage({ text: "Checking final server availability...", type: "success" })

    const cleanUser = username.trim().toLowerCase()
    const generatedEmail = `${cleanUser}@${MAIL_DOMAIN}`

    try {
      const { db } = await import("@/utils/gun")
      const { saveAccount } = await import("@/utils/accounts")
      const { generateSovereignIdentity } = await import("@/utils/identity")

      // Backend double-check — race condition protection
      const backendUrl = process.env.NEXT_PUBLIC_GUN_RELAY || "http://localhost:8765"
      try {
        const verifyRes = await fetch(`${backendUrl}/api/auth/check-username?username=${encodeURIComponent(cleanUser)}`)
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (!verifyData.available) {
            setMessage({
              text: "This username was just taken. Please choose another username.",
              type: "error"
            })
            setLoading(false)
            // Return user to Step 1 to pick a new username
            setStep(1)
            return
          }
        }
      } catch {
        // Continue if offline relay
      }

      setMessage({ text: "Generating sovereign cryptographic key pair...", type: "success" })
      const identity = await generateSovereignIdentity(generatedEmail, password)

      const userObj = {
        name: name.trim(),
        email: generatedEmail,
        password,
        publicKey: identity.publicKey,
        privateKey: identity.privateKey,
        isDeterministic: true
      }

      // Register with backend gateway & GunDB mesh
      try {
        await fetch(`${backendUrl}/api/gateway/register-auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userObj)
        })
      } catch {
        // Mesh handles offline registration
      }

      db.registerUser(userObj)

      // Announce on Nostr Mesh
      import("@/utils/nostr").then(({ nostr }) => {
        nostr.initUserKeys(generatedEmail, password).then(() => {
          nostr.announce({
            email: generatedEmail,
            publicKey: identity.publicKey,
            did: identity.did,
            timestamp: Date.now(),
          })
        })
      }).catch(() => { })

      saveAccount({ ...userObj, addedAt: Date.now() })

      setMnemonic(identity.mnemonic)
      setCreatedEmail(generatedEmail)
      setMessage({ text: "✓ Identity created successfully! Redirecting to Sign In...", type: "success" })
      setLoading(false)
      
      // DIRECTLY redirect to Sign In page
      setTimeout(() => {
        window.location.href = `/login?email=${encodeURIComponent(generatedEmail)}`
      }, 1000)
    } catch (err: unknown) {
      console.error("Signup Error:", err)
      const errMsg = err instanceof Error ? err.message : "Unknown error"
      setMessage({
        text: `Identity generation failed: ${errMsg}.`,
        type: "error"
      })
      setLoading(false)
    }
  }

  if (!mounted) return null

  // ─── Derived validity ─────────────────────
  const isStep1Valid =
    name.trim().length > 0 &&
    /^[A-Za-z\s]+$/.test(name.trim()) &&
    username.trim().length >= 3 &&
    usernameStatus.available === true &&
    !usernameStatus.checking

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword
  const isStep2Valid =
    passwordRegex.test(password) &&
    passwordsMatch &&
    !loading

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="page-center">
      <div className="auth-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Logo + Step heading */}
        <div className="auth-header" style={{ marginBottom: 0 }}>
          <Logo size={44} layout="horizontal" showText={true} />
          <div className="auth-header-content" style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            textAlign: "center", marginTop: "14px"
          }}>
            <h2 className="auth-title">
              {step === 1 ? "Create Account" : "Create Password"}
            </h2>
            <p className="auth-subtitle" style={{ marginTop: "6px", fontSize: "13px" }}>
              {step === 1
                ? "Choose your personal DMail address and generate secure PGP identity keys."
                : "Set a strong password to protect your DMail identity."}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <StepIndicator step={step} />

        {/* Message banner */}
        {message && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", margin: 0,
            fontSize: "13px", fontWeight: "500", textAlign: "center",
            background: message.type === "success" ? "rgba(76,175,110,0.12)" : "rgba(217,48,37,0.12)",
            color: message.type === "success" ? "#4caf6e" : "#e84234",
            border: `1px solid ${message.type === "success" ? "rgba(76,175,110,0.25)" : "rgba(217,48,37,0.25)"}`,
          }}>
            {loading && message.type === "success" && (
              <span style={{
                display: "inline-block", width: "12px", height: "12px",
                border: "2px solid rgba(76,175,110,0.3)", borderTop: "2px solid #4caf6e",
                borderRadius: "50%", animation: "spin 0.8s linear infinite",
                marginRight: "8px", verticalAlign: "middle",
              }} />
            )}
            {message.text}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 1 — Identity / Username
            ══════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="auth-form" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Full Name */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                Full Name
              </label>
              <input
                id="signup-name"
                className="auth-input"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => { setName(e.target.value); setMessage(null) }}
                style={{ margin: 0 }}
                autoComplete="name"
              />
            </div>

            {/* Username Suggestions */}
            {name.trim().length > 0 && (
              <div style={{
                background: "rgba(212, 175, 55, 0.04)",
                border: "1px solid rgba(212, 175, 55, 0.15)",
                borderRadius: "12px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--gold-mid)", fontWeight: "600" }}>
                  <Sparkles size={14} /> Available Suggestions
                  {loadingSuggestions && <Loader2 size={12} className="animate-spin" style={{ marginLeft: "auto" }} />}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {suggestions.map((sug) => {
                    const isSelected = selectedSuggestion === sug || username === sug
                    return (
                      <button
                        key={sug}
                        id={`suggestion-${sug}`}
                        type="button"
                        onClick={() => selectSuggestion(sug)}
                        style={{
                          background: isSelected ? "rgba(212, 175, 55, 0.2)" : "var(--bg-input)",
                          border: isSelected ? "1px solid var(--gold-mid)" : "1px solid var(--border-color)",
                          borderRadius: "20px",
                          padding: "6px 14px",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: isSelected ? "var(--gold-light)" : "var(--text-bright)",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <span>{sug}@{MAIL_DOMAIN}</span>
                        {isSelected && <Check size={12} color="var(--gold-mid)" />}
                      </button>
                    )
                  })}
                  {suggestions.length === 0 && !loadingSuggestions && (
                    <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Type your name to get available suggestions.</span>
                  )}
                </div>
              </div>
            )}

            {/* Custom DMail Username */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                DMail Address
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  id="signup-username"
                  className="auth-input"
                  placeholder="choose-username"
                  value={username}
                  onChange={(e) => handleCustomUsernameChange(e.target.value)}
                  style={{
                    margin: 0,
                    paddingRight: "160px",
                    borderColor:
                      usernameStatus.available === true
                        ? "#4caf6e"
                        : usernameStatus.available === false
                          ? "#e84234"
                          : undefined
                  }}
                  autoComplete="username"
                />
                <span style={{
                  position: "absolute", right: "12px",
                  fontSize: "13px", fontWeight: "600", color: "var(--gold-mid)",
                  background: "rgba(212, 175, 55, 0.08)",
                  padding: "4px 8px", borderRadius: "6px",
                  border: "1px solid rgba(212, 175, 55, 0.2)",
                  pointerEvents: "none", userSelect: "none"
                }}>
                  @{MAIL_DOMAIN}
                </span>
              </div>

              {/* Availability feedback */}
              {username.trim().length > 0 && (
                <div style={{ marginTop: "6px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  {usernameStatus.checking ? (
                    <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Loader2 size={13} className="animate-spin" /> Checking availability...
                    </span>
                  ) : usernameStatus.available === true ? (
                    <span style={{ color: "#4caf6e", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Check size={14} /> ✅ {username}@{MAIL_DOMAIN} is available!
                    </span>
                  ) : usernameStatus.status === "taken" ? (
                    <span style={{ color: "#e84234", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                      <X size={14} /> Username is already taken
                    </span>
                  ) : usernameStatus.status === "reserved" ? (
                    <span style={{ color: "#e6a23c", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                      <AlertTriangle size={14} /> ⚠ Reserved system username
                    </span>
                  ) : usernameStatus.status === "invalid" ? (
                    <span style={{ color: "#e6a23c", fontWeight: "500", display: "flex", alignItems: "center", gap: "4px" }}>
                      <AlertTriangle size={14} /> ⚠ {usernameStatus.message || "Invalid format"}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {/* Step 1 buttons */}
            <div className="auth-button-row" style={{ marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => onSwitchMode ? onSwitchMode() : router.push("/login")}
                style={{
                  background: "none", border: "none",
                  color: "var(--text-muted)", fontWeight: "500",
                  cursor: "pointer", fontFamily: "Raleway, sans-serif",
                  transition: "color 0.2s ease"
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--gold-mid)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
              >
                Back to Sign In
              </button>
              <button
                id="signup-continue-btn"
                className="btn"
                type="button"
                onClick={handleContinue}
                disabled={!isStep1Valid}
                style={{
                  padding: "12px 32px", fontSize: "14px",
                  opacity: isStep1Valid ? 1 : 0.5,
                  cursor: isStep1Valid ? "pointer" : "not-allowed",
                  display: "inline-flex", alignItems: "center", gap: "8px"
                }}
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 2 — Password
            ══════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="auth-form" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Selected account summary */}
            <div style={{
              padding: "9px 14px", borderRadius: "8px",
              background: "rgba(212,175,55,0.05)",
              border: "1px solid rgba(212,175,55,0.15)",
              fontSize: "12px", color: "var(--text-muted)",
              display: "flex", alignItems: "center", gap: "6px"
            }}>
              <CheckCircle size={13} color="var(--gold-mid)" />
              <span>
                <strong style={{ color: "var(--text-bright)" }}>{name}</strong>
                {" · "}
                <span style={{ color: "var(--gold-mid)", fontFamily: "monospace" }}>
                  {username}@{MAIL_DOMAIN}
                </span>
              </span>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="signup-password"
                style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Min 8 chars (uppercase, lowercase, number, symbol)"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setMessage(null) }}
                  disabled={loading}
                  style={{ margin: 0, paddingRight: "44px" }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    cursor: "pointer", color: "var(--text-dim)",
                    display: "flex", alignItems: "center", padding: "4px"
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Strength checklist — show once user starts typing */}
              {password.length > 0 && <PasswordChecklist password={password} />}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="signup-confirm-password"
                style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}
              >
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setMessage(null) }}
                  onKeyDown={(e) => e.key === "Enter" && isStep2Valid && createAccount()}
                  disabled={loading}
                  style={{ margin: 0, paddingRight: "44px" }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    cursor: "pointer", color: "var(--text-dim)",
                    display: "flex", alignItems: "center", padding: "4px"
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Match feedback */}
              {confirmPassword.length > 0 && (
                <div style={{ marginTop: "6px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  {passwordsMatch ? (
                    <span style={{ color: "#4caf6e", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Check size={13} /> Passwords match
                    </span>
                  ) : (
                    <span style={{ color: "#e84234", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                      <X size={13} /> Passwords do not match
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Step 2 buttons */}
            <div className="auth-button-row" style={{ marginTop: "8px" }}>
              <button
                id="signup-back-btn"
                type="button"
                onClick={handleBack}
                disabled={loading}
                style={{
                  background: "none", border: "none",
                  color: "var(--text-muted)", fontWeight: "500",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "Raleway, sans-serif",
                  transition: "color 0.2s ease",
                  display: "flex", alignItems: "center", gap: "5px",
                  opacity: loading ? 0.4 : 1
                }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = "var(--gold-mid)" }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
              >
                <ArrowLeft size={15} /> Back
              </button>
              <button
                id="signup-create-btn"
                className="btn"
                type="button"
                onClick={createAccount}
                disabled={!isStep2Valid}
                style={{
                  padding: "12px 32px", fontSize: "14px",
                  opacity: isStep2Valid ? 1 : 0.5,
                  cursor: isStep2Valid ? "pointer" : "not-allowed",
                  display: "inline-flex", alignItems: "center", gap: "8px"
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Creating Identity...
                  </>
                ) : (
                  "Create Identity"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          SUCCESS MODAL (unchanged)
          ══════════════════════════════════════════════ */}
      {showSuccessModal && (
        <div className="modal-overlay" style={{ backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-content" style={{ width: "100%", maxWidth: "520px", padding: "32px", borderRadius: "24px", textAlign: "center" }}>
            <div style={{
              color: "var(--gold-mid)", marginBottom: "16px",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "64px", height: "64px", borderRadius: "50%",
              background: "rgba(212, 175, 55, 0.08)", border: "1px solid rgba(212, 175, 55, 0.2)"
            }}>
              <CheckCircle size={32} />
            </div>
            <h3 style={{
              fontFamily: "'Cinzel', serif", fontSize: "24px", color: "var(--gold-mid)",
              marginBottom: "12px", letterSpacing: "1px"
            }}>Identity Registered!</h3>
            <p style={{ marginBottom: "24px", color: "var(--text-bright)", fontSize: "15px" }}>
              Welcome to the network, <strong style={{ color: "var(--gold-mid)", fontSize: "16px" }}>{name}</strong>!
            </p>

            <p style={{ marginBottom: "8px", color: "var(--text-muted)", fontSize: "13px", textAlign: "left", fontWeight: "600" }}>
              Your universal identifier:
            </p>
            <div style={{
              background: "var(--bg-panel)", border: "1px solid var(--border-gold)",
              borderRadius: "12px", padding: "14px 18px", marginBottom: "20px",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)"
            }}>
              <span style={{
                fontFamily: "Courier New, monospace", fontSize: "13px",
                color: "var(--gold-light)", fontWeight: "600", wordBreak: "break-all",
              }}>{createdEmail}</span>
              <button
                type="button"
                onClick={async () => {
                  const { copyToClipboard } = await import("@/utils/clipboard")
                  copyToClipboard(createdEmail)
                  setCopiedEmail(true)
                  setTimeout(() => setCopiedEmail(false), 2000)
                }}
                style={{
                  background: copiedEmail ? "rgba(76,175,110,0.15)" : "none",
                  border: copiedEmail ? "1px solid #4caf6e" : "1px solid var(--gold-mid)",
                  borderRadius: "8px", padding: "6px 12px", cursor: "pointer",
                  color: copiedEmail ? "#4caf6e" : "var(--gold-mid)",
                  fontSize: "12px", whiteSpace: "nowrap", flexShrink: 0,
                  fontWeight: "600", transition: "all 0.2s ease",
                  display: "flex", alignItems: "center", gap: "4px"
                }}
              >
                <Clipboard size={14} /> {copiedEmail ? "Copied!" : "Copy"}
              </button>
            </div>

            <div style={{
              background: "rgba(212, 175, 55, 0.03)", border: "1px solid var(--border-gold)",
              borderRadius: "14px", padding: "20px", marginBottom: "20px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
            }}>
              <p style={{
                fontSize: "12px", color: "var(--gold-mid)", fontWeight: "700",
                textTransform: "uppercase", marginBottom: "12px", letterSpacing: "1px",
                display: "flex", alignItems: "center", gap: "6px", justifyContent: "center"
              }}>
                <ShieldCheck size={16} /> Recovery Phrase (Secure Vault)
              </p>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px",
                textAlign: "left", background: "rgba(0,0,0,0.2)",
                padding: "12px", borderRadius: "8px",
                border: "1px solid rgba(212, 175, 55, 0.1)"
              }}>
                {mnemonic.split(" ").map((word, i) => (
                  <div key={i} style={{ fontSize: "13px", color: "var(--text-bright)", fontFamily: "monospace" }}>
                    <span style={{ color: "var(--text-dim)", marginRight: "6px" }}>{i + 1}.</span>
                    {word}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={async () => {
                  const { copyToClipboard } = await import("@/utils/clipboard")
                  copyToClipboard(mnemonic)
                  setCopiedMnemonic(true)
                  setTimeout(() => setCopiedMnemonic(false), 2000)
                }}
                style={{
                  marginTop: "16px",
                  background: copiedMnemonic ? "rgba(76,175,110,0.15)" : "rgba(212, 175, 55, 0.08)",
                  border: copiedMnemonic ? "1px solid #4caf6e" : "1px solid var(--border-gold)",
                  borderRadius: "8px", padding: "8px 16px",
                  color: copiedMnemonic ? "#4caf6e" : "var(--gold-mid)",
                  fontSize: "12px", fontWeight: "600", cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "inline-flex", alignItems: "center", gap: "6px"
                }}
              >
                <Clipboard size={14} /> {copiedMnemonic ? "Recovery Phrase Copied!" : "Copy Recovery Phrase"}
              </button>
            </div>

            <div style={{
              background: "rgba(232, 66, 52, 0.08)", border: "1px solid rgba(232, 66, 52, 0.2)",
              borderRadius: "10px", padding: "12px 16px", marginBottom: "24px",
              display: "flex", alignItems: "flex-start", gap: "10px", textAlign: "left"
            }}>
              <ShieldAlert size={18} color="#e84234" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <p style={{ fontSize: "12px", fontWeight: "700", color: "#e84234", marginBottom: "4px" }}>
                  Action Required: Save Credentials Securely
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, lineHeight: "1.5" }}>
                  Write down your recovery phrase and backup your identifier. There are no centralized servers to recover your password if lost.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                id="signup-proceed-btn"
                className="btn"
                type="button"
                onClick={() => {
                  setShowSuccessModal(false)
                  window.location.href = `/login?email=${encodeURIComponent(createdEmail)}`
                }}
                style={{ padding: "12px 32px", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                Proceed to Sign In <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
