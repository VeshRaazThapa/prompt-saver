'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Prompt } from '@/types';
import type { TagCount } from '@/lib/actions/result';
import {
  listPrompts,
  toggleFavoriteAction,
  duplicatePromptAction,
  archivePromptAction,
  deletePromptAction,
} from '@/lib/actions/prompts';
import { useDebounce } from './useDebounce';

interface UsePromptsOptions {
  searchQuery?: string;
  filter?: 'all' | 'favorites' | 'archived';
  sortBy?: 'updated_at' | 'created_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export function usePrompts(options: UsePromptsOptions = {}) {
  const { searchQuery = '', filter = 'all', sortBy = 'updated_at', sortOrder = 'desc' } = options;
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [allTags, setAllTags] = useState<TagCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listPrompts({ searchQuery: debouncedQuery, filter, sortBy, sortOrder });
    if (result.ok) {
      setPrompts(result.data.prompts);
      setAllTags(result.data.allTags);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [debouncedQuery, filter, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  const runThenReload = useCallback(
    async (action: (id: string) => Promise<{ ok: boolean; error?: string }>, id: string) => {
      const result = await action(id);
      if (!result.ok) {
        setError(result.error ?? 'Action failed');
        return;
      }
      await load();
    },
    [load]
  );

  const toggleFavorite = useCallback(
    (id: string) => runThenReload(toggleFavoriteAction, id),
    [runThenReload]
  );
  const duplicatePrompt = useCallback(
    (id: string) => runThenReload(duplicatePromptAction, id),
    [runThenReload]
  );
  const archivePrompt = useCallback(
    (id: string) => runThenReload(archivePromptAction, id),
    [runThenReload]
  );
  const deletePrompt = useCallback(
    (id: string) => runThenReload(deletePromptAction, id),
    [runThenReload]
  );

  return {
    prompts,
    loading,
    error,
    allTags,
    toggleFavorite,
    duplicatePrompt,
    archivePrompt,
    deletePrompt,
    reload: load,
  };
}
