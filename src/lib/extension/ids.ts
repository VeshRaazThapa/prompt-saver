/**
 * Chrome extension IDs allowed to call /api/v1 (CORS) and receive tokens from
 * /extension/connect. Read at call time so tests and deploys can change it.
 * Holds the Web Store ID plus any dev (unpacked) ID, or "*" to allow any
 * well-formed extension ID (open mode: any extension can ask a signed-in user
 * to connect, so the connect page shows the requesting ID).
 */
export function allowedExtensionIds(): string[] {
  return (process.env['NEXT_PUBLIC_EXTENSION_IDS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Chrome extension IDs are 32 characters from a-p. */
const EXTENSION_ID = /^[a-p]{32}$/;

export function allowsAnyExtension(): boolean {
  return allowedExtensionIds().includes('*');
}

export function isAllowedExtensionId(id: string | null | undefined): boolean {
  if (typeof id !== 'string') return false;
  if (allowsAnyExtension()) return EXTENSION_ID.test(id);
  return allowedExtensionIds().includes(id);
}

export function isAllowedExtensionOrigin(origin: string | null): boolean {
  const prefix = 'chrome-extension://';
  if (origin === null || !origin.startsWith(prefix)) return false;
  return isAllowedExtensionId(origin.slice(prefix.length));
}

export const EXTENSION_TOKEN_NAME = 'Chrome extension';
