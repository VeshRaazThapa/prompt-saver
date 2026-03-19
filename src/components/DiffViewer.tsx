'use client';

import { computeDiff } from '@/lib/utils/diff';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
}

export function DiffViewer({ oldText, newText, oldLabel, newLabel }: DiffViewerProps) {
  const lines = computeDiff(oldText, newText);

  if (oldText === newText) {
    return <p className="py-4 text-center text-sm text-gray-500">No differences</p>;
  }

  return (
    <div className="overflow-auto rounded border border-gray-200">
      {(oldLabel || newLabel) && (
        <div className="flex border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
          {oldLabel && <span className="text-red-600">{oldLabel}</span>}
          {oldLabel && newLabel && <span className="mx-2">&rarr;</span>}
          {newLabel && <span className="text-green-600">{newLabel}</span>}
        </div>
      )}
      <pre className="text-sm">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`px-3 py-0.5 ${
              line.type === 'added'
                ? 'bg-green-50 text-green-800'
                : line.type === 'removed'
                  ? 'bg-red-50 text-red-800'
                  : 'text-gray-700'
            }`}
          >
            <span className="mr-2 inline-block w-4 select-none text-gray-400">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            {line.value || '\u00A0'}
          </div>
        ))}
      </pre>
    </div>
  );
}
