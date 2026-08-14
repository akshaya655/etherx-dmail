import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import CryptoJS from "crypto-js";
import { getGatewayConfig } from "./config_manager.js";

let smtpTransporter = null;
let imapClient = null;
let isImapSyncing = false;
let imapSyncTimeout = null;

// Normalize subject by removing Re:/Fwd: prefixes and whitespace
export const normalizeSubject = (subject) => {
  if (!subject) return "";
  return subject
    .trim()
    .toLowerCase()
    .replace(/^(re|fwd|fw|reply|aw|rv|vs|antwort|odp|ref):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
};

// Index an outgoing or incoming email for thread matching
export const indexOutgoingMessage = (messageId, dmailId, threadId, userEmail, subject, gun) => {
  if (!messageId || !gun) return;
  const cleanMsgId = messageId.trim();
  console.log(`📌 [Threading] Indexing message relationship: ${cleanMsgId} -> Thread: ${threadId}`);
  
  // Index by Message-ID
  gun.get("securemail_message_ids").get(cleanMsgId).put({
    threadId: threadId,
    dmailId: dmailId,
    userEmail: userEmail.toLowerCase()
  });

  // Index by subject for fallback
  const norm = normalizeSubject(subject);
  if (norm) {
    gun.get("securemail_subject_threads").get(norm).put({
      threadId: threadId
    });
  }
};

// Initialize SMTP from configuration
export const initSMTPTransporter = () => {
  const config = getGatewayConfig();
  if (config.smtpHost && config.smtpUser && config.smtpPass) {
    console.log(`✉️ [SMTP] Initializing transporter for ${config.smtpHost}:${config.smtpPort}`);
    smtpTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: parseInt(config.smtpPort || "587"),
      secure: config.smtpSecure === true || config.smtpSecure === "true",
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });
  } else {
    smtpTransporter = null;
    console.warn("⚠️ [SMTP] SMTP credentials not fully configured. Outbound email disabled.");
  }
};

// Fetch attachment buffer from IPFS gateway
const fetchIPFSAttachment = async (cid) => {
  const gateways = [
    `https://ipfs.io/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `http://127.0.0.1:8080/ipfs/${cid}`
  ];

  for (const url of gateways) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
    } catch (e) {
      console.warn(`⚠️ [Gateway] Failed to fetch CID ${cid} from ${url}:`, e.message);
    }
  }
  throw new Error(`Failed to fetch attachment content from IPFS for CID ${cid}`);
};

// Send SMTP Email (handles attachments, CC, BCC, Reply-To, Threading)
export const sendSMTPEmail = async (mailData) => {
  if (!smtpTransporter) {
    initSMTPTransporter();
    if (!smtpTransporter) {
      throw new Error("SMTP Gateway is not configured on the server.");
    }
  }

  const config = getGatewayConfig();
  const { senderEmail, receiverEmail, subject, message, html, attachments, cc, bcc, replyTo, mailId, parentMessageId } = mailData;

  // Generate Message-ID using the local mailId
  const MAIL_DOMAIN = process.env.MAIL_DOMAIN || "etherxinnovations.in";
  const customMessageId = `<${mailId}@${MAIL_DOMAIN}>`;

  // Compute smart Reply-To so Gmail recipients can reply directly back to DMail user
  // e.g. sender train4113@etherxinnovations.in -> etherxinnovdmail+train4113@gmail.com
  let calculatedReplyTo = replyTo;
  if (!calculatedReplyTo && senderEmail && config.smtpUser) {
    const username = senderEmail.split("@")[0];
    const relayUser = config.smtpUser.split("@")[0];
    const relayDomain = config.smtpUser.split("@")[1] || "gmail.com";
    calculatedReplyTo = `${relayUser}+${username}@${relayDomain}`;
  }

  const mailOptions = {
    from: config.smtpFrom || `${config.smtpUser}`,
    to: receiverEmail,
    subject: subject,
    text: message,
    html: html || message.replace(/\n/g, "<br>"),
    cc: cc || undefined,
    bcc: bcc || undefined,
    replyTo: calculatedReplyTo || undefined,
    messageId: customMessageId,
    headers: {
      "X-Mailer": "DMail Hybrid Gateway",
      "X-DMail-Outbound": "true",
      // Threading headers — critical for replies to appear correctly in Gmail/Outlook
      ...(parentMessageId ? {
        "In-Reply-To": parentMessageId,
        "References": parentMessageId
      } : {})
    }
  };

  // Download and append IPFS/Base64 attachments if present
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = [];
    console.log(`📎 [SMTP] Resolving ${attachments.length} attachments...`);
    for (const att of attachments) {
      if (att.cid) {
        try {
          const buffer = await fetchIPFSAttachment(att.cid);
          mailOptions.attachments.push({
            filename: att.name || "attachment",
            content: buffer,
            contentType: att.type || "application/octet-stream"
          });
          console.log(`✅ [SMTP] Resolved IPFS attachment: ${att.name} (${att.cid})`);
        } catch (err) {
          console.error(`❌ [SMTP] Failed to attach IPFS file ${att.name}:`, err.message);
          throw err;
        }
      } else if (att.data) {
        // Base64 Data URL fallback
        try {
          const base64Data = att.data.split(",")[1] || att.data;
          const buffer = Buffer.from(base64Data, "base64");
          mailOptions.attachments.push({
            filename: att.name || "attachment",
            content: buffer,
            contentType: att.type || "application/octet-stream"
          });
          console.log(`✅ [SMTP] Attached base64 file: ${att.name}`);
        } catch (err) {
          console.error(`❌ [SMTP] Failed to attach base64 file ${att.name}:`, err.message);
        }
      }
    }
  }

  const info = await smtpTransporter.sendMail(mailOptions);
  console.log(`🚀 [SMTP] Email relayed to ${receiverEmail}. Message-ID: ${info.messageId || customMessageId} | Reply-To: ${calculatedReplyTo}`);
  return info.messageId || customMessageId;
};

// Upload attachment to Pinata/IPFS from the backend
const uploadAttachmentToIPFS = async (buffer, filename, mimeType, pinataJwt) => {
  if (!pinataJwt) {
    throw new Error("Pinata JWT not configured on backend");
  }
  const blob = new Blob([buffer], { type: mimeType || "application/octet-stream" });
  const formData = new FormData();
  formData.append("file", blob, filename || `attachment_${Date.now()}`);
  formData.append("pinataMetadata", JSON.stringify({ name: filename || `attachment_${Date.now()}` }));
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${pinataJwt}`
    },
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Pinata upload failed: ${errText}`);
  }

  const result = await response.json();
  return result.IpfsHash;
};

// Lookup thread ID by Message-ID
const findThreadByMessageId = async (gun, msgId) => {
  if (!msgId) return null;
  const cleanId = msgId.trim();
  return new Promise((resolve) => {
    gun.get("securemail_message_ids").get(cleanId).once((data) => {
      resolve(data ? data.threadId : null);
    });
    setTimeout(() => resolve(null), 1500);
  });
};

// Lookup thread ID by Subject
const findThreadBySubject = async (gun, subject) => {
  const norm = normalizeSubject(subject);
  if (!norm) return null;
  return new Promise((resolve) => {
    gun.get("securemail_subject_threads").get(norm).once((data) => {
      resolve(data ? data.threadId : null);
    });
    setTimeout(() => resolve(null), 1500);
  });
};

// In-memory dedup set — tracks mailIds already written this session
const syncedIds = new Set();

// Background IMAP Sync Worker — uses IDLE push for near-instant delivery
export const startIMAPSync = async (gun) => {
  // Stop any existing worker
  if (imapSyncTimeout) {
    clearTimeout(imapSyncTimeout);
    imapSyncTimeout = null;
  }
  if (imapClient) {
    try { await imapClient.logout(); } catch (e) {}
    imapClient = null;
  }

  const config = getGatewayConfig();
  if (!config.imapHost || !config.imapUser || !config.imapPass) {
    console.warn("⚠️ [IMAP] Credentials not configured. Inbound sync disabled.");
    return;
  }

  const MAIL_DOMAIN = process.env.MAIL_DOMAIN || "etherxinnovations.in";
  const cleanRelayEmail = config.imapUser.trim().toLowerCase();

  const buildMailObj = async (parsed, gun) => {
    const messageId = parsed.messageId;
    if (!messageId) return null;

    const mailId = "smtp_" + CryptoJS.SHA256(messageId).toString();

    // In-memory dedup — skip if already synced this session
    if (syncedIds.has(mailId)) return null;

    let rawTo = parsed.to?.value?.[0]?.address?.toLowerCase() || cleanRelayEmail;
    let recipientEmail = rawTo;

    // Support Gmail plus-addressing: relay+username@gmail.com → username@domain
    if (rawTo.includes("+")) {
      const plusMatch = rawTo.match(/\+([^@]+)@/);
      if (plusMatch && plusMatch[1]) {
        recipientEmail = `${plusMatch[1]}@${MAIL_DOMAIN}`;
      }
    }

    const senderEmail = parsed.from?.value?.[0]?.address || "unknown@email.com";
    const senderName = parsed.from?.value?.[0]?.name || senderEmail.split("@")[0];

    // Thread resolution
    let threadId = null;
    if (parsed.inReplyTo) threadId = await findThreadByMessageId(gun, parsed.inReplyTo);
    if (!threadId && parsed.references) {
      const refs = Array.isArray(parsed.references) ? parsed.references : [parsed.references];
      for (const ref of refs) {
        threadId = await findThreadByMessageId(gun, ref);
        if (threadId) break;
      }
    }
    if (!threadId) threadId = await findThreadBySubject(gun, parsed.subject);
    if (!threadId) threadId = mailId;

    // Handle attachments (IPFS upload or base64 data URL fallback)
    const attachments = [];
    const pinataJwt = process.env.PINATA_JWT || "";

    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const att of parsed.attachments) {
        let cid = null;
        let dataUrl = null;

        if (pinataJwt) {
          try {
            cid = await uploadAttachmentToIPFS(att.content, att.filename, att.contentType, pinataJwt);
            console.log(`📎 [IMAP] Attachment uploaded to IPFS: ${att.filename} (${cid})`);
          } catch (e) {
            console.warn(`⚠️ [IMAP] IPFS upload failed for ${att.filename}, falling back to Data URL:`, e.message);
          }
        }

        // Always store base64 Data URL for files under 5MB — enables instant local download
        // even when IPFS is available, avoiding gateway latency/failures
        if (att.content && att.content.length < 5 * 1024 * 1024) {
          const mime = att.contentType || "application/octet-stream";
          dataUrl = `data:${mime};base64,${att.content.toString("base64")}`;
        }

        attachments.push({
          name: att.filename || "attachment",
          size: att.size || att.content?.length || 0,
          type: att.contentType || "application/octet-stream",
          cid: cid || undefined,      // IPFS CID for decentralised access
          data: dataUrl || undefined  // Base64 for instant local download
        });
      }
    }

    // Build robust message text and HTML
    const plainText = parsed.text ? parsed.text.trim() : "";
    const rawHtml = parsed.html ? parsed.html.trim() : "";
    const htmlToText = rawHtml ? rawHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";

    const messageContent = plainText || htmlToText || "(No Content)";
    const htmlContent = rawHtml || (plainText ? plainText.replace(/\n/g, "<br>") : messageContent);

    return {
      mailId,
      mailObj: {
        id: mailId,
        threadId,
        messageId,
        senderEmail,
        senderName,
        receiverEmail: recipientEmail,
        subject: parsed.subject || "(No Subject)",
        message: messageContent,
        html: htmlContent,
        time: (parsed.date || new Date()).toISOString(),
        status: "inbox",
        source: "smtp",
        hasAttachments: attachments.length > 0,
        attachmentCount: attachments.length,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : "",
        isRead: false,
        isStarred: false,
        isPinned: false
      },
      recipientEmail
    };
  };

  const writeToGun = (mailId, mailObj, recipientEmail) => {
    syncedIds.add(mailId);
    gun.get("securemail_mails").get(mailId).put(mailObj);
    gun.get(`user_mail_index:${recipientEmail}`).get(mailId).put(mailObj);
    if (recipientEmail !== cleanRelayEmail) {
      gun.get(`user_mail_index:${cleanRelayEmail}`).get(mailId).put(mailObj);
    }
    gun.get(`user_mail_index:${mailObj.senderEmail.toLowerCase()}`).get(mailId).put(mailObj);
    indexOutgoingMessage(mailObj.messageId, mailId, mailObj.threadId, recipientEmail, mailObj.subject, gun);
    console.log(`✅ [IMAP] Delivered: "${mailObj.subject}" → ${recipientEmail}`);
  };

  // Fetch and process only UNSEEN messages
  const syncUnseen = async (client) => {
    if (isImapSyncing) return;
    isImapSyncing = true;
    try {
      const unseenUids = await client.search({ seen: false });
      if (unseenUids && unseenUids.length > 0) {
        console.log(`📥 [IMAP] Processing ${unseenUids.length} unseen message(s)...`);
        for (const uid of unseenUids) {
          try {
            const msg = await client.fetchOne(uid, { source: true });
            if (!msg?.source) continue;
            const parsed = await simpleParser(msg.source);
            const result = await buildMailObj(parsed, gun);
            if (result) {
              const { mailId, mailObj, recipientEmail } = result;
              writeToGun(mailId, mailObj, recipientEmail);
              // Mark as seen so we don't re-process on next poll
              await client.messageFlagsAdd(uid, ["\\Seen"]);
            }
          } catch (msgErr) {
            console.error(`❌ [IMAP] Error processing message uid=${uid}:`, msgErr.message);
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ [IMAP] Search unseen failed:", e.message);
    } finally {
      isImapSyncing = false;
    }
  };

  // Connect and start persistent IDLE session
  const connect = async () => {
    imapClient = new ImapFlow({
      host: config.imapHost,
      port: parseInt(config.imapPort || "993"),
      secure: config.imapSecure === true || config.imapSecure === "true",
      auth: { user: config.imapUser, pass: config.imapPass },
      logger: false
    });

    imapClient.on("error", (err) => {
      console.warn("⚠️ [IMAP] Connection error:", err.message);
    });

    // ⚡ [Instant Push] Trigger immediate sync on IMAP 'exists' event (fired on incoming mail)
    imapClient.on("exists", async (data) => {
      console.log(`⚡ [IMAP PUSH] Instant event received! Total inbox count: ${data.count}. Syncing...`);
      await syncUnseen(imapClient);
    });

    try {
      console.log(`🔌 [IMAP] Connecting to ${config.imapHost}:${config.imapPort}...`);
      await imapClient.connect();
      console.log("✅ [IMAP] Connected to Gmail IMAP.");

      // Open INBOX and run initial sweep
      await imapClient.mailboxOpen("INBOX");
      await syncUnseen(imapClient);

      // Start IDLE loop
      console.log("⚡ [IMAP] Real-time IDLE PUSH active — instant mail delivery enabled.");
      while (imapClient.usable) {
        try {
          await imapClient.idle();
        } catch (idleErr) {
          console.warn("⚠️ [IMAP] IDLE interrupted, restarting loop...", idleErr.message);
          break;
        }
      }
    } catch (err) {
      console.error("❌ [IMAP] Connection error:", err.message);
    }

    // On disconnect/timeout, reconnect after 5s
    console.log("🔄 [IMAP] Reconnecting in 5s...");
    imapSyncTimeout = setTimeout(connect, 5000);
  };

  // Start the persistent connection
  connect();

  // 3-second fallback sweep to catch any edge cases
  setInterval(async () => {
    if (!imapClient || !imapClient.usable || isImapSyncing) return;
    try {
      await syncUnseen(imapClient);
    } catch(e) {}
  }, 3000);
};

