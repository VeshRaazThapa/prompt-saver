import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let db: PostgresJsDatabase<typeof schema> | undefined;

/**
 * Lazily creates the Drizzle client.
 * MUST stay lazy — connecting at module scope breaks `next build`.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (db === undefined) {
    const url = process.env['DATABASE_URL'];
    if (url === undefined || url === '') {
      throw new Error('DATABASE_URL is not set');
    }
    // `prepare: false` is REQUIRED behind Neon's transaction-mode pooler.
    const client = postgres(url, { max: 1, prepare: false });
    db = drizzle(client, { schema });
  }
  return db;
}
