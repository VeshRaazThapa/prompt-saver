type P = { className?: string };
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

/** The brand mark (same artwork as the toolbar icon). */
export function Logo({ className = 'size-7' }: P) {
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

export const SearchIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const PlusIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const DraftIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
export const ExternalIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M14 4h6v6M10 14 20 4M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>
);
export const CopyIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></svg>
);
export const CheckIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="m5 12 5 5L20 7" /></svg>
);
export const InsertIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M4 12h12M11 6l6 6-6 6M20 5v14" /></svg>
);
export const AlertIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
);
export function StarIcon({ filled, className = 'size-5' }: P & { filled: boolean }) {
  return (
    <svg {...base} className={className} fill={filled ? 'currentColor' : 'none'}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}
