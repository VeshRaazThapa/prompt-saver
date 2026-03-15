/**
 * IndexedDB schema definition for Prompt Saver
 * Schema Version: 1.0
 */

export const DB_NAME = 'prompt-saver';
export const DB_VERSION = 1;

/**
 * Object store names
 */
export const STORES = {
  USERS: 'users',
  WORKSPACES: 'workspaces',
  PROMPTS: 'prompts',
  PROMPT_VERSIONS: 'prompt_versions',
  TEST_RUNS: 'test_runs',
  LLM_PROVIDERS: 'llm_providers',
} as const;

/**
 * Index definitions for each store
 */
export const INDEXES = {
  USERS: {
    EMAIL: 'email',
  },
  WORKSPACES: {
    USER_ID: 'user_id',
  },
  PROMPTS: {
    WORKSPACE_ID: 'workspace_id',
    WORKSPACE_CREATED: 'workspace_created',
    WORKSPACE_FAVORITE: 'workspace_favorite',
    WORKSPACE_TITLE: 'workspace_title',
  },
  PROMPT_VERSIONS: {
    PROMPT_ID: 'prompt_id',
    PROMPT_VERSION: 'prompt_version',
  },
  TEST_RUNS: {
    WORKSPACE_ID: 'workspace_id',
    PROMPT_ID: 'prompt_id',
    PROMPT_VERSION_ID: 'prompt_version_id',
    WORKSPACE_CREATED: 'workspace_created',
  },
  LLM_PROVIDERS: {
    WORKSPACE_ID: 'workspace_id',
    WORKSPACE_PROVIDER: 'workspace_provider',
  },
} as const;

/**
 * Schema upgrade function
 * Defines the structure of each object store and its indexes
 */
export function upgradeSchema(db: IDBDatabase, oldVersion: number): void {
  // Version 1: Initial schema
  if (oldVersion < 1) {
    // Users store
    const usersStore = db.createObjectStore(STORES.USERS, {
      keyPath: 'id',
    });
    usersStore.createIndex(INDEXES.USERS.EMAIL, 'email', { unique: true });

    // Workspaces store
    const workspacesStore = db.createObjectStore(STORES.WORKSPACES, {
      keyPath: 'id',
    });
    workspacesStore.createIndex(INDEXES.WORKSPACES.USER_ID, 'user_id', {
      unique: false,
    });

    // Prompts store
    const promptsStore = db.createObjectStore(STORES.PROMPTS, {
      keyPath: 'id',
    });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_ID, 'workspace_id', {
      unique: false,
    });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_CREATED, ['workspace_id', 'created_at'], {
      unique: false,
    });
    promptsStore.createIndex(
      INDEXES.PROMPTS.WORKSPACE_FAVORITE,
      ['workspace_id', 'is_favorite', 'updated_at'],
      { unique: false }
    );
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_TITLE, ['workspace_id', 'title'], {
      unique: false,
    });

    // Prompt versions store
    const versionsStore = db.createObjectStore(STORES.PROMPT_VERSIONS, {
      keyPath: 'id',
    });
    versionsStore.createIndex(INDEXES.PROMPT_VERSIONS.PROMPT_ID, 'prompt_id', {
      unique: false,
    });
    versionsStore.createIndex(
      INDEXES.PROMPT_VERSIONS.PROMPT_VERSION,
      ['prompt_id', 'version_number'],
      { unique: true }
    );

    // Test runs store
    const testRunsStore = db.createObjectStore(STORES.TEST_RUNS, {
      keyPath: 'id',
    });
    testRunsStore.createIndex(INDEXES.TEST_RUNS.WORKSPACE_ID, 'workspace_id', {
      unique: false,
    });
    testRunsStore.createIndex(INDEXES.TEST_RUNS.PROMPT_ID, 'prompt_id', {
      unique: false,
    });
    testRunsStore.createIndex(INDEXES.TEST_RUNS.PROMPT_VERSION_ID, 'prompt_version_id', {
      unique: false,
    });
    testRunsStore.createIndex(INDEXES.TEST_RUNS.WORKSPACE_CREATED, ['workspace_id', 'created_at'], {
      unique: false,
    });

    // LLM providers store
    const providersStore = db.createObjectStore(STORES.LLM_PROVIDERS, {
      keyPath: 'id',
    });
    providersStore.createIndex(INDEXES.LLM_PROVIDERS.WORKSPACE_ID, 'workspace_id', {
      unique: false,
    });
    providersStore.createIndex(
      INDEXES.LLM_PROVIDERS.WORKSPACE_PROVIDER,
      ['workspace_id', 'provider_name'],
      { unique: true }
    );
  }
}
