"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import ComposeWindow from "@/components/ComposeWindow"
import { normalizeAndDedupeRecipients } from "@/utils/recipientUtils"

function ComposeInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [open, setOpen] = useState(true)

  const rawTo = searchParams.get("to") || ""
  const rawCc = searchParams.get("cc") || ""
  const rawBcc = searchParams.get("bcc") || ""
  const defaultSubject = searchParams.get("subject") || ""
  const defaultMessage = searchParams.get("message") || ""
  const defaultDraftId = searchParams.get("draftId") || undefined

  const defaultTo = normalizeAndDedupeRecipients(rawTo)
  const defaultCc = normalizeAndDedupeRecipients(rawCc)
  const defaultBcc = normalizeAndDedupeRecipients(rawBcc)

  const handleClose = () => {
    setOpen(false)
    router.back()
  }

  if (!open) return null

  return (
    <ComposeWindow
      onClose={handleClose}
      defaultTo={defaultTo}
      defaultCc={defaultCc}
      defaultBcc={defaultBcc}
      defaultSubject={defaultSubject}
      defaultMessage={defaultMessage}
      defaultDraftId={defaultDraftId}
    />
  )
}

export default function ComposePage() {
  return (
    <Suspense>
      <div style={{
        height: "100%", display: "flex", alignItems: "center",
        justifyContent: "center", color: "var(--text-muted)",
        fontSize: "13px", flexDirection: "column", gap: "8px",
      }}>
        <span style={{ fontSize: "32px", opacity: 0.3 }}>✏️</span>
        <span>Opening compose window...</span>
      </div>
      <ComposeInner />
    </Suspense>
  )
}
