'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Prompt } from '@/types';
import { getPromptAction, createPromptAction, updateDraftAction } from '@/lib/actions/prompts';
import { saveVersionAction, saveCurrentAction } from '@/lib/actions/versions';
import { now } from '@/lib/utils/datetime';

interface PromptDraft {
  title: string;
  description: string;
  content: string;
  tags: string[];
}

export function usePrompt(promptId?: string) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [draft, setDraft] = useState<PromptDraft>({
    title: '',
    description: '',
    content: '',
    tags: [],
  });
  const [currentVersionResult, setCurrentVersionResult] = useState('');
  const [loading, setLoading] = useState(!!promptId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Load existing prompt
  useEffect(() => {
    if (!promptId) return;

    const loadPrompt = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getPromptAction(promptId);
        if (result.ok) {
          const { prompt: existing, currentVersionResult: loadedResult } = result.data;
          setPrompt(existing);
          setDraft({
            title: existing.title,
            description: existing.description ?? '',
            content: existing.content,
            tags: existing.tags,
          });
          setCurrentVersionResult(loadedResult);
        } else {
          setError(result.error);
        }
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadPrompt();
  }, [promptId]);

  // Auto-save draft (1.5s debounce) — only fires when dirty
  useEffect(() => {
    if (!prompt || !dirty) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      // Reset at the start of the operation, same as the other four operations in this
      // hook — otherwise a stale error from an earlier failed save (auto-save or manual)
      // would keep showing next to a later "Saved {time}" once this auto-save succeeds.
      setError(null);
      try {
        const result = await updateDraftAction(prompt.id, {
          title: draft.title,
          description: draft.description,
          content: draft.content,
          tags: draft.tags,
        });
        if (result.ok) {
          setLastSaved(now());
          setHasUnsavedChanges(false);
        } else {
          setError(result.error);
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
    }, 1500);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [draft, prompt, dirty]);

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const updateDraft = useCallback((updates: Partial<PromptDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
    setDirty(true);
  }, []);

  // Create new prompt — atomic: prompt + version created server-side in one transaction.
  // Throws on failure (callers await this to get the new id); the inner try/catch keeps
  // that throw-on-failure contract while still guaranteeing `saving` is always cleared.
  const createPrompt = useCallback(async (): Promise<string> => {
    setSaving(true);
    setError(null);
    try {
      let result: Awaited<ReturnType<typeof createPromptAction>>;
      try {
        result = await createPromptAction({
          title: draft.title,
          description: draft.description,
          content: draft.content,
          tags: draft.tags,
        });
      } catch {
        const message = 'Something went wrong. Please try again.';
        setError(message);
        throw new Error(message);
      }

      if (!result.ok) {
        setError(result.error);
        throw new Error(result.error);
      }

      setLastSaved(now());
      setHasUnsavedChanges(false);
      return result.data.id;
    } finally {
      setSaving(false);
    }
  }, [draft]);

  // Save new version
  const saveVersion = useCallback(
    async (changeSummary?: string, result?: string) => {
      if (!prompt) return;
      setSaving(true);
      setError(null);
      try {
        const saved = await saveVersionAction(prompt.id, {
          title: draft.title,
          description: draft.description,
          content: draft.content,
          tags: draft.tags,
          ...(changeSummary !== undefined ? { changeSummary } : {}),
          ...(result !== undefined ? { result } : {}),
        });

        if (!saved.ok) {
          setError(saved.error);
          return;
        }

        // The save itself succeeded even if this refresh fails or throws — clear the
        // unsaved-changes flag, but tell the user the view may now be stale rather than
        // silently keeping the old prompt/version-count around under a "Saved" label.
        // A throw here is handled the same as an {ok:false} result (both just set `error`)
        // so it doesn't fall through to the outer catch, which would incorrectly leave
        // `hasUnsavedChanges` set for a save that actually succeeded.
        try {
          const refreshed = await getPromptAction(prompt.id);
          if (refreshed.ok) {
            setPrompt(refreshed.data.prompt);
            setCurrentVersionResult(refreshed.data.currentVersionResult);
          } else {
            setError(refreshed.error);
          }
        } catch {
          setError('Something went wrong. Please try again.');
        }
        setLastSaved(now());
        setHasUnsavedChanges(false);
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [draft, prompt]
  );

  // Save draft + result to the current version (no new version created)
  const saveCurrent = useCallback(
    async (result?: string) => {
      if (!prompt) return;
      setSaving(true);
      setError(null);
      try {
        const saved = await saveCurrentAction(prompt.id, {
          title: draft.title,
          description: draft.description,
          content: draft.content,
          tags: draft.tags,
          ...(result !== undefined ? { result } : {}),
        });

        if (!saved.ok) {
          setError(saved.error);
          return;
        }

        // Same reasoning as saveVersion: the save succeeded, so clear unsaved-changes state,
        // but surface a refresh failure (or throw) instead of silently showing stale
        // prompt/version data. A refresh throw is handled here rather than falling through
        // to the outer catch, which would incorrectly leave `hasUnsavedChanges` set.
        try {
          const refreshed = await getPromptAction(prompt.id);
          if (refreshed.ok) {
            setPrompt(refreshed.data.prompt);
            setCurrentVersionResult(refreshed.data.currentVersionResult);
          } else {
            setError(refreshed.error);
          }
        } catch {
          setError('Something went wrong. Please try again.');
        }
        setLastSaved(now());
        setHasUnsavedChanges(false);
        setDirty(false);
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [draft, prompt]
  );

  return {
    prompt,
    draft,
    updateDraft,
    currentVersionResult,
    loading,
    saving,
    error,
    lastSaved,
    hasUnsavedChanges,
    createPrompt,
    saveVersion,
    saveCurrent,
  };
}
