import Gun from "gun"
import crypto from "crypto"

// Connect to the local Gun relay
const gun = Gun({ peers: ["http://localhost:8765/gun"] })

const targetPrefix = "alice"
const domains = ["etherxinnovations.in", "gmail.com", "dmail.com"]

console.log(`🚀 Injecting test email into GunDB for ${targetPrefix}...`)

domains.forEach(domain => {
  const recipientEmail = `${targetPrefix}@${domain}`
  const mailId = `test_local_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

  const mailObj = {
    id: mailId,
    messageId: mailId,
    threadId: `thread_${mailId}`,
    senderEmail: "dmail-system@etherxinnovations.in",
    senderName: "DMail System",
    receiverEmail: recipientEmail,
    subject: `Test Delivery to ${domain} 🎉`,
    message: `Hello!\n\nIf you are seeing this, the local injection worked for the account: ${recipientEmail}.\n\nThis proves the database and UI are working correctly!`,
    html: `<h3>Hello!</h3><p>If you are seeing this, the local injection worked for the account: <b>${recipientEmail}</b>.</p>`,
    time: new Date().toISOString(),
    status: "inbox",
    source: "system_test",
    hasAttachments: false,
    attachmentCount: 0,
    attachments: "",
    isRead: false,
    isStarred: false,
    isPinned: false
  }

  // 1. Put in global mails
  gun.get("securemail_mails").get(mailId).put(mailObj)

  // 2. Put in user index
  gun.get(`user_mail_index:${recipientEmail}`).get(mailId).put(mailObj, (ack) => {
    if (ack.err) {
      console.error(`❌ Index error for ${domain}:`, ack.err)
    } else {
      console.log(`✅ Successfully injected into inbox: ${recipientEmail}`)
    }
  })
})

setTimeout(() => {
  console.log("Done injecting. Check your DMail inbox now!")
  process.exit(0)
}, 3000)
