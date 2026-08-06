export const DB_NAME = 'prompt-saver';
export const DB_VERSION = 2;

export const STORES = {
  USERS: 'users',
  WORKSPACES: 'workspaces',
  PROMPTS: 'prompts',
  PROMPT_VERSIONS: 'prompt_versions',
} as const;

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
} as const;

export function upgradeSchema(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    // Users store
    const usersStore = db.createObjectStore(STORES.USERS, { keyPath: 'id' });
    usersStore.createIndex(INDEXES.USERS.EMAIL, 'email', { unique: true });

    // Workspaces store
    const workspacesStore = db.createObjectStore(STORES.WORKSPACES, { keyPath: 'id' });
    workspacesStore.createIndex(INDEXES.WORKSPACES.USER_ID, 'user_id', { unique: false });

    // Prompts store
    const promptsStore = db.createObjectStore(STORES.PROMPTS, { keyPath: 'id' });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_ID, 'workspace_id', { unique: false });
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
    const versionsStore = db.createObjectStore(STORES.PROMPT_VERSIONS, { keyPath: 'id' });
    versionsStore.createIndex(INDEXES.PROMPT_VERSIONS.PROMPT_ID, 'prompt_id', { unique: false });
    versionsStore.createIndex(
      INDEXES.PROMPT_VERSIONS.PROMPT_VERSION,
      ['prompt_id', 'version_number'],
      { unique: true }
    );
  }

  // V1 -> V2: Clean wipe for internal MVP — type shapes changed, no prod data to migrate
  if (oldVersion >= 1 && oldVersion < 2) {
    // Drop unused stores
    if (db.objectStoreNames.contains('test_runs')) {
      db.deleteObjectStore('test_runs');
    }
    if (db.objectStoreNames.contains('llm_providers')) {
      db.deleteObjectStore('llm_providers');
    }

    // Wipe and recreate prompts + prompt_versions (content type changed)
    if (db.objectStoreNames.contains('prompts')) {
      db.deleteObjectStore('prompts');
    }
    if (db.objectStoreNames.contains('prompt_versions')) {
      db.deleteObjectStore('prompt_versions');
    }

    const promptsStore = db.createObjectStore(STORES.PROMPTS, { keyPath: 'id' });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_ID, 'workspace_id', { unique: false });
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

    const versionsStore = db.createObjectStore(STORES.PROMPT_VERSIONS, { keyPath: 'id' });
    versionsStore.createIndex(INDEXES.PROMPT_VERSIONS.PROMPT_ID, 'prompt_id', { unique: false });
    versionsStore.createIndex(
      INDEXES.PROMPT_VERSIONS.PROMPT_VERSION,
      ['prompt_id', 'version_number'],
      { unique: true }
    );
  }
}
