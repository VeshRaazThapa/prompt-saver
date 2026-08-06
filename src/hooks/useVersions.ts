'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PromptVersion } from '@/types';
import {
  listVersionsAction,
  updateVersionResultAction,
  restoreVersionAction,
} from '@/lib/actions/versions';

export function useVersions(promptId: string) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PromptVersion | null>(null);
  const [compareWith, setCompareWith] = useState<PromptVersion | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listVersionsAction(promptId);
      if (result.ok) {
        setVersions(result.data);
        setSelected((prev) => prev ?? result.data[0] ?? null);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
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

  const updateResult = useCallback(
    async (versionId: string, result: string) => {
      setError(null);
      const saved = await updateVersionResultAction(promptId, versionId, result);
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      setVersions((prev) => prev.map((v) => (v.id === versionId ? { ...v, result } : v)));
      setSelected((prev) => (prev && prev.id === versionId ? { ...prev, result } : prev));
    },
    [promptId]
  );

  const restoreVersion = useCallback(
    async (version: PromptVersion) => {
      setError(null);
      const restored = await restoreVersionAction(promptId, version.id);
      if (!restored.ok) {
        setError(restored.error);
        return;
      }
      await load();
      setSelected(restored.data);
    },
    [promptId, load]
  );

  return {
    versions,
    loading,
    error,
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
