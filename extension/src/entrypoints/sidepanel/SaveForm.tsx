import { useState } from 'react';
import { AlertIcon } from './icons';
import { btnGhost, btnPrimary, field } from './ui';

export function SaveForm(props: {
  initial: { title: string; content: string };
  onSave: (v: { title: string; content: string; tags: string[] }) => Promise<string | null>; // returns error message or null
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(props.initial.title);
  const [content, setContent] = useState(props.initial.content);
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = 'block text-[13px] font-medium text-stone-700 dark:text-stone-300';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await props.onSave({ title: title.trim(), content, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) });
    setBusy(false);
    setError(err);
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onCancel();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.requestSubmit();
      }}
      className="space-y-4"
    >
      <label className={label}>
        Title
        <input className={`${field} mt-1.5 min-h-11`} value={title} maxLength={200} required autoFocus={title === ''} placeholder="e.g. Code review checklist" onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className={label}>
        Content
        <textarea className={`${field} mt-1.5 h-56 resize-y py-2.5 font-mono text-[13px] leading-relaxed`} value={content} required autoFocus={title !== '' && content === ''} placeholder="Write or paste your prompt…" onChange={(e) => setContent(e.target.value)} />
      </label>
      <label className={label}>
        Tags <span className="font-normal text-stone-400 dark:text-stone-500">(comma-separated)</span>
        <input className={`${field} mt-1.5 min-h-11`} value={tags} placeholder="review, typescript" onChange={(e) => setTags(e.target.value)} />
      </label>
      {error !== null && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border-l-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={props.onCancel} className={`${btnGhost} px-4`}>Cancel</button>
        <span className="ml-auto hidden text-xs text-stone-400 min-[340px]:inline dark:text-stone-500">⌘↵ to save</span>
      </div>
    </form>
  );
}
