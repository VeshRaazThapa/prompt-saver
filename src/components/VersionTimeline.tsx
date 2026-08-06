'use client';

import type { PromptVersion } from '@/types';

interface VersionTimelineProps {
  versions: PromptVersion[];
  selectedId?: string;
  compareId?: string;
  onSelect: (version: PromptVersion) => void;
  onCompareSelect?: (version: PromptVersion) => void;
  compareMode?: boolean;
}

export function VersionTimeline({
  versions,
  selectedId,
  compareId,
  onSelect,
  onCompareSelect,
  compareMode = false,
}: VersionTimelineProps) {
  return (
    <div className="space-y-1">
      {versions.map((version) => {
        const isSelected = version.id === selectedId;
        const isCompare = version.id === compareId;

        return (
          <button
            key={version.id}
            onClick={() => {
              if (compareMode && onCompareSelect) {
                onCompareSelect(version);
              } else {
                onSelect(version);
              }
            }}
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-all duration-150 ease-out ${
              isSelected
                ? 'bg-primary-light ring-1 ring-primary/30'
                : isCompare
                  ? 'bg-amber-50 ring-1 ring-amber-200'
                  : 'hover:bg-stone-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-stone-900">v{version.version_number}</span>
              <span className="text-xs text-stone-400">
                {new Date(version.created_at).toLocaleDateString()}
              </span>
            </div>
            {version.change_summary && (
              <p className="mt-0.5 text-xs text-stone-500 line-clamp-1">{version.change_summary}</p>
            )}
            {(isSelected || isCompare) && (
              <span
                className={`mt-1 inline-block rounded px-1 text-xs ${
                  isSelected ? 'bg-primary-light text-primary' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isSelected ? 'viewing' : 'comparing'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
