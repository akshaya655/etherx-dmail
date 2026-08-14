"use client"

/**
 * Compose.tsx — Legacy wrapper
 * Delegates to ComposeWindow which uses PGP (OpenPGP.js) + IPFS (Kubo) + GunDB.
 * The old CryptoJS AES implementation has been removed — it was incompatible
 * with the global mail network and could not be read by any inbox.
 */
import ComposeWindow from "@/components/ComposeWindow"
import { normalizeAndDedupeRecipients } from "@/utils/recipientUtils"

interface ComposeProps {
  onClose: () => void
  defaultTo?: string
  defaultCc?: string
  defaultBcc?: string
  defaultSubject?: string
  defaultMessage?: string
  defaultDraftId?: string
}

export default function Compose({ onClose, defaultTo, defaultCc, defaultBcc, defaultSubject, defaultMessage, defaultDraftId }: ComposeProps) {
  // Normalize each field independently — never pass To as excludeAddresses for CC
  const cleanTo = normalizeAndDedupeRecipients(defaultTo)
  const cleanCc = normalizeAndDedupeRecipients(defaultCc)
  const cleanBcc = normalizeAndDedupeRecipients(defaultBcc)

  return (
    <ComposeWindow
      onClose={onClose}
      defaultTo={cleanTo}
      defaultCc={cleanCc}
      defaultBcc={cleanBcc}
      defaultSubject={defaultSubject}
      defaultMessage={defaultMessage}
      defaultDraftId={defaultDraftId}
    />
  )
}
