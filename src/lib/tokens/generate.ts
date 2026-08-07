import { createHash, randomBytes } from 'crypto';

/**
 * Hashes an API token for storage and lookup.
 *
 * SHA-256, not bcrypt, deliberately: these are 256-bit random secrets, so
 * brute force is already infeasible and bcrypt's cost function would only add
 * 50-100ms to every MCP request. See the design spec, section 5.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface GeneratedToken {
  token: string;
  hash: string;
  prefix: string;
}

/** Mints a new API token. The raw token is shown once and never stored. */
export function generateToken(): GeneratedToken {
  const token = `ps_${randomBytes(32).toString('base64url')}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 11) };
}
