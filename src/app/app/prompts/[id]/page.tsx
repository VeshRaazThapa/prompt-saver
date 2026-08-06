'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePrompt } from '@/hooks/usePrompt';
import { TagInput } from '@/components/TagInput';
import { ResultEditor } from '@/components/ResultEditor';
import { Accordion } from '@/components/ui/Accordion';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { estimateTokens } from '@/lib/utils/tokens';
import Link from 'next/link';

export default function EditPromptPage() {
  const { id } = useParams<{ id: string }>();
  const {
    prompt,
    draft,
    updateDraft,
    currentVersionResult,
    loading,
    saving,
    error,
    lastSaved,
    hasUnsavedChanges,
    saveVersion,
    saveCurrent,
  } = usePrompt(id);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [result, setResult] = useState('');
  const [resultInitialized, setResultInitialized] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync local result state with loaded version result
  if (!resultInitialized && currentVersionResult) {
    setResult(currentVersionResult);
    setResultInitialized(true);
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    await saveCurrent(result || undefined);
  };

  const handleSaveVersion = async () => {
    await saveVersion(changeSummary || undefined, result || undefined);
    setShowSaveModal(false);
    setChangeSummary('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-stone-500">{error ?? 'Prompt not found.'}</p>
        <Link href="/app" className="text-sm text-primary hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6" onKeyDown={handleKeyDown}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-700"
          >
            &larr; Library
          </Link>
          {prompt.metadata.version_count > 0 && (
            <Link
              href={`/app/prompts/${id}/versions`}
              className="text-sm text-primary hover:underline"
            >
              History ({prompt.metadata.version_count} versions)
            </Link>
          )}
        </div>

        {/* Split save button */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex">
            <Button
              onClick={handleSave}
              isLoading={saving}
              className="rounded-r-none border-r border-r-white/20"
            >
              Save
            </Button>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex min-h-[44px] items-center rounded-md rounded-l-none bg-primary px-2 text-white transition-colors duration-150 ease-out hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label="More save options"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          {dropdownOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border border-stone-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  setShowSaveModal(true);
                }}
                className="w-full px-4 py-2 text-left text-sm text-stone-700 transition-colors duration-150 hover:bg-stone-50"
              >
                Save as New Version
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Title, description, tags — always visible */}
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Prompt title"
          value={draft.title}
          onChange={(e) => updateDraft({ title: e.target.value })}
          maxLength={200}
          className="w-full border-0 border-b border-stone-200 bg-transparent pb-2 text-2xl font-bold text-stone-900 placeholder:text-stone-400 transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-0"
        />
        <input
          type="text"
          placeholder="Short description (optional)"
          value={draft.description}
          onChange={(e) => updateDraft({ description: e.target.value })}
          maxLength={500}
          className="w-full border-0 border-b border-stone-100 bg-transparent pb-2 text-sm text-stone-600 placeholder:text-stone-400 transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-0"
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Tags</label>
          <TagInput tags={draft.tags} onChange={(tags) => updateDraft({ tags })} />
        </div>
      </div>

      {/* Collapsible sections */}
      <div className="mt-4 space-y-4">
        <Accordion
          title="Prompt Content"
          defaultOpen
          badge={`~${estimateTokens(draft.content)} tokens`}
        >
          <div className="px-4 py-3">
            <textarea
              value={draft.content}
              onChange={(e) => updateDraft({ content: e.target.value })}
              placeholder="Write your prompt here…"
              rows={20}
              className="w-full resize-y rounded-md border border-stone-200 bg-stone-50 px-4 py-3 font-mono text-sm leading-relaxed text-stone-800 placeholder:text-stone-400 transition-colors duration-150 focus:border-primary focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
              <span>{draft.content.length} characters</span>
              <div>
                {hasUnsavedChanges && <span className="text-warning">Unsaved changes</span>}
                {!hasUnsavedChanges && lastSaved && (
                  <span className="text-primary">
                    Saved {new Date(lastSaved).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Accordion>

        <Accordion title="LLM Result" defaultOpen={!!result} badge={result ? undefined : 'empty'}>
          <ResultEditor value={result} onChange={setResult} noBorder />
        </Accordion>
      </div>

      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save as New Version"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowSaveModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVersion} isLoading={saving}>
              Save Version
            </Button>
          </div>
        }
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">
            Change summary (optional)
          </label>
          <input
            type="text"
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="What changed? e.g., 'Improved evaluation criteria'"
            className="w-full min-h-[44px] rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-900 transition-colors duration-150 focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveVersion();
              }
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
