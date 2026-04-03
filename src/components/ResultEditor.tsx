'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Tab = 'edit' | 'preview';

interface ResultEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  saving?: boolean;
  readOnly?: boolean;
}

export function ResultEditor({ value, onChange, onSave, saving = false, readOnly = false }: ResultEditorProps) {
  const [tab, setTab] = useState<Tab>(value && readOnly ? 'preview' : 'edit');

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2">
        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs font-medium uppercase tracking-wide text-stone-400">LLM Result</span>
          <button
            onClick={() => setTab('edit')}
            className={`min-h-[32px] rounded-md px-3 py-1 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              tab === 'edit'
                ? 'bg-primary-light text-primary'
                : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
            }`}
          >
            Edit
          </button>
          <button
            onClick={() => setTab('preview')}
            className={`min-h-[32px] rounded-md px-3 py-1 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              tab === 'preview'
                ? 'bg-primary-light text-primary'
                : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
            }`}
          >
            Preview
          </button>
        </div>
        {!readOnly && onSave && (
          <button
            onClick={onSave}
            disabled={saving}
            className="min-h-[32px] rounded-md bg-primary px-3 py-1 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Result'}
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="min-h-[200px]">
        {tab === 'edit' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste the LLM output here (supports Markdown)..."
            rows={10}
            readOnly={readOnly}
            className="w-full resize-y rounded-b-lg border-0 bg-stone-50 px-4 py-3 font-mono text-sm leading-relaxed text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none"
          />
        ) : (
          <div className="prose prose-stone prose-sm max-w-none px-4 py-3">
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <p className="italic text-stone-400">No result added yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
