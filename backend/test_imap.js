import { ImapFlow } from "imapflow";
import dotenv from "dotenv";
import { getGatewayConfig } from "./config_manager.js";

dotenv.config();
const config = getGatewayConfig();

console.log("⚡ Testing Production IMAP Connection...");
console.log(`  IMAP_HOST : ${config.imapHost}`);
console.log(`  IMAP_PORT : ${config.imapPort}`);
console.log(`  IMAP_USER : ${config.imapUser}`);

const imapClient = new ImapFlow({
  host: config.imapHost,
  port: parseInt(config.imapPort || "993"),
  secure: true,
  auth: {
    user: config.imapUser,
    pass: config.imapPass
  },
  logger: false
});

(async () => {
  try {
    await imapClient.connect();
    console.log(`✅ IMAP Verification Successful! Logged in as: ${config.imapUser}`);
    const lock = await imapClient.getMailboxLock("INBOX");
    const status = await imapClient.status("INBOX", { messages: true, unseen: true });
    console.log(`📥 INBOX Status — Total Messages: ${status.messages}, Unread: ${status.unseen}`);
    lock.release();
    await imapClient.logout();
    console.log("🔌 Disconnected cleanly.");
  } catch (err) {
    console.error("❌ IMAP Verification Failed:", err.message || err);
  }
})();
