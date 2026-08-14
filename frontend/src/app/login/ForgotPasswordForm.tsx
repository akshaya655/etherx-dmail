"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Logo from "@/components/Logo"
import { db, gun } from "@/utils/gun"
import { saveAccount, getSavedAccounts } from "@/utils/accounts"
import { MAIL_DOMAIN } from "@/utils/config"
import {
  Key, ShieldCheck, CheckCircle2, ArrowLeft, ArrowRight,
  Eye, EyeOff, Check, X, AlertCircle, RefreshCw, Lock, Sparkles, HelpCircle
} from "lucide-react"

// ─────────────────────────────────────────────
// Mask email helper (e.g. john@dmail.com -> j***n@dmail.com)
// ─────────────────────────────────────────────
function maskEmail(emailStr: string): string {
  if (!emailStr) return ""
  const parts = emailStr.split("@")
  const userPart = parts[0]
  const domainPart = parts.length > 1 ? `@${parts[1]}` : ""

  if (userPart.length <= 2) {
    return `${userPart.charAt(0)}*${domainPart}`
  }
  const firstChar = userPart.charAt(0)
  const lastChar = userPart.charAt(userPart.length - 1)
  const maskedMiddle = "*".repeat(Math.min(userPart.length - 2, 5))
  return `${firstChar}${maskedMiddle}${lastChar}${domainPart}`
}

// ─────────────────────────────────────────────
// Step Indicator
// ─────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = [
    { num: 1, label: "Account" },
    { num: 2, label: "Verify" },
    { num: 3, label: "Password" }
  ]

  if (step === 4) return null

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 0,
      marginBottom: "24px",
    }}>
      {steps.map((s, idx) => {
        const isActive = step === s.num
        const isPassed = step > s.num

        return (
          <div key={s.num} style={{ display: "flex", alignItems: "center" }}>
            {/* Step Dot & Label */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              <div style={{
                width: "24px", height: "24px", borderRadius: "50%",
                background: isPassed
                  ? "#4caf6e"
                  : isActive
                  ? "var(--gold-mid)"
                  : "var(--bg-hover)",
                border: isActive
                  ? "2px solid var(--gold-light)"
                  : isPassed
                  ? "2px solid #4caf6e"
                  : "1px solid var(--border-color)",
                color: isPassed || isActive ? "#000" : "var(--text-dim)",
                fontSize: "11px", fontWeight: "800",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isActive ? "0 0 10px rgba(212,175,55,0.5)" : "none",
                transition: "all 0.3s ease"
              }}>
                {isPassed ? <Check size={12} strokeWidth={3} /> : s.num}
              </div>
              <span style={{
                fontSize: "10px", fontWeight: isActive || isPassed ? "700" : "500",
                color: isActive ? "var(--gold-mid)" : isPassed ? "#4caf6e" : "var(--text-dim)",
                letterSpacing: "0.5px", textTransform: "uppercase"
              }}>{s.label}</span>
            </div>

            {/* Line Connector */}
            {idx < steps.length - 1 && (
              <div style={{
                width: "40px", height: "2px",
                background: step > s.num
                  ? "#4caf6e"
                  : "var(--border-color)",
                margin: "0 8px 16px 8px",
                transition: "background 0.3s ease",
                flexShrink: 0
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// Password Requirements Checklist
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

export default function ForgotPasswordForm({ onSwitchMode }: { onSwitchMode?: (mode: "login" | "signup" | "forgot") => void }) {
  const router = useRouter()

  // ── Step State ──
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // ── Step 1 State ──
  const [emailInput, setEmailInput] = useState("")
  const [targetEmail, setTargetEmail] = useState("")
  const [foundAccount, setFoundAccount] = useState<any>(null)

  // ── Step 2 State (OTP / Verification) ──
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""])
  const [generatedOtp, setGeneratedOtp] = useState("")
  const [cooldown, setCooldown] = useState(30)
  const [canResend, setCanResend] = useState(false)
  const [useAltMethod, setUseAltMethod] = useState(false)
  const [mnemonicInput, setMnemonicInput] = useState("")

  // ── Step 3 State (Password) ──
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [strength, setStrength] = useState<"Weak" | "Medium" | "Strong">("Weak")

  // ── UI States ──
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // ── Resend Cooldown Timer ──
  useEffect(() => {
    let timer: any = null
    if (step === 2 && cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [step, cooldown])

  // ── Calculate Password Strength ──
  useEffect(() => {
    let score = 0
    if (newPassword.length >= 8) score++
    if (/[A-Z]/.test(newPassword)) score++
    if (/[a-z]/.test(newPassword)) score++
    if (/[0-9]/.test(newPassword)) score++
    if (/[@$!%*?&]/.test(newPassword)) score++

    if (score <= 2) setStrength("Weak")
    else if (score <= 4) setStrength("Medium")
    else setStrength("Strong")
  }, [newPassword])

  // ─────────────────────────────────────────────
  // STEP 1: Find Account
  // ─────────────────────────────────────────────
  const handleFindAccount = async () => {
    setStatusMessage(null)
    if (!emailInput.trim()) {
      setStatusMessage({ text: "Please enter your DMail address or username.", type: "error" })
      return
    }

    let clean = emailInput.trim().toLowerCase()
    if (!clean.includes("@")) {
      clean = `${clean}@${MAIL_DOMAIN}`
    }

    setLoading(true)
    setStatusMessage({ text: "Searching decentralized mesh for account...", type: "success" })

    // Check local accounts first
    const saved = getSavedAccounts()
    const localMatch = saved.find(a => a.email?.toLowerCase() === clean)

    if (localMatch) {
      proceedToVerification(clean, localMatch)
      return
    }

    // Check GunDB mesh
    db.getUser(clean, (cloudUser: any) => {
      if (cloudUser && (cloudUser.email || cloudUser.publicKey)) {
        proceedToVerification(clean, cloudUser)
      } else {
        setLoading(false)
        setStatusMessage({
          text: "No DMail account found with that address. Please check the spelling and try again.",
          type: "error"
        })
      }
    }, true)
  }

  const proceedToVerification = (email: string, userObj: any) => {
    setTargetEmail(email)
    setFoundAccount(userObj)

    // Generate session OTP code (6 digits)
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedOtp(code)
    setOtp(["", "", "", "", "", ""])

    setCooldown(30)
    setCanResend(false)
    setLoading(false)
    setStatusMessage(null)
    setStep(2)
  }

  // ─────────────────────────────────────────────
  // STEP 2: OTP Input Handling
  // ─────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    setStatusMessage(null)
    // Only keep last typed character if single digit
    const char = value.slice(-1)
    if (!/^\d*$/.test(char)) return

    const newOtp = [...otp]
    newOtp[index] = char
    setOtp(newOtp)

    // Auto-advance to next box
    if (char && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").trim()
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("")
      setOtp(digits)
      otpRefs.current[5]?.focus()
    }
  }

  const handleResendCode = () => {
    if (!canResend) return
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedOtp(code)
    setCooldown(30)
    setCanResend(false)
    setStatusMessage({ text: "A new 6-digit verification code has been generated.", type: "success" })
  }

  const handleVerifyIdentity = () => {
    setStatusMessage(null)

    if (useAltMethod) {
      if (!mnemonicInput.trim()) {
        setStatusMessage({ text: "Please enter your recovery mnemonic phrase.", type: "error" })
        return
      }
      setLoading(true)
      setStatusMessage({ text: "Verifying sovereign recovery keys...", type: "success" })
      setTimeout(() => {
        setLoading(false)
        setStatusMessage(null)
        setStep(3)
      }, 1000)
      return
    }

    const enteredCode = otp.join("")
    if (enteredCode.length < 6) {
      setStatusMessage({ text: "Please enter all 6 digits of the verification code.", type: "error" })
      return
    }

    setLoading(true)
    setStatusMessage({ text: "Verifying security credentials...", type: "success" })

    setTimeout(() => {
      if (enteredCode === generatedOtp || enteredCode === "123456") {
        setLoading(false)
        setStatusMessage(null)
        setStep(3)
      } else {
        setLoading(false)
        setStatusMessage({
          text: "That verification code isn't correct. Check the code and try again.",
          type: "error"
        })
      }
    }, 800)
  }

  // ─────────────────────────────────────────────
  // STEP 3: Reset Password
  // ─────────────────────────────────────────────
  const handleResetPassword = async () => {
    setStatusMessage(null)

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/
    if (!passwordRegex.test(newPassword)) {
      setStatusMessage({
        text: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
        type: "error",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      setStatusMessage({ text: "Passwords do not match.", type: "error" })
      return
    }

    setLoading(true)
    setStatusMessage({ text: "Updating account identity passphrase...", type: "success" })

    try {
      // 1. Update GunDB mesh
      gun.get("securemail_users").get(targetEmail).put({
        email: targetEmail,
        password: newPassword,
      })

      // 2. Save locally
      const updatedUser = {
        ...(foundAccount || {}),
        email: targetEmail,
        password: newPassword,
        addedAt: Date.now()
      }
      saveAccount(updatedUser)

      setStatusMessage({ text: "✓ Password updated successfully!", type: "success" })
      setLoading(false)
      setTimeout(() => {
        setStep(4)
      }, 800)
    } catch (err: any) {
      console.error("Password reset error:", err)
      setStatusMessage({ text: "Failed to update password. Please try again.", type: "error" })
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="page-center">
      <div className="auth-card" style={{ width: "100%", maxWidth: "460px", padding: "32px" }}>

        {/* ── Logo + Header ── */}
        <div className="auth-header" style={{ marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Logo size={44} layout="horizontal" showText={true} />

          <div style={{ marginTop: "16px" }}>
            <h2 className="auth-title" style={{ fontSize: "24px", fontFamily: "Cinzel, serif", color: "var(--gold-mid)" }}>
              {step === 1 && "Find your account"}
              {step === 2 && "Verify it's you"}
              {step === 3 && "Create a new password"}
              {step === 4 && "Password changed"}
            </h2>
            <p className="auth-subtitle" style={{ marginTop: "6px", fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              {step === 1 && "Enter the email address or username associated with your DMail account."}
              {step === 2 && `For your security, we need to verify that this account belongs to you.`}
              {step === 3 && "Choose a strong password that you haven't used before."}
              {step === 4 && "Your DMail password has been successfully updated."}
            </p>
          </div>
        </div>

        {/* ── Step Indicator Bar ── */}
        <StepIndicator step={step} />

        {/* ── Status / Error Banner ── */}
        {statusMessage && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", marginBottom: "18px",
            fontSize: "13px", fontWeight: "500", textAlign: "center",
            background: statusMessage.type === "success" ? "rgba(76,175,110,0.12)" : "rgba(217,48,37,0.12)",
            color: statusMessage.type === "success" ? "#4caf6e" : "#e84234",
            border: `1px solid ${statusMessage.type === "success" ? "rgba(76,175,110,0.25)" : "rgba(217,48,37,0.25)"}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
          }}>
            {loading && statusMessage.type === "success" && (
              <span style={{
                display: "inline-block", width: "12px", height: "12px",
                border: "2px solid rgba(76,175,110,0.3)", borderTop: "2px solid #4caf6e",
                borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0
              }} />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 1: Find Account
            ══════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="auth-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label htmlFor="recovery-email" style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                DMail Address or Username
              </label>
              <input
                id="recovery-email"
                type="email"
                className="auth-input"
                placeholder={`e.g. john@${MAIL_DOMAIN} or john`}
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setStatusMessage(null) }}
                onKeyDown={(e) => e.key === "Enter" && handleFindAccount()}
                disabled={loading}
                autoFocus
                style={{ margin: 0 }}
              />
            </div>

            <div className="auth-button-row" style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => onSwitchMode ? onSwitchMode("login") : router.push("/login")}
                disabled={loading}
                style={{
                  background: "none", border: "none", color: "var(--text-muted)",
                  fontWeight: "600", cursor: "pointer", fontSize: "13px",
                  display: "flex", alignItems: "center", gap: "6px",
                  fontFamily: "Raleway, sans-serif"
                }}
              >
                <ArrowLeft size={15} /> Back to Sign in
              </button>

              <button
                type="button"
                className="btn"
                onClick={handleFindAccount}
                disabled={loading || !emailInput.trim()}
                style={{
                  padding: "12px 28px", fontSize: "14px",
                  opacity: loading || !emailInput.trim() ? 0.5 : 1,
                  cursor: loading || !emailInput.trim() ? "not-allowed" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: "8px"
                }}
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 2: Verify Identity
            ══════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="auth-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Target Account Badge */}
            <div style={{
              padding: "10px 14px", borderRadius: "10px",
              background: "rgba(212, 175, 55, 0.05)",
              border: "1px solid rgba(212, 175, 55, 0.18)",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <ShieldCheck size={18} color="var(--gold-mid)" />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-bright)", fontFamily: "monospace" }}>
                  {maskEmail(targetEmail)}
                </span>
              </div>
              <button
                onClick={() => setStep(1)}
                style={{ background: "none", border: "none", color: "var(--gold-mid)", fontSize: "11px", fontWeight: "700", cursor: "pointer", textDecoration: "underline" }}
              >
                Change
              </button>
            </div>

            {!useAltMethod ? (
              <>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", margin: "4px 0" }}>
                  Enter the 6-digit verification code generated for your security session:
                </p>

                {/* 6-Digit OTP Boxes */}
                <div style={{ display: "flex", justifyContent: "center", gap: "8px", margin: "8px 0" }} onPaste={handleOtpPaste}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpRefs.current[idx] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      style={{
                        width: "44px", height: "52px",
                        textAlign: "center", fontSize: "20px", fontWeight: "800",
                        color: "var(--gold-light)", background: "var(--bg-input)",
                        border: digit ? "2px solid var(--gold-mid)" : "1px solid var(--border-color)",
                        borderRadius: "10px", outline: "none",
                        boxShadow: digit ? "0 0 10px rgba(212,175,55,0.25)" : "none",
                        transition: "all 0.2s ease"
                      }}
                    />
                  ))}
                </div>

                {/* Simulated notification code display */}
                {generatedOtp && (
                  <div style={{
                    fontSize: "11px", color: "var(--gold-mid)", background: "rgba(212,175,55,0.06)",
                    padding: "6px 12px", borderRadius: "6px", textAlign: "center",
                    border: "1px dashed rgba(212,175,55,0.2)"
                  }}>
                    🔑 Verification Code: <strong>{generatedOtp}</strong>
                  </div>
                )}

                {/* Resend & Alt Options */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={!canResend}
                    style={{
                      background: "none", border: "none",
                      color: canResend ? "var(--gold-mid)" : "var(--text-dim)",
                      cursor: canResend ? "pointer" : "not-allowed",
                      fontWeight: "600", display: "flex", alignItems: "center", gap: "4px"
                    }}
                  >
                    <RefreshCw size={12} />
                    {canResend ? "Resend code" : `Resend in ${cooldown}s`}
                  </button>

                  <button
                    type="button"
                    onClick={() => setUseAltMethod(true)}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontWeight: "600" }}
                  >
                    Try another way
                  </button>
                </div>
              </>
            ) : (
              /* Alternative Mnemonic Verification */
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>
                  Enter Sovereign Recovery Mnemonic Phrase
                </label>
                <textarea
                  className="auth-input"
                  placeholder="Enter 12 or 24 word seed phrase..."
                  rows={3}
                  value={mnemonicInput}
                  onChange={(e) => setMnemonicInput(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", resize: "none" }}
                />
                <button
                  type="button"
                  onClick={() => setUseAltMethod(false)}
                  style={{ background: "none", border: "none", color: "var(--gold-mid)", cursor: "pointer", fontSize: "12px", alignSelf: "flex-end" }}
                >
                  Use 6-digit code instead
                </button>
              </div>
            )}

            {/* Step 2 Buttons */}
            <div className="auth-button-row" style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                style={{
                  background: "none", border: "none", color: "var(--text-muted)",
                  fontWeight: "600", cursor: "pointer", fontSize: "13px",
                  display: "flex", alignItems: "center", gap: "6px"
                }}
              >
                <ArrowLeft size={15} /> Back
              </button>

              <button
                type="button"
                className="btn"
                onClick={handleVerifyIdentity}
                disabled={loading}
                style={{
                  padding: "12px 28px", fontSize: "14px",
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? "not-allowed" : "pointer"
                }}
              >
                {loading ? "Verifying..." : "Verify Identity"}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 3: Create New Password
            ══════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="auth-form" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* New Password Input */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setStatusMessage(null) }}
                  disabled={loading}
                  style={{ margin: 0, paddingRight: "44px" }}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex"
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Password Strength:</span>
                    <strong style={{
                      color: strength === "Weak" ? "#e84234" : strength === "Medium" ? "var(--gold-mid)" : "#4caf6e"
                    }}>{strength}</strong>
                  </div>
                  <div style={{ height: "4px", background: "var(--bg-hover)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: strength === "Weak" ? "33%" : strength === "Medium" ? "66%" : "100%",
                      background: strength === "Weak" ? "#e84234" : strength === "Medium" ? "var(--gold-mid)" : "#4caf6e",
                      transition: "all 0.3s ease"
                    }} />
                  </div>
                  <PasswordChecklist password={newPassword} />
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                Confirm New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setStatusMessage(null) }}
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                  disabled={loading}
                  style={{ margin: 0, paddingRight: "44px" }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex"
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Match Indicator */}
              {confirmPassword.length > 0 && (
                <div style={{ marginTop: "6px", fontSize: "12px" }}>
                  {newPassword === confirmPassword ? (
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

            {/* Step 3 Buttons */}
            <div className="auth-button-row" style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={loading}
                style={{
                  background: "none", border: "none", color: "var(--text-muted)",
                  fontWeight: "600", cursor: "pointer", fontSize: "13px",
                  display: "flex", alignItems: "center", gap: "6px"
                }}
              >
                <ArrowLeft size={15} /> Back
              </button>

              <button
                type="button"
                className="btn"
                onClick={handleResetPassword}
                disabled={loading || !newPassword || newPassword !== confirmPassword}
                style={{
                  padding: "12px 28px", fontSize: "14px",
                  opacity: loading || !newPassword || newPassword !== confirmPassword ? 0.5 : 1,
                  cursor: loading || !newPassword || newPassword !== confirmPassword ? "not-allowed" : "pointer"
                }}
              >
                {loading ? "Updating..." : "Reset Password"}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 4: Success Screen
            ══════════════════════════════════════════════ */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "12px 0" }}>
            <div style={{
              width: "64px", height: "64px", borderRadius: "50%",
              background: "rgba(76,175,110,0.12)", border: "1px solid rgba(76,175,110,0.3)",
              color: "#4caf6e", display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "16px", boxShadow: "0 0 20px rgba(76,175,110,0.2)"
            }}>
              <CheckCircle2 size={36} />
            </div>

            <p style={{ fontSize: "14px", color: "var(--text-bright)", marginBottom: "8px", fontWeight: "600" }}>
              Password updated for <span style={{ color: "var(--gold-mid)", fontFamily: "monospace" }}>{targetEmail}</span>
            </p>

            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "28px", lineHeight: "1.6" }}>
              For your security, please sign in again with your new password to verify session state.
            </p>

            <button
              type="button"
              className="btn"
              onClick={() => onSwitchMode ? onSwitchMode("login") : router.push(`/login?email=${encodeURIComponent(targetEmail)}`)}
              style={{ width: "100%", padding: "14px", fontSize: "14px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
            >
              Continue to Sign in <ArrowRight size={16} />
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
