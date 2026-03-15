import type { Prompt, PromptVersion, TestRun, LLMProvider, User, Workspace } from '@/types';

/**
 * Base repository interface
 */
export interface IRepository<T> {
  /**
   * Finds an entity by ID
   * @param id The entity ID
   * @returns The entity or null if not found
   */
  findById(id: string): Promise<T | null>;

  /**
   * Creates a new entity
   * @param entity The entity to create
   * @returns The created entity
   */
  create(entity: T): Promise<T>;

  /**
   * Updates an existing entity
   * @param id The entity ID
   * @param updates Partial entity updates
   * @returns The updated entity
   */
  update(id: string, updates: Partial<T>): Promise<T>;

  /**
   * Deletes an entity by ID
   * @param id The entity ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;
}

/**
 * User repository interface
 */
export interface IUserRepository extends IRepository<User> {
  /**
   * Finds a user by email
   * @param email The user's email
   * @returns The user or null if not found
   */
  findByEmail(email: string): Promise<User | null>;
}

/**
 * Workspace repository interface
 */
export interface IWorkspaceRepository extends IRepository<Workspace> {
  /**
   * Finds all workspaces for a user
   * @param userId The user ID
   * @returns Array of workspaces
   */
  findByUserId(userId: string): Promise<Workspace[]>;
}

/**
 * Prompt repository interface
 */
export interface IPromptRepository extends IRepository<Prompt> {
  /**
   * Finds all prompts in a workspace
   * @param workspaceId The workspace ID
   * @param options Query options
   * @returns Array of prompts
   */
  findByWorkspaceId(
    workspaceId: string,
    options?: {
      limit?: number;
      offset?: number;
      favoritesOnly?: boolean;
      status?: Prompt['status'];
      sortBy?: 'created_at' | 'updated_at' | 'title';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<Prompt[]>;

  /**
   * Searches prompts by title or tags
   * @param workspaceId The workspace ID
   * @param query Search query
   * @param options Query options
   * @returns Array of matching prompts
   */
  search(
    workspaceId: string,
    query: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Prompt[]>;

  /**
   * Counts total prompts in a workspace
   * @param workspaceId The workspace ID
   * @returns Total count
   */
  countByWorkspaceId(workspaceId: string): Promise<number>;
}

/**
 * Prompt version repository interface
 */
export interface IPromptVersionRepository extends IRepository<PromptVersion> {
  /**
   * Finds all versions for a prompt
   * @param promptId The prompt ID
   * @param options Query options
   * @returns Array of versions ordered by version number descending
   */
  findByPromptId(
    promptId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<PromptVersion[]>;

  /**
   * Finds a specific version by prompt ID and version number
   * @param promptId The prompt ID
   * @param versionNumber The version number
   * @returns The version or null if not found
   */
  findByVersion(promptId: string, versionNumber: number): Promise<PromptVersion | null>;

  /**
   * Gets the latest version for a prompt
   * @param promptId The prompt ID
   * @returns The latest version or null if none exist
   */
  getLatestVersion(promptId: string): Promise<PromptVersion | null>;

  /**
   * Creates a new version atomically with prompt update
   * @param version The version to create
   * @param promptId The prompt ID to update
   * @returns The created version
   */
  createVersionAtomic(version: PromptVersion, promptId: string): Promise<PromptVersion>;
}

/**
 * Test run repository interface
 */
export interface ITestRunRepository extends IRepository<TestRun> {
  /**
   * Finds all test runs for a prompt
   * @param promptId The prompt ID
   * @param options Query options
   * @returns Array of test runs
   */
  findByPromptId(
    promptId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<TestRun[]>;

  /**
   * Finds all test runs for a specific prompt version
   * @param promptVersionId The prompt version ID
   * @param options Query options
   * @returns Array of test runs
   */
  findByPromptVersionId(
    promptVersionId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<TestRun[]>;

  /**
   * Finds all test runs in a workspace
   * @param workspaceId The workspace ID
   * @param options Query options
   * @returns Array of test runs
   */
  findByWorkspaceId(
    workspaceId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<TestRun[]>;
}

/**
 * LLM provider repository interface
 */
export interface ILLMProviderRepository extends IRepository<LLMProvider> {
  /**
   * Finds all providers in a workspace
   * @param workspaceId The workspace ID
   * @returns Array of providers
   */
  findByWorkspaceId(workspaceId: string): Promise<LLMProvider[]>;

  /**
   * Finds a provider by workspace and provider name
   * @param workspaceId The workspace ID
   * @param providerName The provider name
   * @returns The provider or null if not found
   */
  findByName(
    workspaceId: string,
    providerName: LLMProvider['provider_name']
  ): Promise<LLMProvider | null>;

  /**
   * Finds all active providers in a workspace
   * @param workspaceId The workspace ID
   * @returns Array of active providers
   */
  findActiveProviders(workspaceId: string): Promise<LLMProvider[]>;
}
