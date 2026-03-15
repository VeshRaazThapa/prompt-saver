import { LLMProvider } from '@/types';
import { ILLMProviderRepository } from './types';
import { STORES, INDEXES } from '../schema';
import { openDB } from '../client';
import { NotFoundError } from '@/lib/errors';

export class IndexedDBLLMProviderRepository implements ILLMProviderRepository {
  async findById(id: string): Promise<LLMProvider | null> {
    const db = await openDB();
    const tx = db.transaction([STORES.LLM_PROVIDERS], 'readonly');
    const store = tx.objectStore(STORES.LLM_PROVIDERS);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        reject(new Error('Failed to find LLM provider'));
      };
    });
  }

  async create(entity: LLMProvider): Promise<LLMProvider> {
    const db = await openDB();
    const tx = db.transaction([STORES.LLM_PROVIDERS], 'readwrite');
    const store = tx.objectStore(STORES.LLM_PROVIDERS);

    return new Promise((resolve, reject) => {
      const request = store.add(entity);

      request.onsuccess = () => {
        resolve(entity);
      };

      request.onerror = () => {
        reject(new Error('Failed to create LLM provider'));
      };
    });
  }

  async update(id: string, updates: Partial<LLMProvider>): Promise<LLMProvider> {
    const db = await openDB();
    const tx = db.transaction([STORES.LLM_PROVIDERS], 'readwrite');
    const store = tx.objectStore(STORES.LLM_PROVIDERS);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (existing === undefined) {
          reject(new NotFoundError('LLMProvider', id));
          return;
        }

        const updated = { ...existing, ...updates, id };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => {
          resolve(updated);
        };

        putRequest.onerror = () => {
          reject(new Error('Failed to update LLM provider'));
        };
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to find LLM provider'));
      };
    });
  }

  async delete(id: string): Promise<boolean> {
    const db = await openDB();
    const tx = db.transaction([STORES.LLM_PROVIDERS], 'readwrite');
    const store = tx.objectStore(STORES.LLM_PROVIDERS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('Failed to delete LLM provider'));
      };
    });
  }

  async findByWorkspaceId(workspaceId: string): Promise<LLMProvider[]> {
    const db = await openDB();
    const tx = db.transaction([STORES.LLM_PROVIDERS], 'readonly');
    const store = tx.objectStore(STORES.LLM_PROVIDERS);
    const index = store.index(INDEXES.LLM_PROVIDERS.WORKSPACE_ID);

    return new Promise((resolve, reject) => {
      const request = index.getAll(workspaceId);

      request.onsuccess = () => {
        resolve(request.result as LLMProvider[]);
      };

      request.onerror = () => {
        reject(new Error('Failed to find LLM providers'));
      };
    });
  }

  async findByName(
    workspaceId: string,
    providerName: LLMProvider['provider_name']
  ): Promise<LLMProvider | null> {
    const db = await openDB();
    const tx = db.transaction([STORES.LLM_PROVIDERS], 'readonly');
    const store = tx.objectStore(STORES.LLM_PROVIDERS);
    const index = store.index(INDEXES.LLM_PROVIDERS.WORKSPACE_PROVIDER);

    return new Promise((resolve, reject) => {
      const request = index.get([workspaceId, providerName]);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        reject(new Error('Failed to find LLM provider'));
      };
    });
  }

  async findActiveProviders(workspaceId: string): Promise<LLMProvider[]> {
    const providers = await this.findByWorkspaceId(workspaceId);
    return providers.filter((provider) => provider.status === 'active');
  }
}
