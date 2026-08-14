/**
 * Utility functions for normalizing, trimming, lowercasing, and deduplicating email recipient lists.
 */

/**
 * Takes a single email string or array of emails, trims whitespace, lowercases all entries,
 * removes empty or non-email strings, excludes any addresses present in excludeAddresses,
 * and returns a deduplicated, comma-separated string.
 */
export const normalizeAndDedupeRecipients = (
  input: string | string[] | null | undefined,
  excludeAddresses: (string | null | undefined)[] = []
): string => {
  if (!input) return ""

  const rawList = Array.isArray(input) ? input : input.split(/[,;]+/)
  const excludeSet = new Set(
    excludeAddresses
      .filter((addr): addr is string => Boolean(addr && typeof addr === "string"))
      .map(addr => addr.trim().toLowerCase())
  )

  const unique = new Set<string>()

  for (const raw of rawList) {
    if (!raw) continue
    const clean = raw.trim().toLowerCase()
    if (clean && clean.includes("@") && !excludeSet.has(clean)) {
      unique.add(clean)
    }
  }

  return Array.from(unique).join(", ")
}

/**
 * Takes an input recipient string or array and returns an array of unique, clean, lowercased email addresses.
 */
export const getRecipientArray = (
  input: string | string[] | null | undefined,
  excludeAddresses: (string | null | undefined)[] = []
): string[] => {
  const cleanString = normalizeAndDedupeRecipients(input, excludeAddresses)
  if (!cleanString) return []
  return cleanString.split(/[,;]+/).map(a => a.trim()).filter(Boolean)
}
