import { TestRun } from '@/types';
import { ITestRunRepository } from './types';
import { STORES, INDEXES } from '../schema';
import { openDB } from '../client';
import { NotFoundError } from '@/lib/errors';

export class IndexedDBTestRunRepository implements ITestRunRepository {
  async findById(id: string): Promise<TestRun | null> {
    const db = await openDB();
    const tx = db.transaction([STORES.TEST_RUNS], 'readonly');
    const store = tx.objectStore(STORES.TEST_RUNS);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        reject(new Error('Failed to find test run'));
      };
    });
  }

  async create(entity: TestRun): Promise<TestRun> {
    const db = await openDB();
    const tx = db.transaction([STORES.TEST_RUNS], 'readwrite');
    const store = tx.objectStore(STORES.TEST_RUNS);

    return new Promise((resolve, reject) => {
      const request = store.add(entity);

      request.onsuccess = () => {
        resolve(entity);
      };

      request.onerror = () => {
        reject(new Error('Failed to create test run'));
      };
    });
  }

  async update(id: string, updates: Partial<TestRun>): Promise<TestRun> {
    const db = await openDB();
    const tx = db.transaction([STORES.TEST_RUNS], 'readwrite');
    const store = tx.objectStore(STORES.TEST_RUNS);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (existing === undefined) {
          reject(new NotFoundError('TestRun', id));
          return;
        }

        const updated = { ...existing, ...updates, id };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => {
          resolve(updated);
        };

        putRequest.onerror = () => {
          reject(new Error('Failed to update test run'));
        };
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to find test run'));
      };
    });
  }

  async delete(id: string): Promise<boolean> {
    const db = await openDB();
    const tx = db.transaction([STORES.TEST_RUNS], 'readwrite');
    const store = tx.objectStore(STORES.TEST_RUNS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('Failed to delete test run'));
      };
    });
  }

  async findByPromptId(
    promptId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TestRun[]> {
    const db = await openDB();
    const tx = db.transaction([STORES.TEST_RUNS], 'readonly');
    const store = tx.objectStore(STORES.TEST_RUNS);
    const index = store.index(INDEXES.TEST_RUNS.PROMPT_ID);

    return new Promise((resolve, reject) => {
      const request = index.getAll(promptId);

      request.onsuccess = () => {
        let results = request.result as TestRun[];

        // Sort by created_at descending
        results.sort((a, b) => b.created_at.localeCompare(a.created_at));

        // Pagination
        const offset = options.offset ?? 0;
        const limit = options.limit ?? results.length;
        results = results.slice(offset, offset + limit);

        resolve(results);
      };

      request.onerror = () => {
        reject(new Error('Failed to find test runs'));
      };
    });
  }

  async findByPromptVersionId(
    promptVersionId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TestRun[]> {
    const db = await openDB();
    const tx = db.transaction([STORES.TEST_RUNS], 'readonly');
    const store = tx.objectStore(STORES.TEST_RUNS);
    const index = store.index(INDEXES.TEST_RUNS.PROMPT_VERSION_ID);

    return new Promise((resolve, reject) => {
      const request = index.getAll(promptVersionId);

      request.onsuccess = () => {
        let results = request.result as TestRun[];

        // Sort by created_at descending
        results.sort((a, b) => b.created_at.localeCompare(a.created_at));

        // Pagination
        const offset = options.offset ?? 0;
        const limit = options.limit ?? results.length;
        results = results.slice(offset, offset + limit);

        resolve(results);
      };

      request.onerror = () => {
        reject(new Error('Failed to find test runs'));
      };
    });
  }

  async findByWorkspaceId(
    workspaceId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TestRun[]> {
    const db = await openDB();
    const tx = db.transaction([STORES.TEST_RUNS], 'readonly');
    const store = tx.objectStore(STORES.TEST_RUNS);
    const index = store.index(INDEXES.TEST_RUNS.WORKSPACE_ID);

    return new Promise((resolve, reject) => {
      const request = index.getAll(workspaceId);

      request.onsuccess = () => {
        let results = request.result as TestRun[];

        // Sort by created_at descending
        results.sort((a, b) => b.created_at.localeCompare(a.created_at));

        // Pagination
        const offset = options.offset ?? 0;
        const limit = options.limit ?? results.length;
        results = results.slice(offset, offset + limit);

        resolve(results);
      };

      request.onerror = () => {
        reject(new Error('Failed to find test runs'));
      };
    });
  }
}
