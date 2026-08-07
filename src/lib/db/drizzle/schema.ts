import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Google OAuth `sub`
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLogin: timestamp('last_login', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    settings: jsonb('settings')
      .$type<{ defaultProvider?: string; theme?: 'light' | 'dark' }>()
      .notNull()
      .default({}),
    metadata: jsonb('metadata')
      .$type<{ promptCount: number; lastActivity: string }>()
      .notNull()
      .default({ promptCount: 0, lastActivity: '' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ userIdx: index('workspaces_user_id_idx').on(t.userId) })
);

export const prompts = pgTable(
  'prompts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    content: text('content').notNull().default(''),
    currentVersionId: text('current_version_id'),
    tags: text('tags').array().notNull().default([]),
    isFavorite: boolean('is_favorite').notNull().default(false),
    status: text('status', { enum: ['draft', 'active', 'archived'] })
      .notNull()
      .default('active'),
    versionCount: integer('version_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('prompts_workspace_id_idx').on(t.workspaceId),
    workspaceUpdatedIdx: index('prompts_workspace_updated_idx').on(t.workspaceId, t.updatedAt),
  })
);

export const promptVersions = pgTable(
  'prompt_versions',
  {
    id: text('id').primaryKey(),
    promptId: text('prompt_id')
      .notNull()
      .references(() => prompts.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    content: text('content').notNull(),
    result: text('result'),
    changeSummary: text('change_summary'),
    previousVersionId: text('previous_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    promptIdx: index('prompt_versions_prompt_id_idx').on(t.promptId),
    promptVersionUniq: uniqueIndex('prompt_versions_prompt_version_uniq').on(
      t.promptId,
      t.versionNumber
    ),
  })
);

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    prefix: text('prefix').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({ userIdx: index('api_tokens_user_id_idx').on(t.userId) })
);
