import { AppError } from '../errors';
import { logger } from '../logging';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface DraftInput {
  title: string;
  description?: string;
  content: string;
  tags: string[];
}

export interface ListPromptsInput {
  searchQuery?: string;
  filter?: 'all' | 'favorites' | 'archived';
  sortBy?: 'created_at' | 'updated_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * Runs an action body, converting throws into a serializable result.
 * Next.js strips error messages in production, so we never throw across
 * the Server Action boundary — the user would only see "an error occurred".
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Server action failed', err);
    // AppError messages are written for users; anything else could leak internals.
    return {
      ok: false,
      error: err instanceof AppError ? err.message : 'Something went wrong. Please try again.',
    };
  }
}
