/**
 * @jest-environment node
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { prompts, promptVersions } from '@/lib/db/drizzle/schema';
import { resetDb, seedUser } from './helpers';

describe('postgres schema', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('has all four tables', async () => {
    const rows = await getDb().execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(
      expect.arrayContaining(['users', 'workspaces', 'prompts', 'prompt_versions'])
    );
  });

  it('cascades version deletion when a prompt is deleted', async () => {
    const db = getDb();
    const { workspaceId } = await seedUser();

    await db.insert(prompts).values({ id: 'p1', workspaceId, title: 'T', content: 'C' });
    await db
      .insert(promptVersions)
      .values({ id: 'v1', promptId: 'p1', versionNumber: 1, content: 'C' });
    await db.delete(prompts).where(eq(prompts.id, 'p1'));

    const remaining = await db.select().from(promptVersions);
    expect(remaining).toHaveLength(0);
  });
});
