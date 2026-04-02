'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { usePrompt } from '@/hooks/usePrompt';
import { PromptEditor } from '@/components/PromptEditor';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import Link from 'next/link';

export default function EditPromptPage() {
  const { id } = useParams<{ id: string }>();
  const { prompt, draft, updateDraft, loading, saving, lastSaved, hasUnsavedChanges, saveVersion } =
    usePrompt(id);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  const handleSaveVersion = async () => {
    await saveVersion(changeSummary || undefined);
    setShowSaveModal(false);
    setChangeSummary('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); setShowSaveModal(true); }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (!prompt) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-stone-500">Prompt not found.</p>
        <Link href="/app" className="text-sm text-primary hover:underline">Back to library</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6" onKeyDown={handleKeyDown}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/app" className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-700">
            &larr; Library
          </Link>
          {prompt.metadata.version_count > 0 && (
            <Link href={`/app/prompts/${id}/versions`} className="text-sm text-primary hover:underline">
              History ({prompt.metadata.version_count} versions)
            </Link>
          )}
        </div>
        <Button onClick={() => setShowSaveModal(true)} isLoading={saving}>Save Version</Button>
      </div>

      <PromptEditor
        title={draft.title}
        description={draft.description}
        content={draft.content}
        tags={draft.tags}
        onTitleChange={(title) => updateDraft({ title })}
        onDescriptionChange={(description) => updateDraft({ description })}
        onContentChange={(content) => updateDraft({ content })}
        onTagsChange={(tags) => updateDraft({ tags })}
        lastSaved={lastSaved}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save New Version"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowSaveModal(false)}>Cancel</Button>
            <Button onClick={handleSaveVersion} isLoading={saving}>Save Version</Button>
          </div>
        }
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">Change summary (optional)</label>
          <input
            type="text"
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="What changed? e.g., 'Improved evaluation criteria'"
            className="w-full min-h-[44px] rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-900 transition-colors duration-150 focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveVersion(); } }}
          />
        </div>
      </Modal>
    </div>
  );
}
