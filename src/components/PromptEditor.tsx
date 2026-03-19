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
      {/* Title */}
      <input
        type="text"
        placeholder="Prompt title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        maxLength={200}
        className="w-full border-0 border-b border-gray-200 pb-2 text-2xl font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-0"
      />

      {/* Description */}
      <input
        type="text"
        placeholder="Short description (optional)"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        maxLength={500}
        className="w-full border-0 border-b border-gray-100 pb-2 text-sm text-gray-600 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-0"
      />

      {/* Tags */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Tags</label>
        <TagInput tags={tags} onChange={onTagsChange} suggestions={tagSuggestions} />
      </div>

      {/* Content textarea */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Prompt Content</label>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Write your prompt here..."
          rows={20}
          className="w-full resize-y rounded-md border border-gray-300 bg-gray-50 px-4 py-3 font-mono text-sm leading-relaxed text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex gap-4">
          <span>{content.length} characters</span>
          <span>~{tokens} tokens (approx.)</span>
        </div>
        <div>
          {hasUnsavedChanges && <span className="text-yellow-600">Unsaved changes</span>}
          {!hasUnsavedChanges && lastSaved && (
            <span>Saved {new Date(lastSaved).toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
