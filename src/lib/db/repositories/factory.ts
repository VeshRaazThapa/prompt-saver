import { IndexedDBUserRepository } from './indexeddb-user';
import { IndexedDBWorkspaceRepository } from './indexeddb-workspace';
import { IndexedDBPromptRepository } from './indexeddb-prompt';
import { IndexedDBPromptVersionRepository } from './indexeddb-prompt-version';
import { IndexedDBTestRunRepository } from './indexeddb-test-run';
import { IndexedDBLLMProviderRepository } from './indexeddb-llm-provider';
import type {
  IUserRepository,
  IWorkspaceRepository,
  IPromptRepository,
  IPromptVersionRepository,
  ITestRunRepository,
  ILLMProviderRepository,
} from './types';

/**
 * Repository factory for creating repository instances
 * Singleton pattern to ensure same instances are used across the app
 */
class RepositoryFactory {
  private userRepo: IUserRepository | null = null;
  private workspaceRepo: IWorkspaceRepository | null = null;
  private promptRepo: IPromptRepository | null = null;
  private promptVersionRepo: IPromptVersionRepository | null = null;
  private testRunRepo: ITestRunRepository | null = null;
  private llmProviderRepo: ILLMProviderRepository | null = null;

  getUserRepository(): IUserRepository {
    if (this.userRepo === null) {
      this.userRepo = new IndexedDBUserRepository();
    }
    return this.userRepo;
  }

  getWorkspaceRepository(): IWorkspaceRepository {
    if (this.workspaceRepo === null) {
      this.workspaceRepo = new IndexedDBWorkspaceRepository();
    }
    return this.workspaceRepo;
  }

  getPromptRepository(): IPromptRepository {
    if (this.promptRepo === null) {
      this.promptRepo = new IndexedDBPromptRepository();
    }
    return this.promptRepo;
  }

  getPromptVersionRepository(): IPromptVersionRepository {
    if (this.promptVersionRepo === null) {
      this.promptVersionRepo = new IndexedDBPromptVersionRepository();
    }
    return this.promptVersionRepo;
  }

  getTestRunRepository(): ITestRunRepository {
    if (this.testRunRepo === null) {
      this.testRunRepo = new IndexedDBTestRunRepository();
    }
    return this.testRunRepo;
  }

  getLLMProviderRepository(): ILLMProviderRepository {
    if (this.llmProviderRepo === null) {
      this.llmProviderRepo = new IndexedDBLLMProviderRepository();
    }
    return this.llmProviderRepo;
  }
}

// Singleton instance
const repositoryFactory = new RepositoryFactory();

/**
 * Get repository factory instance
 */
export function getRepositoryFactory(): RepositoryFactory {
  return repositoryFactory;
}

// Convenience exports
export function getUserRepository(): IUserRepository {
  return repositoryFactory.getUserRepository();
}

export function getWorkspaceRepository(): IWorkspaceRepository {
  return repositoryFactory.getWorkspaceRepository();
}

export function getPromptRepository(): IPromptRepository {
  return repositoryFactory.getPromptRepository();
}

export function getPromptVersionRepository(): IPromptVersionRepository {
  return repositoryFactory.getPromptVersionRepository();
}

export function getTestRunRepository(): ITestRunRepository {
  return repositoryFactory.getTestRunRepository();
}

export function getLLMProviderRepository(): ILLMProviderRepository {
  return repositoryFactory.getLLMProviderRepository();
}
