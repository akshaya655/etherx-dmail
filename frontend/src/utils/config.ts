/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DMail Global Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Single source of truth for the mail domain.
 * To migrate to a different domain in the future, only change MAIL_DOMAIN here
 * (or set the NEXT_PUBLIC_MAIL_DOMAIN environment variable).
 *
 * Current setup:
 *   - Domain  : etherxinnovations.in
 *   - DNS     : Cloudflare DNS
 *   - Receive : Cloudflare Email Routing → forward *@etherxinnovations.in to Gmail
 *   - Send    : Gmail SMTP (etherxinnovdmail@gmail.com)
 */

export const MAIL_DOMAIN: string =
  process.env.NEXT_PUBLIC_MAIL_DOMAIN || "etherxinnovations.in";

/**
 * Legacy alias domain used for backward-compatibility GunDB key variants.
 * The application stores users under both @etherxinnovations.in and @securemail.com
 * to allow cross-domain discovery during the migration window.
 */
export const MAIL_DOMAIN_ALIAS: string = "securemail.com";

/**
 * Returns true if the given email address belongs to this DMail instance.
 * Accepts both the primary domain and the legacy alias.
 */
export const isInternalDmailAddress = (email: string): boolean => {
  const lower = email.trim().toLowerCase();
  return lower.endsWith(`@${MAIL_DOMAIN}`) || lower.endsWith(`@${MAIL_DOMAIN_ALIAS}`);
};
