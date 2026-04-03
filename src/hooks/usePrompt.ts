'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Prompt, PromptVersion } from '@/types';
import { getPromptRepository, getPromptVersionRepository } from '@/lib/db/repositories/factory';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants';
import { generateId } from '@/lib/utils/id-generator';
import { now } from '@/lib/utils/datetime';

interface PromptDraft {
  title: string;
  description: string;
  content: string;
  tags: string[];
}

export function usePrompt(promptId?: string) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [draft, setDraft] = useState<PromptDraft>({ title: '', description: '', content: '', tags: [] });
  const [currentVersionResult, setCurrentVersionResult] = useState('');
  const [loading, setLoading] = useState(!!promptId);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Load existing prompt
  useEffect(() => {
    if (!promptId) return;

    const loadPrompt = async () => {
      setLoading(true);
      const repo = getPromptRepository();
      const existing = await repo.findById(promptId);
      if (existing) {
        setPrompt(existing);
        setDraft({
          title: existing.title,
          description: existing.description ?? '',
          content: existing.content,
          tags: existing.tags,
        });
        // Load result from current version
        if (existing.current_version_id) {
          const versionRepo = getPromptVersionRepository();
          const currentVersion = await versionRepo.findById(existing.current_version_id);
          if (currentVersion) {
            setCurrentVersionResult(currentVersion.result ?? '');
          }
        }
      }
      setLoading(false);
    };

    loadPrompt();
  }, [promptId]);

  // Auto-save draft (5s debounce) — only fires when dirty
  useEffect(() => {
    if (!prompt || !dirty) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      const repo = getPromptRepository();
      await repo.update(prompt.id, {
        title: draft.title,
        description: draft.description || undefined,
        content: draft.content,
        tags: draft.tags,
        updated_at: now(),
      });
      setLastSaved(now());
      setHasUnsavedChanges(false);
    }, 5000);

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

  // Create new prompt — atomic: prompt + version in one transaction
  const createPrompt = useCallback(async (): Promise<string> => {
    setSaving(true);
    const repo = getPromptRepository();
    const versionRepo = getPromptVersionRepository();

    const promptIdNew = generateId();
    const versionId = generateId();
    const timestamp = now();

    const newPrompt: Prompt = {
      id: promptIdNew,
      workspace_id: DEFAULT_WORKSPACE_ID,
      title: draft.title,
      description: draft.description || undefined,
      content: draft.content,
      tags: draft.tags,
      status: 'active',
      is_favorite: false,
      current_version_id: '',
      created_at: timestamp,
      updated_at: timestamp,
      metadata: { version_count: 0 },
    };

    await repo.create(newPrompt);

    const version: PromptVersion = {
      id: versionId,
      prompt_id: promptIdNew,
      version_number: 1,
      content: draft.content,
      change_summary: 'Initial version',
      created_at: timestamp,
    };

    await versionRepo.createVersionAtomic(version, promptIdNew);

    const savedPrompt = { ...newPrompt, current_version_id: versionId, metadata: { version_count: 1 } };
    setPrompt(savedPrompt);
    setSaving(false);
    setLastSaved(timestamp);
    setHasUnsavedChanges(false);
    return promptIdNew;
  }, [draft]);

  // Save new version
  const saveVersion = useCallback(async (changeSummary?: string, result?: string) => {
    if (!prompt) return;

    setSaving(true);
    const versionRepo = getPromptVersionRepository();
    const latestVersion = await versionRepo.getLatestVersion(prompt.id);

    const newVersion: PromptVersion = {
      id: generateId(),
      prompt_id: prompt.id,
      version_number: (latestVersion?.version_number ?? 0) + 1,
      content: draft.content,
      result,
      change_summary: changeSummary,
      created_at: now(),
      previous_version_id: latestVersion?.id,
    };

    await versionRepo.createVersionAtomic(newVersion, prompt.id);

    const repo = getPromptRepository();
    await repo.update(prompt.id, {
      title: draft.title,
      description: draft.description || undefined,
      content: draft.content,
      tags: draft.tags,
      updated_at: now(),
    });

    setPrompt((prev) =>
      prev
        ? {
            ...prev,
            current_version_id: newVersion.id,
            title: draft.title,
            description: draft.description || undefined,
            content: draft.content,
            tags: draft.tags,
            updated_at: now(),
            metadata: { version_count: prev.metadata.version_count + 1 },
          }
        : null
    );
    setSaving(false);
    setLastSaved(now());
    setHasUnsavedChanges(false);
  }, [draft, prompt]);

  // Save draft + result to the current version (no new version created)
  const saveCurrent = useCallback(async (result?: string) => {
    if (!prompt) return;
    setSaving(true);

    // Save draft fields to prompt
    const repo = getPromptRepository();
    await repo.update(prompt.id, {
      title: draft.title,
      description: draft.description || undefined,
      content: draft.content,
      tags: draft.tags,
      updated_at: now(),
    });

    // Update the current version's content and result
    if (prompt.current_version_id) {
      const versionRepo = getPromptVersionRepository();
      await versionRepo.update(prompt.current_version_id, { result });
      setCurrentVersionResult(result ?? '');
    }

    setPrompt((prev) =>
      prev
        ? { ...prev, title: draft.title, description: draft.description || undefined, content: draft.content, tags: draft.tags, updated_at: now() }
        : null
    );
    setSaving(false);
    setLastSaved(now());
    setHasUnsavedChanges(false);
    setDirty(false);
  }, [draft, prompt]);

  return {
    prompt,
    draft,
    updateDraft,
    currentVersionResult,
    loading,
    saving,
    lastSaved,
    hasUnsavedChanges,
    createPrompt,
    saveVersion,
    saveCurrent,
  };
}
