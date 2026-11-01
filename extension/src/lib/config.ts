export const API_BASE: string = import.meta.env.WXT_API_BASE ?? 'https://prompt-saver-two.vercel.app';
// Pages people open (connect, privacy, library) live on the custom domain. The API stays on the
// vercel.app host: moving it would add a host permission, and Chrome disables installed copies
// until the user re-approves.
export const SITE_BASE: string = import.meta.env.WXT_API_BASE ?? 'https://promptsaver.online';
