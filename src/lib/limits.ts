import { ValidationError } from './errors';

/** Per-workspace caps. A future paid tier raises these in one place. See spec 4.4. */
export const MAX_PROMPTS_PER_WORKSPACE = 1000;
export const MAX_CONTENT_LENGTH = 50_000;
/** Max prompts the extension list endpoint returns in one call. */
export const MAX_EXTENSION_LIST = 200;

export function assertContentLength(content: string): void {
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new ValidationError(
      `Prompt content is limited to ${MAX_CONTENT_LENGTH.toLocaleString('en-US')} characters.`,
      'content'
    );
  }
}
