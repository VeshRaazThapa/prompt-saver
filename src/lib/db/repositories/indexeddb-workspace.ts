import { Workspace } from '@/types';
import { IWorkspaceRepository } from './types';
import { STORES, INDEXES } from '../schema';
import { openDB } from '../client';
import { NotFoundError } from '@/lib/errors';

export class IndexedDBWorkspaceRepository implements IWorkspaceRepository {
  async findById(id: string): Promise<Workspace | null> {
    const db = await openDB();
    const tx = db.transaction([STORES.WORKSPACES], 'readonly');
    const store = tx.objectStore(STORES.WORKSPACES);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        reject(new Error('Failed to find workspace'));
      };
    });
  }

  async findByUserId(userId: string): Promise<Workspace[]> {
    const db = await openDB();
    const tx = db.transaction([STORES.WORKSPACES], 'readonly');
    const store = tx.objectStore(STORES.WORKSPACES);
    const index = store.index(INDEXES.WORKSPACES.USER_ID);

    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);

      request.onsuccess = () => {
        resolve(request.result as Workspace[]);
      };

      request.onerror = () => {
        reject(new Error('Failed to find workspaces'));
      };
    });
  }

  async create(entity: Workspace): Promise<Workspace> {
    const db = await openDB();
    const tx = db.transaction([STORES.WORKSPACES], 'readwrite');
    const store = tx.objectStore(STORES.WORKSPACES);

    return new Promise((resolve, reject) => {
      const request = store.add(entity);

      request.onsuccess = () => {
        resolve(entity);
      };

      request.onerror = () => {
        reject(new Error('Failed to create workspace'));
      };
    });
  }

  async update(id: string, updates: Partial<Workspace>): Promise<Workspace> {
    const db = await openDB();
    const tx = db.transaction([STORES.WORKSPACES], 'readwrite');
    const store = tx.objectStore(STORES.WORKSPACES);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (existing === undefined) {
          reject(new NotFoundError('Workspace', id));
          return;
        }

        const updated = { ...existing, ...updates, id };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => {
          resolve(updated);
        };

        putRequest.onerror = () => {
          reject(new Error('Failed to update workspace'));
        };
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to find workspace'));
      };
    });
  }

  async delete(id: string): Promise<boolean> {
    const db = await openDB();
    const tx = db.transaction([STORES.WORKSPACES], 'readwrite');
    const store = tx.objectStore(STORES.WORKSPACES);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('Failed to delete workspace'));
      };
    });
  }
}
