'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TokenSummary } from '@/lib/tokens/repository';
import { listTokensAction, createTokenAction, revokeTokenAction } from '@/lib/actions/tokens';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const MCP_URL = 'https://prompt-saver-two.vercel.app/api/mcp';

function mcpCommandFor(token: string): string {
  return `claude mcp add --transport http prompt-saver --scope user \\\n  ${MCP_URL} \\\n  --header "Authorization: Bearer ${token}"`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Copies text to the clipboard, reporting success so callers can show feedback. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  // Reset "Copied" through an effect (not a bare setTimeout in the click handler) so the
  // timer is cleared on unmount — clicking Copy then dismissing the reveal within the
  // 2s window must not call setState on an unmounted component.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleClick = useCallback(async () => {
    const ok = await copyToClipboard(text);
    if (ok) setCopied(true);
  }, [text]);

  return (
    <Button type="button" variant="secondary" onClick={handleClick}>
      {copied ? 'Copied' : label}
    </Button>
  );
}

function NewTokenReveal({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  return (
    <div className="mb-6 rounded-lg border border-primary bg-primary-light/40 p-4">
      <p className="mb-3 text-sm font-semibold text-stone-900">
        Copy this now — you won&apos;t be able to see it again.
      </p>

      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-md border border-stone-200 bg-white px-3 py-2 font-mono text-sm text-stone-900">
          {token}
        </code>
        <CopyButton text={token} label="Copy" />
      </div>

      <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-stone-500">
        Connect Claude Code
      </p>
      <div className="flex items-start gap-2">
        <pre className="flex-1 overflow-x-auto rounded-md border border-stone-700 bg-stone-900 px-3 py-2 font-mono text-xs leading-relaxed text-stone-100">
          {mcpCommandFor(token)}
        </pre>
        <CopyButton text={mcpCommandFor(token)} label="Copy command" />
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="ghost" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </div>
  );
}

function TokensTable({
  tokens,
  onRevoke,
}: {
  tokens: TokenSummary[];
  onRevoke: (id: string) => void;
}) {
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-stone-200 bg-white py-16 text-center">
        <p className="text-stone-500">No tokens yet — create one below to connect Claude Code.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Token</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Last used</th>
            <th className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {tokens.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3 text-stone-900">
                {t.name}
                {t.revokedAt !== null && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                    Revoked
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-stone-500">{t.prefix}…</td>
              <td className="px-4 py-3 text-stone-500">{formatDate(t.createdAt)}</td>
              <td className="px-4 py-3 text-stone-500">
                {t.lastUsedAt === null ? 'Never' : formatDate(t.lastUsedAt)}
              </td>
              <td className="px-4 py-3 text-right">
                {t.revokedAt === null && (
                  <button
                    type="button"
                    onClick={() => onRevoke(t.id)}
                    className="min-h-[44px] rounded-md px-3 text-sm font-medium text-error transition-colors duration-150 ease-out hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TokensPage() {
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  // Held in memory only, cleared on dismiss — never re-fetchable.
  const [newToken, setNewToken] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTokensAction();
      if (result.ok) setTokens(result.data);
      else setError(result.error);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await createTokenAction(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewToken(result.data.token);
      setName('');
      await load();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  }, [name, load]);

  const closeRevokeModal = useCallback(() => {
    setRevokeId(null);
    setRevokeError(null);
    // Guards against a stale spinner surviving a close-and-reopen on a different token —
    // see the try/catch below for why `revoking` can otherwise get stuck at `true`.
    setRevoking(false);
  }, []);

  const handleRevoke = useCallback(async () => {
    if (revokeId === null) return;
    setRevoking(true);
    setRevokeError(null);
    // A transport-level rejection (network drop, aborted fetch) is distinct from the
    // action resolving with { ok: false } and must still clear `revoking` — otherwise
    // ConfirmModal's confirm button (isLoading={revoking} -> disabled) stays stuck
    // permanently, on the one page whose job is turning off a leaked credential.
    try {
      const result = await revokeTokenAction(revokeId);
      if (!result.ok) {
        setRevokeError(result.error);
        return;
      }
      setRevokeId(null);
      await load();
    } catch {
      setRevokeError('Something went wrong. Please try again.');
    } finally {
      setRevoking(false);
    }
  }, [revokeId, load]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-stone-900">API Tokens</h1>
      <p className="mt-1 text-sm text-stone-500">
        Create a token to connect a Claude Code session to your prompt library over MCP.
      </p>

      {error !== null && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {newToken !== null && (
        <div className="mt-6">
          <NewTokenReveal token={newToken} onDismiss={() => setNewToken(null)} />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="token-name" className="mb-1 block text-sm font-medium text-stone-600">
            Token name
          </label>
          <input
            id="token-name"
            type="text"
            placeholder="e.g. laptop, CI"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !creating) handleCreate();
            }}
            className="w-full min-h-[44px] rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-colors duration-150 ease-out focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          />
        </div>
        <Button type="button" onClick={handleCreate} isLoading={creating}>
          Create token
        </Button>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <TokensTable
            tokens={tokens}
            onRevoke={(id) => {
              setRevokeId(id);
              setRevokeError(null);
            }}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={revokeId !== null}
        onClose={closeRevokeModal}
        onConfirm={handleRevoke}
        title="Revoke Token"
        message="This token will stop working immediately. Any Claude Code session using it will lose access. This cannot be undone."
        confirmLabel="Revoke"
        isLoading={revoking}
        error={revokeError}
      />
    </div>
  );
}
