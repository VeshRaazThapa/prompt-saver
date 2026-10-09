import React from 'react';

/** The Prompt Saver mark: a bookmark with the // trigger cut into it. Same artwork as app/icon.svg. */
export function BrandMark({ className = 'h-8 w-8' }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0D9488" />
      <path d="M9 6.5a1.5 1.5 0 0 1 1.5-1.5h11a1.5 1.5 0 0 1 1.5 1.5V27l-7-5-7 5z" fill="#FAFAF9" />
      <g stroke="#0D9488" strokeWidth="2.6" strokeLinecap="round">
        <line x1="12.6" y1="17.5" x2="14.6" y2="10" />
        <line x1="17.4" y1="17.5" x2="19.4" y2="10" />
      </g>
    </svg>
  );
}
