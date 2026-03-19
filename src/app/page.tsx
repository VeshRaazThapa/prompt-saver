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
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div>}>
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

  const { prompts, loading, allTags, toggleFavorite, duplicatePrompt, archivePrompt, deletePrompt } =
    usePrompts({ searchQuery, filter, sortBy, sortOrder });

  const filteredPrompts = tagFilter
    ? prompts.filter((p) => p.tags.includes(tagFilter))
    : prompts;

  const handleDelete = async () => {
    if (deleteId) {
      await deletePrompt(deleteId);
      setDeleteId(null);
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
      <div className="flex gap-6">
        {/* Sidebar: Tags + Filters */}
        <aside className="hidden w-48 shrink-0 lg:block">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Filter
          </h3>
          <div className="space-y-1">
            {(['all', 'favorites', 'archived'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setTagFilter(null); }}
                className={`block w-full rounded px-2 py-1 text-left text-sm ${
                  filter === f && !tagFilter ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {allTags.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1">
                {allTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    className={`rounded px-2 py-0.5 text-xs ${
                      tagFilter === tag
                        ? 'bg-blue-100 font-medium text-blue-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tag} <span className="text-gray-400">({count})</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1">
          {/* Search + Sort bar */}
          <div className="mb-4 flex items-center gap-3">
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-') as [SortOption, 'asc' | 'desc'];
                setSortBy(by);
                setSortOrder(order);
              }}
              className="rounded-md border border-gray-300 px-2 py-2 text-sm"
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
              <p className="text-lg text-gray-500">
                {searchQuery || tagFilter ? 'No prompts match your search.' : 'No prompts yet.'}
              </p>
              {!searchQuery && !tagFilter && (
                <Link
                  href="/prompts/new"
                  className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                  onDelete={(id) => setDeleteId(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Prompt"
        message="This will permanently delete this prompt and all its versions. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
