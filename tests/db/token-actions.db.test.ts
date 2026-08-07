/**
 * @jest-environment node
 */
import { resetDb, closeDb } from './helpers';

const mockSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({ requireAuth: () => mockSession() }));
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import * as actions from '@/lib/actions/tokens';

function signInAs(id: string, email: string) {
  mockSession.mockResolvedValue({ user: { id, email, name: id, image: null } });
}

function unwrap<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`Expected ok, got: ${r.error}`);
  return r.data;
}

describe('token actions', () => {
  beforeEach(async () => {
    await resetDb();
    mockSession.mockReset();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates a token and returns the raw value exactly once', async () => {
    signInAs('user-a', 'a@example.com');

    const { token } = unwrap(await actions.createTokenAction('laptop'));
    expect(token.startsWith('ps_')).toBe(true);

    const list = unwrap(await actions.listTokensAction());
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain(token.slice(3));
  });

  it('rejects a blank token name', async () => {
    signInAs('user-a', 'a@example.com');
    expect((await actions.createTokenAction('   ')).ok).toBe(false);
  });

  // THE ISOLATION GUARD.
  it('lists only the caller tokens', async () => {
    signInAs('user-b', 'b@example.com');
    await actions.createTokenAction('b-machine');

    signInAs('user-a', 'a@example.com');
    expect(unwrap(await actions.listTokensAction())).toHaveLength(0);
  });

  it('refuses to revoke another user token', async () => {
    signInAs('user-b', 'b@example.com');
    await actions.createTokenAction('victim');
    const bTokens = unwrap(await actions.listTokensAction());

    signInAs('user-a', 'a@example.com');
    expect((await actions.revokeTokenAction(bTokens[0]!.id)).ok).toBe(false);
  });

  it('revokes the caller own token', async () => {
    signInAs('user-a', 'a@example.com');
    await actions.createTokenAction('laptop');
    const [t] = unwrap(await actions.listTokensAction());

    expect((await actions.revokeTokenAction(t!.id)).ok).toBe(true);
    expect(unwrap(await actions.listTokensAction())[0]?.revokedAt).not.toBeNull();
  });

  it('fails cleanly when not signed in', async () => {
    mockSession.mockRejectedValue(new Error('Authentication required'));
    expect((await actions.listTokensAction()).ok).toBe(false);
  });
});
