'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Prompt } from '@/types';
import { getPromptRepository } from '@/lib/db/repositories/factory';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants';
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
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([]);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const repo = getPromptRepository();

    try {
      // Always load ALL prompts first for tag cloud (unfiltered)
      const allPrompts = await repo.findByWorkspaceId(DEFAULT_WORKSPACE_ID);

      // Build tag counts from all prompts
      const tagCounts = new Map<string, number>();
      allPrompts.forEach((p) => p.tags.forEach((t) => {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }));
      setAllTags(
        Array.from(tagCounts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => a.tag.localeCompare(b.tag))
      );

      // Now filter/search for display
      let results: Prompt[];

      if (debouncedQuery) {
        results = await repo.search(DEFAULT_WORKSPACE_ID, debouncedQuery);
        // Apply sort to search results client-side
        results.sort((a, b) => {
          const aVal = a[sortBy] ?? '';
          const bVal = b[sortBy] ?? '';
          const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : 0;
          return sortOrder === 'asc' ? cmp : -cmp;
        });
      } else {
        results = await repo.findByWorkspaceId(DEFAULT_WORKSPACE_ID, {
          favoritesOnly: filter === 'favorites',
          status: filter === 'archived' ? 'archived' : undefined,
          sortBy,
          sortOrder,
        });
      }

      // Exclude archived from default view unless specifically filtering for them
      if (filter === 'all') {
        results = results.filter((p) => p.status !== 'archived');
      }

      setPrompts(results);
    } catch (err) {
      console.error('Failed to load prompts', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filter, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFavorite = useCallback(async (id: string) => {
    const repo = getPromptRepository();
    const prompt = await repo.findById(id);
    if (prompt) {
      await repo.update(id, { is_favorite: !prompt.is_favorite });
      load();
    }
  }, [load]);

  const duplicatePrompt = useCallback(async (id: string) => {
    const repo = getPromptRepository();
    const prompt = await repo.findById(id);
    if (prompt) {
      const { generateId } = await import('@/lib/utils/id-generator');
      const { now } = await import('@/lib/utils/datetime');
      const newPrompt: Prompt = {
        ...prompt,
        id: generateId(),
        title: `Copy of ${prompt.title}`,
        current_version_id: '',
        created_at: now(),
        updated_at: now(),
        metadata: { version_count: 0 },
      };
      await repo.create(newPrompt);
      load();
    }
  }, [load]);

  const archivePrompt = useCallback(async (id: string) => {
    const repo = getPromptRepository();
    const prompt = await repo.findById(id);
    if (prompt) {
      const newStatus = prompt.status === 'archived' ? 'active' : 'archived';
      await repo.update(id, { status: newStatus });
      load();
    }
  }, [load]);

  const deletePrompt = useCallback(async (id: string) => {
    const repo = getPromptRepository();
    await repo.delete(id);
    load();
  }, [load]);

  return { prompts, loading, allTags, toggleFavorite, duplicatePrompt, archivePrompt, deletePrompt, reload: load };
}
