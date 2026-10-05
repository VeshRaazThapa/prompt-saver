import React from 'react';

export const metadata = { title: 'Privacy Policy — Prompt Saver' };

const CONTACT = 'brthapa@maitriservices.com';

export default function PrivacyPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-2xl bg-stone-50 px-4 py-12 font-body text-stone-800">
      <h1 className="font-display text-4xl text-stone-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated: 5 October 2026</p>

      <h2 className="mt-8 text-xl font-semibold">What we store</h2>
      <p className="mt-2">
        Your Google account name, email address and profile picture, and the prompts you save
        (title, text, tags, version history). Data is stored in Neon Postgres and served from
        Vercel.
      </p>

      <h2 className="mt-8 text-xl font-semibold">The Chrome extension</h2>
      <p className="mt-2">
        While you type in a supported AI chat box, the extension checks the text locally for
        &quot;//&quot; to show the prompt picker. That text never leaves your browser. The extension
        sends text to Prompt Saver only when you save a prompt (from the picker, the side panel, or
        right-click &quot;Save to Prompt Saver&quot;). It does not send your conversations. Your
        prompt library is cached in the extension&apos;s local storage so the picker opens
        instantly.
      </p>

      <h2 className="mt-8 text-xl font-semibold">What we don&apos;t do</h2>
      <p className="mt-2">We do not sell your data, show ads, or share your prompts with anyone.</p>

      <h2 className="mt-8 text-xl font-semibold">Deleting your data</h2>
      <p className="mt-2">
        To delete your account and every prompt, email{' '}
        <a className="text-teal-700 underline" href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
        . We delete it within 30 days. You can revoke the extension&apos;s access any time from
        Settings.
      </p>
    </main>
  );
}
