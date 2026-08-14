import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 2525,
  secure: false, // TLS requires secureConnection to be false
  tls: {
    rejectUnauthorized: false
  }
})

async function sendTestEmail() {
  console.log("🚀 Sending test email to local SMTP server (Port 2525)...")

  try {
    const info = await transporter.sendMail({
      // 1. The sender (Who is sending the email)
      from: '"Test Sender" <alice@gmail.com>',

      // 2. The recipient (THIS MUST MATCH EXACTLY THE ACCOUNT YOU ARE LOGGED INTO DMAIL WITH!)
      to: 'train4113@etherxinnovations.in',

      subject: 'Hello from Local Inbound SMTP Test! 🎉',
      text: 'This is a test email sent directly to the local SMTP receiver on port 2525.\n\nIt should instantly appear in your DMail Inbox!',
      html: '<h3>This is a test email sent directly to the local SMTP receiver on port 2525.</h3><p>It should instantly appear in your DMail Inbox!</p>'
    })

    console.log("✅ Message sent successfully:", info.messageId)
  } catch (err) {
    console.error("❌ Error sending message:", err)
  }
}

sendTestEmail()
