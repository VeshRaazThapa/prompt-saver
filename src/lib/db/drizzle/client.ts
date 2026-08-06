import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let client: ReturnType<typeof postgres> | undefined;
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
    // Serverless default is a single connection per invocation; tests raise this
    // so concurrent-transaction behavior can actually be exercised.
    // Validated rather than `?? '1'`: `??` only catches null/undefined, so
    // DB_POOL_MAX='' would coerce to 0 (a zero-connection pool that hangs every
    // request with no diagnosable error), and non-numeric input would coerce to NaN.
    const parsedPoolMax = Number(process.env['DB_POOL_MAX']);
    const poolMax = Number.isInteger(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : 1;
    client = postgres(url, { max: poolMax, prepare: false });
    db = drizzle(client, { schema });
  }
  return db;
}

/** Closes the pooled connection. Tests call this in afterAll; app code never needs it. */
export async function closeDb(): Promise<void> {
  if (client !== undefined) {
    await client.end();
    client = undefined;
    db = undefined;
  }
}
