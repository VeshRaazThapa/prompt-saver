'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrompt } from '@/hooks/usePrompt';
import { PromptEditor } from '@/components/PromptEditor';
import { Button } from '@/components/ui/Button';

export default function NewPromptPage() {
  const router = useRouter();
  const { draft, updateDraft, createPrompt, saving, error: createError } = usePrompt();
  const [validationError, setValidationError] = useState('');

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setValidationError('Title is required');
      return;
    }
    if (!draft.content.trim()) {
      setValidationError('Content is required');
      return;
    }
    setValidationError('');
    try {
      const newId = await createPrompt();
      router.push(`/app/prompts/${newId}`);
    } catch {
      // createPrompt already set the hook's `error` state on failure — nothing else to do
      // here, but the catch is required so a rejected creation doesn't become an unhandled
      // promise rejection with no feedback to the user.
    }
  };

  const displayError = validationError || createError;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6" onKeyDown={handleKeyDown}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-900">New Prompt</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push('/')}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            Save Prompt
          </Button>
        </div>
      </div>

      {displayError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {displayError}
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
