/**
 * Returns the current date/time as an ISO8601 string
 * @returns ISO8601 formatted timestamp
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Formats a date as ISO8601
 * @param date The date to format
 * @returns ISO8601 formatted string
 */
export function toISO8601(date: Date): string {
  return date.toISOString();
}

/**
 * Parses an ISO8601 string to a Date object
 * @param iso8601 The ISO8601 string to parse
 * @returns Date object
 */
export function fromISO8601(iso8601: string): Date {
  return new Date(iso8601);
}

/**
 * Calculates the duration between two timestamps in milliseconds
 * @param start Start timestamp (ISO8601)
 * @param end End timestamp (ISO8601)
 * @returns Duration in milliseconds
 */
export function calculateDuration(start: string, end: string): number {
  return fromISO8601(end).getTime() - fromISO8601(start).getTime();
}

/**
 * Formats a duration in milliseconds to a human-readable string
 * @param ms Duration in milliseconds
 * @returns Human-readable duration (e.g., "2.5s", "150ms")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Checks if a timestamp is older than a given number of days
 * @param timestamp ISO8601 timestamp
 * @param days Number of days
 * @returns True if timestamp is older than the given days
 */
export function isOlderThan(timestamp: string, days: number): boolean {
  const date = fromISO8601(timestamp);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date < cutoff;
}
