"use client"

import { Suspense } from "react"
import ForgotPasswordForm from "../login/ForgotPasswordForm"

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
