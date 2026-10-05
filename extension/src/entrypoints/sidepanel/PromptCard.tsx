import type { ExtPrompt } from '@/lib/types';

const btn = 'min-h-11 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none';

export function PromptCard(props: { prompt: ExtPrompt; canInsert: boolean; onInsert: () => void; onCopy: () => void; onStar: () => void }) {
  const { prompt: p } = props;
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-stone-900 dark:text-stone-50">{p.title}</h3>
        <button aria-label={p.is_favorite ? `Unstar ${p.title}` : `Star ${p.title}`} onClick={props.onStar} className={`${btn} text-teal-600`}>
          {p.is_favorite ? '★' : '☆'}
        </button>
      </div>
      <p className="mt-1 line-clamp-2 font-mono text-xs text-stone-500 dark:text-stone-400">{p.content}</p>
      <div className="mt-2 flex gap-2">
        {props.canInsert && (
          <button aria-label={`Insert ${p.title}`} onClick={props.onInsert} className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}>Insert</button>
        )}
        <button aria-label={`Copy ${p.title}`} onClick={props.onCopy} className={`${btn} border border-stone-300 text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-700`}>Copy</button>
      </div>
    </li>
  );
}
