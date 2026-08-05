/**
 * Checks an email against the ALLOWED_EMAILS allowlist.
 * When ALLOWED_EMAILS is unset or blank, everyone is allowed — this is the
 * deliberate switch for going public. See the design spec, section 6.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  const raw = process.env['ALLOWED_EMAILS'];
  if (raw === undefined || raw.trim() === '') {
    return true;
  }
  const allowed = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  if (allowed.length === 0) {
    return true;
  }
  if (typeof email !== 'string') {
    return false;
  }
  return allowed.includes(email.toLowerCase());
}
