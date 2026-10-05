/**
 * @jest-environment node
 */
import { listTokens } from '@/lib/tokens/repository';
import { resetDb, seedUser, closeDb } from './helpers';

const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';
const mockContext = jest.fn();
jest.mock('@/lib/auth/context', () => ({ getCurrentContext: () => mockContext() }));

import { connectExtensionAction } from '@/lib/actions/extension';
import { EXTENSION_TOKEN_NAME } from '@/lib/extension/ids';

beforeAll(() => {
  process.env['NEXT_PUBLIC_EXTENSION_IDS'] = EXT_ID;
});
beforeEach(async () => {
  await resetDb();
  mockContext.mockReset();
});
afterAll(closeDb);

describe('connectExtensionAction', () => {
  it('mints a ps_ token named "Chrome extension"', async () => {
    const u = await seedUser();
    mockContext.mockResolvedValue(u);
    const res = await connectExtensionAction(EXT_ID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.token).toMatch(/^ps_/);
    const tokens = await listTokens(u.userId);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.name).toBe(EXTENSION_TOKEN_NAME);
  });

  it('revokes the previous active extension token but leaves other tokens alone', async () => {
    const u = await seedUser();
    mockContext.mockResolvedValue(u);
    const { createToken } = await import('@/lib/tokens/repository');
    await createToken(u.userId, 'Claude Code laptop');
    await connectExtensionAction(EXT_ID);
    await connectExtensionAction(EXT_ID);
    const tokens = await listTokens(u.userId);
    const ext = tokens.filter((t) => t.name === EXTENSION_TOKEN_NAME);
    expect(ext).toHaveLength(2);
    expect(ext.filter((t) => t.revokedAt === null)).toHaveLength(1);
    expect(tokens.find((t) => t.name === 'Claude Code laptop')?.revokedAt).toBeNull();
  });

  it('rejects an unknown extension id without minting', async () => {
    const u = await seedUser();
    mockContext.mockResolvedValue(u);
    const res = await connectExtensionAction('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');
    expect(res.ok).toBe(false);
    expect(await listTokens(u.userId)).toHaveLength(0);
  });
});
