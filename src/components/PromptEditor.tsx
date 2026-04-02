'use client';

import { TagInput } from './TagInput';
import { estimateTokens } from '@/lib/utils/tokens';

interface PromptEditorProps {
  title: string;
  description: string;
  content: string;
  tags: string[];
  tagSuggestions?: string[];
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
  lastSaved: string | null;
  hasUnsavedChanges: boolean;
}

export function PromptEditor({
  title,
  description,
  content,
  tags,
  tagSuggestions = [],
  onTitleChange,
  onDescriptionChange,
  onContentChange,
  onTagsChange,
  lastSaved,
  hasUnsavedChanges,
}: PromptEditorProps) {
  const tokens = estimateTokens(content);

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Prompt title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        maxLength={200}
        className="w-full border-0 border-b border-stone-200 bg-transparent pb-2 text-2xl font-bold text-stone-900 placeholder:text-stone-400 transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-0"
      />

      <input
        type="text"
        placeholder="Short description (optional)"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        maxLength={500}
        className="w-full border-0 border-b border-stone-100 bg-transparent pb-2 text-sm text-stone-600 placeholder:text-stone-400 transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-0"
      />

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Tags</label>
        <TagInput tags={tags} onChange={onTagsChange} suggestions={tagSuggestions} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Prompt Content</label>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Write your prompt here…"
          rows={20}
          className="w-full resize-y rounded-md border border-stone-200 bg-stone-50 px-4 py-3 font-mono text-sm leading-relaxed text-stone-800 placeholder:text-stone-400 transition-colors duration-150 focus:border-primary focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-stone-500">
        <div className="flex gap-4">
          <span>{content.length} characters</span>
          <span>~{tokens} tokens (approx.)</span>
        </div>
        <div>
          {hasUnsavedChanges && <span className="text-warning">Unsaved changes</span>}
          {!hasUnsavedChanges && lastSaved && (
            <span className="text-primary">Saved {new Date(lastSaved).toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
