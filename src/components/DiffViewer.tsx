'use client';

import { computeDiff } from '@/lib/utils/diff';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
  noBorder?: boolean;
}

export function DiffViewer({ oldText, newText, oldLabel, newLabel, noBorder = false }: DiffViewerProps) {
  const lines = computeDiff(oldText, newText);

  if (oldText === newText) {
    return <p className="py-4 text-center text-sm text-stone-500">No differences</p>;
  }

  return (
    <div className={noBorder ? 'overflow-auto' : 'overflow-auto rounded-lg border border-stone-200'}>
      {(oldLabel || newLabel) && (
        <div className="flex border-b border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-500">
          {oldLabel && <span className="text-red-600">{oldLabel}</span>}
          {oldLabel && newLabel && <span className="mx-2">&rarr;</span>}
          {newLabel && <span className="text-emerald-600">{newLabel}</span>}
        </div>
      )}
      <pre className="font-mono text-sm">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`px-3 py-0.5 ${
              line.type === 'added'
                ? 'bg-emerald-50 text-emerald-800'
                : line.type === 'removed'
                  ? 'bg-red-50 text-red-800'
                  : 'text-stone-700'
            }`}
          >
            <span className="mr-2 inline-block w-4 select-none text-stone-400">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            {line.value || '\u00A0'}
          </div>
        ))}
      </pre>
    </div>
  );
}
