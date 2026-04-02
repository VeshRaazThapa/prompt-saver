'use client';

import { useParams } from 'next/navigation';
import { useVersions } from '@/hooks/useVersions';
import { VersionTimeline } from '@/components/VersionTimeline';
import { DiffViewer } from '@/components/DiffViewer';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import Link from 'next/link';

export default function VersionHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const {
    versions, loading, selected, setSelected,
    compareWith, setCompareWith, compareMode, toggleCompareMode, restoreVersion,
  } = useVersions(id);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (versions.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-stone-500">No versions yet.</p>
        <Link href={`/app/prompts/${id}`} className="text-sm text-primary hover:underline">Back to editor</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/app/prompts/${id}`} className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-700">
            &larr; Back to editor
          </Link>
          <h1 className="text-lg font-semibold text-stone-900">Version History</h1>
        </div>
        <div className="flex items-center gap-2">
          {versions.length >= 2 && (
            <Button
              variant={compareMode ? 'primary' : 'secondary'}
              size="sm"
              onClick={toggleCompareMode}
            >
              {compareMode ? 'Exit Compare' : 'Compare'}
            </Button>
          )}
          {selected && selected.id !== versions[0]?.id && (
            <Button size="sm" variant="secondary" onClick={() => restoreVersion(selected)}>
              Restore v{selected.version_number}
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-64 shrink-0">
          <VersionTimeline
            versions={versions}
            selectedId={selected?.id}
            compareId={compareWith?.id}
            onSelect={setSelected}
            onCompareSelect={setCompareWith}
            compareMode={compareMode}
          />
        </aside>

        <div className="flex-1">
          {compareMode && selected && compareWith ? (
            <DiffViewer
              oldText={compareWith.content}
              newText={selected.content}
              oldLabel={`v${compareWith.version_number}`}
              newLabel={`v${selected.version_number}`}
            />
          ) : selected ? (
            <div className="rounded-lg border border-stone-200 bg-white">
              <div className="border-b border-stone-100 px-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-stone-900">Version {selected.version_number}</span>
                  <span className="text-xs text-stone-400">{new Date(selected.created_at).toLocaleString()}</span>
                </div>
                {selected.change_summary && (
                  <p className="mt-0.5 text-sm text-stone-500">{selected.change_summary}</p>
                )}
              </div>
              <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-sm leading-relaxed text-stone-800">
                {selected.content}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
