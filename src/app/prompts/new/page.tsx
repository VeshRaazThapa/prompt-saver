'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrompt } from '@/hooks/usePrompt';
import { PromptEditor } from '@/components/PromptEditor';
import { Button } from '@/components/ui/Button';

export default function NewPromptPage() {
  const router = useRouter();
  const { draft, updateDraft, createPrompt, saving } = usePrompt();
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!draft.title.trim()) { setError('Title is required'); return; }
    if (!draft.content.trim()) { setError('Content is required'); return; }
    setError('');
    const newId = await createPrompt();
    router.push(`/prompts/${newId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6" onKeyDown={handleKeyDown}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-900">New Prompt</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push('/')}>Cancel</Button>
          <Button onClick={handleSave} isLoading={saving}>Save Prompt</Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <PromptEditor
        title={draft.title}
        description={draft.description}
        content={draft.content}
        tags={draft.tags}
        onTitleChange={(title) => updateDraft({ title })}
        onDescriptionChange={(description) => updateDraft({ description })}
        onContentChange={(content) => updateDraft({ content })}
        onTagsChange={(tags) => updateDraft({ tags })}
        lastSaved={null}
        hasUnsavedChanges={false}
      />
    </div>
  );
}
