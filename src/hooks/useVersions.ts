'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PromptVersion } from '@/types';
import { getPromptVersionRepository, getPromptRepository } from '@/lib/db/repositories/factory';
import { generateId } from '@/lib/utils/id-generator';
import { now } from '@/lib/utils/datetime';

export function useVersions(promptId: string) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PromptVersion | null>(null);
  const [compareWith, setCompareWith] = useState<PromptVersion | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const repo = getPromptVersionRepository();
    const results = await repo.findByPromptId(promptId);
    setVersions(results);
    setSelected((prev) => prev ?? (results[0] ?? null));
    setLoading(false);
  }, [promptId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCompareMode = useCallback(() => {
    setCompareMode((prev) => {
      if (!prev && versions.length >= 2) {
        setCompareWith(versions[1] ?? null);
      } else {
        setCompareWith(null);
      }
      return !prev;
    });
  }, [versions]);

  const updateResult = useCallback(async (versionId: string, result: string) => {
    const repo = getPromptVersionRepository();
    await repo.update(versionId, { result });
    // Refresh versions list and selected
    setVersions((prev) => prev.map((v) => (v.id === versionId ? { ...v, result } : v)));
    setSelected((prev) => (prev && prev.id === versionId ? { ...prev, result } : prev));
  }, []);

  const restoreVersion = useCallback(async (version: PromptVersion) => {
    const repo = getPromptVersionRepository();
    const latestVersion = await repo.getLatestVersion(promptId);

    const restored: PromptVersion = {
      id: generateId(),
      prompt_id: promptId,
      version_number: (latestVersion?.version_number ?? 0) + 1,
      content: version.content,
      change_summary: `Restored from version ${version.version_number}`,
      created_at: now(),
      previous_version_id: latestVersion?.id,
    };

    await repo.createVersionAtomic(restored, promptId);

    // Also update the Prompt.content to match the restored version
    const promptRepo = getPromptRepository();
    await promptRepo.update(promptId, { content: version.content, updated_at: now() });

    await load();
    setSelected(restored);
  }, [promptId, load]);

  return {
    versions,
    loading,
    selected,
    setSelected,
    compareWith,
    setCompareWith,
    compareMode,
    toggleCompareMode,
    restoreVersion,
    updateResult,
  };
}
