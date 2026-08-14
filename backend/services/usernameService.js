/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized Username Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides:
 *   - Strict username format validation (3-30 chars, no spaces, no consecutive special chars, etc.)
 *   - Reserved username lookup
 *   - Fast cached availability lookup against GunDB mesh
 *   - Readable username suggestion generation
 */

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "support", "help", "security", "root", "system",
  "dmail", "etherx", "mail", "postmaster", "info", "contact", "api", "webmaster",
  "test", "null", "undefined", "owner", "master", "host", "abuse", "privacy",
  "terms", "billing", "sales", "helpdesk", "service", "status", "noreply", "no-reply"
])

// In-memory cache for username availability lookups (TTL: 45 seconds)
const availabilityCache = new Map()
const CACHE_TTL_MS = 45 * 1000

function getCachedResult(username) {
  const entry = availabilityCache.get(username.toLowerCase())
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    availabilityCache.delete(username.toLowerCase())
    return null
  }
  return entry.result
}

function setCachedResult(username, result) {
  availabilityCache.set(username.toLowerCase(), {
    timestamp: Date.now(),
    result
  })
}

/**
 * Validates format according to strict rules:
 * - 3–30 characters
 * - lowercase alphanumeric plus '.', '_', '-'
 * - no spaces
 * - no consecutive dots or special characters (e.g. '..', '._', '.-', '--', '__')
 * - cannot start or end with '.', '_', '-'
 */
export function validateUsernameFormat(rawUsername) {
  if (!rawUsername || typeof rawUsername !== "string") {
    return { valid: false, error: "Username is required." }
  }

  const username = rawUsername.trim().toLowerCase()

  if (username.includes(" ")) {
    return { valid: false, error: "Username must not contain spaces." }
  }

  if (username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters long." }
  }

  if (username.length > 30) {
    return { valid: false, error: "Username must not exceed 30 characters." }
  }

  // Check valid characters
  const validCharsRegex = /^[a-z0-9._-]+$/
  if (!validCharsRegex.test(username)) {
    return { valid: false, error: "Username can only contain letters, numbers, dots, hyphens, and underscores." }
  }

  // Cannot start or end with dot, underscore, or hyphen
  if (/^[._-]/.test(username) || /[._-]$/.test(username)) {
    return { valid: false, error: "Username cannot start or end with a dot, hyphen, or underscore." }
  }

  // No consecutive special characters
  if (/[._-]{2,}/.test(username)) {
    return { valid: false, error: "Username cannot contain consecutive special characters." }
  }

  return { valid: true }
}

/**
 * Checks if a username is in the reserved list
 */
export function isReservedUsername(rawUsername) {
  if (!rawUsername) return false
  const clean = rawUsername.trim().toLowerCase()
  return RESERVED_USERNAMES.has(clean)
}

/**
 * Checks availability of a username against GunDB mesh and reserved list.
 */
export async function checkUsernameAvailability(gun, rawUsername, primaryDomain = "etherxinnovations.in", aliasDomain = "securemail.com") {
  if (!rawUsername) {
    return { available: false, status: "invalid", message: "Username is required." }
  }

  // Clean username
  let clean = rawUsername.trim().toLowerCase()

  // If passed with domain, extract local part
  if (clean.includes("@")) {
    clean = clean.split("@")[0]
  }

  // Format validation
  const formatCheck = validateUsernameFormat(clean)
  if (!formatCheck.valid) {
    return { available: false, status: "invalid", message: formatCheck.error }
  }

  // Reserved check
  if (isReservedUsername(clean)) {
    return { available: false, status: "reserved", message: "This username is reserved by the system." }
  }

  // Cache check
  const cached = getCachedResult(clean)
  if (cached) {
    return cached
  }

  // GunDB lookup
  const variants = [
    clean,
    `${clean}@${primaryDomain}`,
    `${clean}@${aliasDomain}`
  ]

  let isTaken = false

  if (gun) {
    for (const variant of variants) {
      const exists = await new Promise((resolve) => {
        let done = false
        const timer = setTimeout(() => {
          if (!done) {
            done = true
            resolve(false)
          }
        }, 800)

        try {
          gun.get("securemail_users").get(variant).once((data) => {
            if (!done) {
              done = true
              clearTimeout(timer)
              // User exists if node exists and has keys or password
              if (data && (data.password || data.publicKey || data.email)) {
                resolve(true)
              } else {
                resolve(false)
              }
            }
          })
        } catch {
          if (!done) {
            done = true
            clearTimeout(timer)
            resolve(false)
          }
        }
      })

      if (exists) {
        isTaken = true
        break
      }
    }
  }

  const result = isTaken
    ? { available: false, status: "taken", message: "Username is already taken." }
    : { available: true, status: "available", message: "Username is available." }

  setCachedResult(clean, result)
  return result
}

/**
 * Generates readable username suggestions based on Full Name.
 * Order strategy:
 *   john.doe
 *   john_doe
 *   johndoe
 *   john.doe26
 *   john26
 *   johndoe01
 */
export async function generateSuggestions(gun, fullName, primaryDomain = "etherxinnovations.in", aliasDomain = "securemail.com") {
  if (!fullName || typeof fullName !== "string") {
    return []
  }

  const cleanParts = fullName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (cleanParts.length === 0) return []

  const firstName = cleanParts[0]
  const lastName = cleanParts.length > 1 ? cleanParts[cleanParts.length - 1] : ""
  const currentYear = new Date().getFullYear().toString().slice(-2) // e.g. "26"

  const candidates = []

  if (firstName && lastName) {
    candidates.push(`${firstName}.${lastName}`)
    candidates.push(`${firstName}_${lastName}`)
    candidates.push(`${firstName}${lastName}`)
    candidates.push(`${firstName}.${lastName}${currentYear}`)
    candidates.push(`${firstName}${currentYear}`)
    candidates.push(`${firstName}${lastName}01`)
    candidates.push(`${firstName[0]}.${lastName}`)
    candidates.push(`${firstName[0]}${lastName}${currentYear}`)
  } else {
    candidates.push(`${firstName}`)
    candidates.push(`${firstName}${currentYear}`)
    candidates.push(`${firstName}_dmail`)
    candidates.push(`${firstName}01`)
    candidates.push(`${firstName}2026`)
  }

  const availableSuggestions = []

  for (const candidate of candidates) {
    if (availableSuggestions.length >= 3) break

    // Basic format check first
    const fmt = validateUsernameFormat(candidate)
    if (!fmt.valid || isReservedUsername(candidate)) continue

    const check = await checkUsernameAvailability(gun, candidate, primaryDomain, aliasDomain)
    if (check.available) {
      availableSuggestions.push(candidate)
    }
  }

  return availableSuggestions
}
