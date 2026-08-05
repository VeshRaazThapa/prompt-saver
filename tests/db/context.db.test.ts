/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { users, workspaces } from '@/lib/db/drizzle/schema';
import { getCurrentContext } from '@/lib/auth/context';
import { closeDb, resetDb } from './helpers';

const mockSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  requireAuth: () => mockSession(),
}));

function sessionFor(id: string, email: string) {
  return { user: { id, email, name: 'Test User', image: null } };
}

describe('getCurrentContext', () => {
  beforeEach(async () => {
    await resetDb();
    mockSession.mockReset();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates the user and a workspace on first call', async () => {
    mockSession.mockResolvedValue(sessionFor('google-1', 'one@example.com'));

    const ctx = await getCurrentContext();

    expect(ctx.userId).toBe('google-1');
    expect(ctx.workspaceId).toBeTruthy();

    const rows = await getDb().select().from(workspaces).where(eq(workspaces.userId, 'google-1'));
    expect(rows).toHaveLength(1);
  });

  it('reuses the existing workspace on later calls', async () => {
    mockSession.mockResolvedValue(sessionFor('google-1', 'one@example.com'));

    const first = await getCurrentContext();
    const second = await getCurrentContext();

    expect(second.workspaceId).toBe(first.workspaceId);
    const rows = await getDb().select().from(workspaces).where(eq(workspaces.userId, 'google-1'));
    expect(rows).toHaveLength(1);
  });

  it('gives two different users two different workspaces', async () => {
    mockSession.mockResolvedValue(sessionFor('google-1', 'one@example.com'));
    const a = await getCurrentContext();

    mockSession.mockResolvedValue(sessionFor('google-2', 'two@example.com'));
    const b = await getCurrentContext();

    expect(a.workspaceId).not.toBe(b.workspaceId);
    expect(a.userId).not.toBe(b.userId);
  });

  it('refreshes last_login and profile fields on repeat sign-in', async () => {
    mockSession.mockResolvedValue(sessionFor('google-1', 'one@example.com'));
    await getCurrentContext();

    mockSession.mockResolvedValue({
      user: { id: 'google-1', email: 'renamed@example.com', name: 'Renamed', image: null },
    });
    await getCurrentContext();

    const [row] = await getDb().select().from(users).where(eq(users.id, 'google-1'));
    expect(row?.email).toBe('renamed@example.com');
    expect(row?.name).toBe('Renamed');
  });
});
