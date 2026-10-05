export interface ExtPrompt {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  updated_at: string;
  content: string;
  is_favorite: boolean;
}

import type { ApiErrorCode } from './api';

export interface PendingSave {
  title: string;
  content: string;
}

export type Msg =
  | { type: 'getPrompts'; refresh?: boolean }
  | { type: 'createPrompt'; title: string; content: string; tags?: string[] }
  | { type: 'toggleFavorite'; id: string; isFavorite: boolean }
  | { type: 'openSavePanel'; prefill: PendingSave }
  | { type: 'insertIntoTab'; tabId: number; text: string }
  | { type: 'getStatus' }
  | { type: 'disconnect' };

export type MsgResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: ApiErrorCode | 'signed_out' | 'no_editor'; message: string; retryAfter?: number };
