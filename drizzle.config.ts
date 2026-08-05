import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

config({ path: '.env.local' });

export default {
  schema: './src/lib/db/drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations need the DIRECT url — pooled connections can't hold migration locks.
    url: process.env['DATABASE_URL_UNPOOLED'] ?? '',
  },
} satisfies Config;
