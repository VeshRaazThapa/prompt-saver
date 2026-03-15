import { Prompt } from '@/types';
import { IPromptRepository } from './types';
import { STORES, INDEXES } from '../schema';
import { openDB } from '../client';
import { NotFoundError } from '@/lib/errors';

export class IndexedDBPromptRepository implements IPromptRepository {
  async findById(id: string): Promise<Prompt | null> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPTS], 'readonly');
    const store = tx.objectStore(STORES.PROMPTS);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        reject(new Error('Failed to find prompt'));
      };
    });
  }

  async create(entity: Prompt): Promise<Prompt> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPTS], 'readwrite');
    const store = tx.objectStore(STORES.PROMPTS);

    return new Promise((resolve, reject) => {
      const request = store.add(entity);

      request.onsuccess = () => {
        resolve(entity);
      };

      request.onerror = () => {
        reject(new Error('Failed to create prompt'));
      };
    });
  }

  async update(id: string, updates: Partial<Prompt>): Promise<Prompt> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPTS], 'readwrite');
    const store = tx.objectStore(STORES.PROMPTS);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (existing === undefined) {
          reject(new NotFoundError('Prompt', id));
          return;
        }

        const updated = { ...existing, ...updates, id };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => {
          resolve(updated);
        };

        putRequest.onerror = () => {
          reject(new Error('Failed to update prompt'));
        };
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to find prompt'));
      };
    });
  }

  async delete(id: string): Promise<boolean> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPTS], 'readwrite');
    const store = tx.objectStore(STORES.PROMPTS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('Failed to delete prompt'));
      };
    });
  }

  async findByWorkspaceId(
    workspaceId: string,
    options: {
      limit?: number;
      offset?: number;
      favoritesOnly?: boolean;
      status?: Prompt['status'];
      sortBy?: 'created_at' | 'updated_at' | 'title';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<Prompt[]> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPTS], 'readonly');
    const store = tx.objectStore(STORES.PROMPTS);
    const index = store.index(INDEXES.PROMPTS.WORKSPACE_ID);

    return new Promise((resolve, reject) => {
      const request = index.getAll(workspaceId);

      request.onsuccess = () => {
        let results = request.result as Prompt[];

        // Apply filters
        if (options.favoritesOnly === true) {
          results = results.filter((p) => p.is_favorite);
        }

        if (options.status !== undefined) {
          results = results.filter((p) => p.status === options.status);
        }

        // Sort
        const sortBy = options.sortBy ?? 'updated_at';
        const sortOrder = options.sortOrder ?? 'desc';
        results.sort((a, b) => {
          const aValue = a[sortBy];
          const bValue = b[sortBy];

          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortOrder === 'asc'
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          }

          return 0;
        });

        // Pagination
        const offset = options.offset ?? 0;
        const limit = options.limit ?? results.length;
        results = results.slice(offset, offset + limit);

        resolve(results);
      };

      request.onerror = () => {
        reject(new Error('Failed to find prompts'));
      };
    });
  }

  async search(
    workspaceId: string,
    query: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Prompt[]> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPTS], 'readonly');
    const store = tx.objectStore(STORES.PROMPTS);
    const index = store.index(INDEXES.PROMPTS.WORKSPACE_ID);

    return new Promise((resolve, reject) => {
      const request = index.getAll(workspaceId);

      request.onsuccess = () => {
        const lowerQuery = query.toLowerCase();
        let results = (request.result as Prompt[]).filter((prompt) => {
          return (
            prompt.title.toLowerCase().includes(lowerQuery) ||
            prompt.description?.toLowerCase().includes(lowerQuery) === true ||
            prompt.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
          );
        });

        // Pagination
        const offset = options.offset ?? 0;
        const limit = options.limit ?? results.length;
        results = results.slice(offset, offset + limit);

        resolve(results);
      };

      request.onerror = () => {
        reject(new Error('Failed to search prompts'));
      };
    });
  }

  async countByWorkspaceId(workspaceId: string): Promise<number> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPTS], 'readonly');
    const store = tx.objectStore(STORES.PROMPTS);
    const index = store.index(INDEXES.PROMPTS.WORKSPACE_ID);

    return new Promise((resolve, reject) => {
      const request = index.count(workspaceId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to count prompts'));
      };
    });
  }
}
