import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"

const client = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: { user: "etherxinnovdmail@gmail.com", pass: "hhnxsxkjpretvpzn" },
  logger: false
})

try {
  console.log("Connecting to IMAP...")
  await client.connect()
  console.log("Connected!")
  
  const lock = await client.getMailboxLock("INBOX")
  const list = await client.search({ all: true })
  const recent = list.slice(-15)
  console.log(`\n📬 Total messages in inbox: ${list.length}`)
  console.log(`Showing last ${recent.length}:\n`)

  for (const uid of recent) {
    const msg = await client.fetchOne(uid, { source: true })
    if (!msg?.source) continue
    const parsed = await simpleParser(msg.source)
    const fromAddr = parsed.from?.value?.[0]?.address || "N/A"
    const toAddr = parsed.to?.value?.[0]?.address || "N/A"
    const subject = parsed.subject || "(No Subject)"
    console.log(`  FROM: ${fromAddr}`)
    console.log(`  TO:   ${toAddr}`)
    console.log(`  SUBJ: ${subject}`)
    console.log(`  ---`)
  }

  lock.release()
  await client.logout()
  console.log("\nDone.")
} catch(e) {
  console.error("IMAP Error:", e.message)
  process.exit(1)
}
