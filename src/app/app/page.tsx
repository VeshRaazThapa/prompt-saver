'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePrompts } from '@/hooks/usePrompts';
import { PromptCard } from '@/components/PromptCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import Link from 'next/link';

type FilterType = 'all' | 'favorites' | 'archived';
type SortOption = 'updated_at' | 'created_at' | 'title';

export default function PromptLibraryWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <PromptLibrary />
    </Suspense>
  );
}

function PromptLibrary() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    prompts,
    loading,
    error,
    allTags,
    toggleFavorite,
    duplicatePrompt,
    archivePrompt,
    deletePrompt,
  } = usePrompts({ searchQuery, filter, sortBy, sortOrder });

  const filteredPrompts = tagFilter ? prompts.filter((p) => p.tags.includes(tagFilter)) : prompts;

  const closeDeleteModal = () => {
    setDeleteId(null);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    // deletePrompt resolves to the failure message on failure, or null on success — the
    // hook's shared `error` state can't be read reliably here since this closure was
    // captured before the mutation resolved, so the return value is the source of truth.
    const failureMessage = await deletePrompt(deleteId);
    setDeleting(false);
    if (failureMessage) {
      setDeleteError(failureMessage);
    } else {
      closeDeleteModal();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Page heading (visually subtle but semantically correct) */}
      <h1 className="sr-only">Prompt Library</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Mobile filter pills (FINDING-003 fix: visible on small screens) */}
      <div className="mb-4 flex flex-wrap gap-2 lg:hidden">
        {(['all', 'favorites', 'archived'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setTagFilter(null);
            }}
            className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition-colors duration-150 ${
              filter === f && !tagFilter
                ? 'bg-primary text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Sidebar: Tags + Filters (desktop only) */}
        <aside className="hidden w-48 shrink-0 lg:block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Filter
          </span>
          <div className="space-y-1">
            {(['all', 'favorites', 'archived'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setTagFilter(null);
                }}
                className={`block w-full min-h-[44px] rounded-md px-3 text-left text-sm transition-colors duration-150 ${
                  filter === f && !tagFilter
                    ? 'bg-primary-light font-medium text-primary'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {allTags.length > 0 && (
            <>
              <span className="mb-2 mt-6 block text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Tags
              </span>
              <div className="flex flex-wrap gap-1">
                {allTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    className={`rounded px-2 py-1 text-xs transition-colors duration-150 ${
                      tagFilter === tag
                        ? 'bg-primary-light font-medium text-primary'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {tag} <span className="text-stone-400">({count})</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1">
          {/* Search + Sort bar (FINDING-005 fix: removed duplicate nav search — this is the only one) */}
          <div className="mb-4 flex items-center gap-3">
            <input
              type="text"
              placeholder="Search prompts…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-h-[44px] rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-colors duration-150 focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-') as [SortOption, 'asc' | 'desc'];
                setSortBy(by);
                setSortOrder(order);
              }}
              className="min-h-[44px] rounded-md border border-stone-200 bg-white px-2 py-2 text-sm text-stone-700 transition-colors duration-150 focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <option value="updated_at-desc">Recently updated</option>
              <option value="created_at-desc">Recently created</option>
              <option value="title-asc">A-Z</option>
              <option value="title-desc">Z-A</option>
            </select>
          </div>

          {/* Prompts grid */}
          {filteredPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              {/* FINDING-004 fix: warm empty state with icon */}
              <svg
                className="mb-4 h-16 w-16 text-stone-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p className="text-lg text-stone-500">
                {error
                  ? "We couldn't load your prompts. Please try again."
                  : searchQuery || tagFilter
                    ? 'No prompts match your search.'
                    : 'Your prompt library is empty \u2014 let\u2019s get started.'}
              </p>
              {error === null && !searchQuery && !tagFilter && (
                <Link
                  href="/app/prompts/new"
                  className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-primary px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover"
                >
                  Create your first prompt
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onToggleFavorite={toggleFavorite}
                  onDuplicate={duplicatePrompt}
                  onArchive={archivePrompt}
                  onDelete={(id) => {
                    setDeleteId(id);
                    setDeleteError(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        title="Delete Prompt"
        message="This will permanently delete this prompt and all its versions. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleting}
        error={deleteError}
      />
    </div>
  );
}
