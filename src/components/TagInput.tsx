'use client';

import { useState, useRef } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
  maxLength?: number;
}

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  maxTags = 20,
  maxLength = 50,
}: TagInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s) && input.length > 0
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim().slice(0, maxLength);
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-1.5 rounded-md border border-stone-200 px-2 py-1.5 transition-colors duration-150 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
        {tags.map((tag, i) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-primary-light px-2 py-0.5 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-primary/60 hover:text-primary"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={tags.length === 0 ? 'Add tags (comma to add)…' : ''}
          className="min-w-[120px] flex-1 border-none p-0 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-0"
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-stone-200 bg-white shadow-sm">
          {filteredSuggestions.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(s)}
              className="block w-full px-3 py-1.5 text-left text-sm text-stone-700 transition-colors duration-150 hover:bg-stone-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
