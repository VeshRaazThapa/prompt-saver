'use client';

import React, { useState } from 'react';
import { connectExtensionAction } from '@/lib/actions/extension';
import { revokeTokenAction } from '@/lib/actions/tokens';
import { Button } from '@/components/ui/Button';

type ChromeRuntime = {
  sendMessage: (id: string, msg: unknown, cb: (resp: unknown) => void) => void;
  lastError?: { message?: string };
};
type State = 'idle' | 'working' | 'done' | 'no-extension' | 'error';

/** Present only when an installed extension lists this origin in externally_connectable. */
function runtime(): ChromeRuntime | undefined {
  return (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
}

function sendToken(rt: ChromeRuntime, extId: string, token: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      rt.sendMessage(extId, { type: 'ps-token', token }, (resp) => {
        resolve(rt.lastError === undefined && (resp as { ok?: boolean } | undefined)?.ok === true);
      });
    } catch {
      resolve(false);
    }
  });
}

export function ConnectPanel({
  extId,
  email,
}: {
  extId: string;
  email: string;
}): React.ReactElement {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  async function connect(): Promise<void> {
    setState('working');
    try {
      setState(await runConnect());
    } catch {
      // A rejected server action (network drop, deploy mid-request) must not leave "Connecting…".
      setError('Something went wrong. Please try again.');
      setState('error');
    }
  }

  async function runConnect(): Promise<State> {
    const res = await connectExtensionAction(extId);
    if (!res.ok) {
      setError(res.error);
      return 'error';
    }
    const rt = runtime();
    const delivered = rt !== undefined && (await sendToken(rt, extId, res.data.token));
    if (!delivered) {
      await revokeTokenAction(res.data.tokenId);
      return 'no-extension';
    }
    return 'done';
  }

  if (state === 'done') {
    return (
      <div className="mt-4 space-y-3" role="status">
        <p className="flex items-center gap-2 font-medium text-teal-700">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 12 5 5L20 7" />
          </svg>
          Connected — you can close this tab.
        </p>
        <p className="text-stone-600">
          Open Claude, ChatGPT, Codex or Gemini and type{' '}
          <kbd className="rounded border border-stone-200 bg-stone-50 px-1.5 font-mono text-sm text-stone-700">
            //
          </kbd>{' '}
          in the chat box to insert a prompt.
        </p>
      </div>
    );
  }
  if (state === 'no-extension') {
    return (
      <p className="mt-4 rounded-md border-l-2 border-amber-600 bg-amber-50 px-3 py-2 text-stone-700">
        We couldn&apos;t reach the extension. Make sure Prompt Saver is installed and enabled in
        Chrome, then try again from the extension.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-4">
      <p className="text-stone-600">
        Allow the Prompt Saver extension to read and save prompts in <strong>{email}</strong>
        &apos;s library. You can disconnect any time from Settings.
      </p>
      <p className="text-sm text-stone-500">
        Extension ID: <code className="font-mono text-stone-700">{extId}</code>. It should match the
        ID shown for Prompt Saver in chrome://extensions.
      </p>
      {state === 'error' && (
        <p
          role="alert"
          className="rounded-md border-l-2 border-red-600 bg-red-50 px-3 py-2 text-red-800"
        >
          {error}
        </p>
      )}
      <Button onClick={() => void connect()} isLoading={state === 'working'}>
        {state === 'working' ? 'Connecting…' : 'Connect'}
      </Button>
    </div>
  );
}
