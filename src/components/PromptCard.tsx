'use client';

import Link from 'next/link';
import type { Prompt } from '@/types';

interface PromptCardProps {
  prompt: Prompt;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PromptCard({
  prompt,
  onToggleFavorite,
  onDuplicate,
  onArchive,
  onDelete,
}: PromptCardProps) {
  const timeAgo = formatTimeAgo(prompt.updated_at);

  return (
    <div className="group relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Favorite star */}
      <button
        onClick={() => onToggleFavorite(prompt.id)}
        className="absolute right-3 top-3 text-gray-300 hover:text-yellow-400"
        aria-label={prompt.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <svg className={`h-5 w-5 ${prompt.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      </button>

      {/* Content */}
      <Link href={`/prompts/${prompt.id}`} className="block">
        <h3 className="pr-8 text-base font-semibold text-gray-900 line-clamp-2">
          {prompt.title}
        </h3>
        {prompt.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-1">{prompt.description}</p>
        )}
      </Link>

      {/* Tags */}
      {prompt.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {prompt.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {tag}
            </span>
          ))}
          {prompt.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{prompt.tags.length - 3} more</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">{timeAgo}</span>
        {prompt.status !== 'active' && (
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            prompt.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {prompt.status}
          </span>
        )}
      </div>

      {/* Quick actions (visible on hover) */}
      <div className="absolute bottom-3 right-3 hidden gap-1 group-hover:flex">
        <button onClick={() => onDuplicate(prompt.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Duplicate">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
        <button onClick={() => onArchive(prompt.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title={prompt.status === 'archived' ? 'Unarchive' : 'Archive'}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
        </button>
        <button onClick={() => onDelete(prompt.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600" title="Delete">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}
