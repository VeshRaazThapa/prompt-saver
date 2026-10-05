import { useState } from 'react';

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
  const field = 'mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm dark:border-stone-600 dark:bg-stone-900 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await props.onSave({ title: title.trim(), content, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) });
    setBusy(false);
    setError(err);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">Title<input className={field} value={title} maxLength={200} required onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="block text-sm">Content<textarea className={`${field} h-48 font-mono`} value={content} required onChange={(e) => setContent(e.target.value)} /></label>
      <label className="block text-sm">Tags (comma-separated)<input className={field} value={tags} onChange={(e) => setTags(e.target.value)} /></label>
      {error !== null && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-teal-700 focus-visible:ring-2">{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={props.onCancel} className="min-h-11 rounded-lg px-4 text-sm text-stone-600 transition-colors duration-150 ease-out hover:bg-stone-100 focus-visible:ring-2">Cancel</button>
      </div>
    </form>
  );
}
