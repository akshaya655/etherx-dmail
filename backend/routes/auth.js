import express from "express"
import { checkUsernameAvailability, generateSuggestions } from "../services/usernameService.js"

const router = express.Router()

/**
 * GET /api/auth/check-username?username=john
 * Standardized response:
 * { available: boolean, status: "available" | "taken" | "reserved" | "invalid", message: string }
 */
router.get("/check-username", async (req, res) => {
  try {
    const { username } = req.query
    if (!username) {
      return res.status(400).json({
        available: false,
        status: "invalid",
        message: "Username query parameter is required."
      })
    }

    const gun = req.app.locals.gun
    const result = await checkUsernameAvailability(gun, String(username))
    return res.json(result)
  } catch (err) {
    console.error("Error in /check-username:", err)
    return res.status(500).json({
      available: false,
      status: "error",
      message: "Internal server error during username verification."
    })
  }
})

/**
 * GET /api/auth/suggest-usernames?name=John%20Doe
 * Returns array of readable, available username suggestions.
 */
router.get("/suggest-usernames", async (req, res) => {
  try {
    const { name } = req.query
    if (!name) {
      return res.json({ suggestions: [] })
    }

    const gun = req.app.locals.gun
    const suggestions = await generateSuggestions(gun, String(name))
    return res.json({ suggestions })
  } catch (err) {
    console.error("Error in /suggest-usernames:", err)
    return res.status(500).json({ suggestions: [], error: err.message })
  }
})

/**
 * POST /api/gateway/register-auth
 * Server-side double-checks availability before registering to prevent race conditions.
 */
router.post("/register-auth", async (req, res) => {
  try {
    const { email, password, publicKey } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Missing email or password." })
    }

    const cleanEmail = email.trim().toLowerCase()
    const username = cleanEmail.includes("@") ? cleanEmail.split("@")[0] : cleanEmail
    const gun = req.app.locals.gun

    // Server-side double validation to prevent race condition
    const check = await checkUsernameAvailability(gun, username)
    // Note: If user is registering their exact same email again or updating key, verify if node exists with matching password
    if (!check.available && check.status !== "available") {
      // Check if it's an existing user updating auth
      const isExisting = await new Promise((resolve) => {
        let done = false
        const timer = setTimeout(() => { if (!done) { done = true; resolve(false) } }, 800)
        gun.get("securemail_users").get(cleanEmail).once((user) => {
          if (!done) {
            done = true
            clearTimeout(timer)
            resolve(user && user.password === password)
          }
        })
      })

      if (!isExisting) {
        return res.status(409).json({
          success: false,
          error: check.message || "Username is already taken or unavailable."
        })
      }
    }

    // Save to GunDB mesh
    gun.get("securemail_users").get(cleanEmail).put({
      email: cleanEmail,
      password: password,
      publicKey: publicKey || ""
    })

    return res.json({ success: true, message: "Credentials registered directly on backend." })
  } catch (err) {
    console.error("Error in /register-auth:", err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
