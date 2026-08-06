'use client';

import { useState } from 'react';

interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}

export function Accordion({ title, defaultOpen = true, badge, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-4 w-4 text-stone-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-stone-900">{title}</span>
          {badge && (
            <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-stone-100 text-stone-500">
              {badge}
            </span>
          )}
        </div>
      </button>
      {open && <div className="border-t border-stone-100">{children}</div>}
    </div>
  );
}
