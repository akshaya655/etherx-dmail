import { SMTPServer } from "smtp-server"
import { simpleParser } from "mailparser"
import Gun from "gun"
import crypto from "crypto"

// Connect to local Gun relay
const gun = Gun({ peers: ["http://localhost:8765/gun"] })

const PORT = 2525

const server = new SMTPServer({
  // Disable AUTH so we can just send test emails unauthenticated
  disabledCommands: ['AUTH'],
  
  onData(stream, session, callback) {
    simpleParser(stream, async (err, parsed) => {
      if (err) {
        console.error("❌ [SMTP] Error parsing email:", err)
        return callback(err)
      }

      try {
        const recipients = session.envelope.rcptTo.map(r => r.address.toLowerCase())
        if (recipients.length === 0) {
          console.warn("⚠️ [SMTP] No recipients found in envelope")
          return callback()
        }

        const senderEmail = (session.envelope.mailFrom ? session.envelope.mailFrom.address : (parsed.from?.value[0]?.address || "unknown")).toLowerCase()
        const senderName = parsed.from?.value[0]?.name || senderEmail.split("@")[0]

        console.log(`\n📥 [SMTP] Incoming Email`)
        console.log(`   From: ${senderName} <${senderEmail}>`)
        console.log(`   To: ${recipients.join(", ")}`)
        console.log(`   Subject: ${parsed.subject}`)

        const messageContent = parsed.text || parsed.html || "(No content)"
        
        for (const recipientEmail of recipients) {
          const mailId = `smtp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
          const mailObj = {
            id: mailId,
            messageId: parsed.messageId || mailId,
            threadId: `thread_${mailId}`,
            senderEmail,
            senderName,
            receiverEmail: recipientEmail,
            subject: parsed.subject || "(No Subject)",
            message: messageContent,
            html: parsed.html || "",
            time: (parsed.date || new Date()).toISOString(),
            status: "inbox",
            source: "smtp_local",
            hasAttachments: false,
            attachmentCount: 0,
            attachments: "",
            isRead: false,
            isStarred: false,
            isPinned: false
          }

          // Write to global mail collection
          gun.get("securemail_mails").get(mailId).put(mailObj, (ack) => {
             console.log(`Global Put Ack:`, ack.err ? ack.err : "Success")
          })
          
          // Write to user index
          gun.get(`user_mail_index:${recipientEmail}`).get(mailId).put(mailObj, (ack) => {
             console.log(`User Index Put Ack:`, ack.err ? ack.err : "Success")
          })
          
          // Also index for the sender if internal
          gun.get(`user_mail_index:${senderEmail}`).get(mailId).put(mailObj)

          console.log(`✅ [SMTP] Delivered locally to DMail inbox for: ${recipientEmail}`)
        }
      } catch (e) {
        console.error("❌ [SMTP] Delivery failed:", e)
      }

      callback()
    })
  }
})

server.listen(PORT, () => {
  console.log(`\n🚀 Local SMTP Server listening on port ${PORT}`)
  console.log(`You can now send test emails to this port. Example with telnet:`)
  console.log(`$ telnet localhost ${PORT}`)
  console.log(`Or using a Node script. All emails received will appear instantly in the DMail frontend!`)
})
