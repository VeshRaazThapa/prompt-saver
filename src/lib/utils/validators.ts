/**
 * Validates an email address
 * @param email Email address to validate
 * @returns True if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a UUID v4
 * @param id UUID to validate
 * @returns True if valid UUID v4, false otherwise
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validates a prompt title
 * @param title Title to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validatePromptTitle(title: string): string | undefined {
  if (title.trim().length === 0) {
    return 'Title cannot be empty';
  }
  if (title.length > 200) {
    return 'Title must be 200 characters or less';
  }
  return undefined;
}

/**
 * Validates a prompt content
 * @param content Content to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validatePromptContent(content: string): string | undefined {
  if (content.trim().length === 0) {
    return 'Content cannot be empty';
  }
  if (content.length > 100000) {
    return 'Content must be 100,000 characters or less';
  }
  return undefined;
}

/**
 * Validates LLM parameters
 * @param params LLM parameters to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateLLMParams(params: {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}): string | undefined {
  if (params.temperature !== undefined) {
    if (params.temperature < 0 || params.temperature > 2) {
      return 'Temperature must be between 0 and 2';
    }
  }

  if (params.max_tokens !== undefined) {
    if (params.max_tokens < 1 || params.max_tokens > 100000) {
      return 'Max tokens must be between 1 and 100,000';
    }
  }

  if (params.top_p !== undefined) {
    if (params.top_p < 0 || params.top_p > 1) {
      return 'Top-p must be between 0 and 1';
    }
  }

  return undefined;
}

/**
 * Validates a workspace name
 * @param name Workspace name to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateWorkspaceName(name: string): string | undefined {
  if (name.trim().length === 0) {
    return 'Workspace name cannot be empty';
  }
  if (name.length > 100) {
    return 'Workspace name must be 100 characters or less';
  }
  return undefined;
}

/**
 * Sanitizes user input to prevent XSS
 * @param input User input to sanitize
 * @returns Sanitized input
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
