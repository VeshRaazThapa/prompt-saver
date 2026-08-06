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

  // Returns null on success, or the failure message on failure — matching
  // usePrompts's runThenReload convention. Callers that need to know whether
  // this specific save actually succeeded (e.g. before clearing dirty state)
  // can't rely on `error` alone, since it's shared state read from a stale closure.
  const updateResult = useCallback(
    async (versionId: string, result: string): Promise<string | null> => {
      setError(null);
      try {
        const saved = await updateVersionResultAction(promptId, versionId, result);
        if (!saved.ok) {
          setError(saved.error);
          return saved.error;
        }
        setVersions((prev) => prev.map((v) => (v.id === versionId ? { ...v, result } : v)));
        setSelected((prev) => (prev && prev.id === versionId ? { ...prev, result } : prev));
        return null;
      } catch {
        const message = 'Something went wrong. Please try again.';
        setError(message);
        return message;
      }
    },
    [promptId]
  );

  const restoreVersion = useCallback(
    async (version: PromptVersion) => {
      setError(null);
      try {
        const restored = await restoreVersionAction(promptId, version.id);
        if (!restored.ok) {
          setError(restored.error);
          return;
        }
        await load();
        setSelected(restored.data);
      } catch {
        setError('Something went wrong. Please try again.');
      }
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
