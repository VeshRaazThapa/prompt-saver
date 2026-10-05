/**
 * Chrome extension IDs allowed to call /api/v1 (CORS) and receive tokens from
 * /extension/connect. Read at call time so tests and deploys can change it.
 * Holds the Web Store ID plus any dev (unpacked) ID.
 */
export function allowedExtensionIds(): string[] {
  return (process.env['NEXT_PUBLIC_EXTENSION_IDS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isAllowedExtensionId(id: string | null | undefined): boolean {
  return typeof id === 'string' && allowedExtensionIds().includes(id);
}

export function isAllowedExtensionOrigin(origin: string | null): boolean {
  const prefix = 'chrome-extension://';
  if (origin === null || !origin.startsWith(prefix)) return false;
  return isAllowedExtensionId(origin.slice(prefix.length));
}
