import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { getGatewayConfig } from './config_manager.js';

dotenv.config();
const config = getGatewayConfig();

console.log("⚡ Testing Production SMTP Connection...");
console.log(`  SMTP_HOST   : ${config.smtpHost}`);
console.log(`  SMTP_PORT   : ${config.smtpPort}`);
console.log(`  SMTP_SECURE : ${config.smtpSecure}`);
console.log(`  SMTP_USER   : ${config.smtpUser}`);
console.log(`  SMTP_FROM   : ${config.smtpFrom}`);

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpSecure,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPass
  }
});

transporter.verify((err, success) => {
  if (err) {
    console.error("❌ SMTP Verification Failed:", err.message || err);
  } else {
    console.log("✅ SMTP Verification Successful! Authenticated as:", config.smtpUser);
  }
});
