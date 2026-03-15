/**
 * Generates a UUID v4 string
 * @returns A unique identifier
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generates a sequential version number for a prompt
 * @param currentMax The current maximum version number
 * @returns The next version number
 */
export function generateVersionNumber(currentMax: number): number {
  return currentMax + 1;
}

/**
 * Generates a workspace-scoped unique identifier
 * @param workspaceId The workspace ID
 * @param prefix Optional prefix for the ID
 * @returns A unique identifier scoped to the workspace
 */
export function generateScopedId(_workspaceId: string, prefix?: string): string {
  const id = generateId();
  return prefix !== undefined ? `${prefix}-${id}` : id;
}
