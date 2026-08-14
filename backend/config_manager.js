import fs from "fs";
import path from "path";
import CryptoJS from "crypto-js";

const CONFIG_PATH = path.join(process.cwd(), "gateway_config.json");
const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || "dmail-secure-gateway-default-key-321";

// Default pre-configured credentials provided by the user
const DEFAULT_CONFIG = {
  smtpHost: "smtp.gmail.com",
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: "etherxinnovdmail@gmail.com",
  smtpPass: "hhnxsxkjpretvpzn",
  smtpFrom: "DMail <etherxinnovdmail@gmail.com>",
  imapHost: "imap.gmail.com",
  imapPort: 993,
  imapSecure: true,
  imapUser: "etherxinnovdmail@gmail.com",
  imapPass: "hhnxsxkjpretvpzn"
};

export const getGatewayConfig = () => {
  let fileConfig = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const encryptedData = fs.readFileSync(CONFIG_PATH, "utf8");
      if (encryptedData.trim()) {
        const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted) fileConfig = JSON.parse(decrypted);
      }
    }
  } catch (err) {
    console.error("❌ [ConfigManager] Failed to read or decrypt gateway config:", err.message);
  }

  // Environment variables override file config and defaults
  return {
    smtpHost: process.env.SMTP_HOST || fileConfig.smtpHost || DEFAULT_CONFIG.smtpHost,
    smtpPort: parseInt(process.env.SMTP_PORT || fileConfig.smtpPort || DEFAULT_CONFIG.smtpPort),
    smtpSecure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : (fileConfig.smtpSecure !== undefined ? fileConfig.smtpSecure : DEFAULT_CONFIG.smtpSecure),
    smtpUser: process.env.SMTP_USER || process.env.SMTP_EMAIL || fileConfig.smtpUser || DEFAULT_CONFIG.smtpUser,
    smtpPass: process.env.SMTP_PASSWORD || fileConfig.smtpPass || DEFAULT_CONFIG.smtpPass,
    smtpFrom: process.env.SMTP_FROM || fileConfig.smtpFrom || DEFAULT_CONFIG.smtpFrom,
    imapHost: process.env.IMAP_HOST || fileConfig.imapHost || DEFAULT_CONFIG.imapHost,
    imapPort: parseInt(process.env.IMAP_PORT || fileConfig.imapPort || DEFAULT_CONFIG.imapPort),
    imapSecure: true,
    imapUser: process.env.IMAP_USER || process.env.SMTP_EMAIL || fileConfig.imapUser || DEFAULT_CONFIG.imapUser,
    imapPass: process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD || fileConfig.imapPass || DEFAULT_CONFIG.imapPass
  };
};

export const saveGatewayConfig = (config) => {
  try {
    const dataString = JSON.stringify(config);
    const encrypted = CryptoJS.AES.encrypt(dataString, ENCRYPTION_KEY).toString();
    fs.writeFileSync(CONFIG_PATH, encrypted, "utf8");
    return true;
  } catch (err) {
    console.error("❌ [ConfigManager] Failed to save or encrypt gateway config:", err.message);
    return false;
  }
};
