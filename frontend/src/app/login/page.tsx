"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import LoginForm from "./LoginForm"
import SignupForm from "./SignupForm"
import ForgotPasswordForm from "./ForgotPasswordForm"

function AuthContainer() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login")

  useEffect(() => {
    const modeParam = searchParams?.get("mode")
    if (modeParam === "signup") {
      setMode("signup")
    } else if (modeParam === "forgot") {
      setMode("forgot")
    } else {
      setMode("login")
    }
  }, [searchParams])

  const switchTo = (newMode: "login" | "signup" | "forgot") => {
    setMode(newMode)
    if (newMode === "login") {
      router.replace(pathname || "/login", { scroll: false })
    } else {
      router.replace(`${pathname || "/login"}?mode=${newMode}`, { scroll: false })
    }
  }

  return (
    <>
      {mode === "login" ? (
        <LoginForm onSwitchMode={(target) => switchTo(target as any)} />
      ) : mode === "signup" ? (
        <SignupForm onSwitchMode={() => switchTo("login")} />
      ) : (
        <ForgotPasswordForm onSwitchMode={(target) => switchTo(target as any)} />
      )}
    </>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthContainer />
    </Suspense>
  )
}
