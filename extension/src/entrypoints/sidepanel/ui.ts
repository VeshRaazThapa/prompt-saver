/** Shared class strings so every control gets the DESIGN.md transition, focus ring and 44px target. */
const interactive =
  'transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-teal-400 dark:focus-visible:ring-offset-stone-900 disabled:cursor-not-allowed disabled:opacity-50';

export const btnPrimary = `${interactive} inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-500 dark:text-stone-950 dark:hover:bg-teal-400`;
export const btnSecondary = `${interactive} inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 hover:border-stone-300 hover:bg-stone-50 active:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700`;
export const btnGhost = `${interactive} inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100`;
export const field = `${interactive} w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 hover:border-stone-300 focus-visible:border-teal-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500`;
