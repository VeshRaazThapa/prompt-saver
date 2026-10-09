import { useEffect, useState } from 'react';
import type { ExtPrompt } from '@/lib/types';
import { CheckIcon, CopyIcon, InsertIcon, StarIcon } from './icons';
import { btnGhost, btnPrimary, btnSecondary } from './ui';

const COPIED_MS = 1500;

export function PromptCard(props: { prompt: ExtPrompt; canInsert: boolean; onInsert: () => void; onCopy: () => Promise<boolean>; onStar: () => void }) {
  const { prompt: p } = props;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <li className="group rounded-xl border border-stone-200 bg-white p-3 transition-[border-color,box-shadow] duration-200 ease-out hover:border-stone-300 hover:shadow-sm dark:border-stone-700/80 dark:bg-stone-800 dark:hover:border-stone-600">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 pt-2.5">
          <h3 className="truncate text-[15px] leading-tight font-semibold text-stone-900 dark:text-stone-100">{p.title}</h3>
        </div>
        <button
          aria-label={p.is_favorite ? `Unstar ${p.title}` : `Star ${p.title}`}
          aria-pressed={p.is_favorite}
          onClick={props.onStar}
          className={`${btnGhost} -mt-0.5 -mr-1.5 ${p.is_favorite ? 'text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300' : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'}`}
        >
          <StarIcon filled={p.is_favorite} />
        </button>
      </div>
      <p className="mt-1 line-clamp-2 font-mono text-xs leading-relaxed whitespace-pre-line text-stone-500 dark:text-stone-400">{p.content}</p>
      {p.tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Tags">
          {p.tags.slice(0, 4).map((t) => (
            <li key={t} className="rounded-sm bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-300">{t}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        {props.canInsert && (
          <button aria-label={`Insert ${p.title}`} onClick={props.onInsert} className={`${btnPrimary} flex-1`}>
            <InsertIcon /> Insert
          </button>
        )}
        <button
          aria-label={`Copy ${p.title}`}
          onClick={() => void props.onCopy().then(setCopied)}
          className={`${btnSecondary} ${props.canInsert ? '' : 'flex-1'}`}
        >
          {copied ? <CheckIcon className="size-4 text-teal-600 dark:text-teal-400" /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </li>
  );
}
