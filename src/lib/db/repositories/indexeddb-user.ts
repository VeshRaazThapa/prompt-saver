import { User } from '@/types';
import { IUserRepository } from './types';
import { STORES, INDEXES } from '../schema';
import { openDB } from '../client';
import { NotFoundError } from '@/lib/errors';

export class IndexedDBUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const db = await openDB();
    const tx = db.transaction([STORES.USERS], 'readonly');
    const store = tx.objectStore(STORES.USERS);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        reject(new Error('Failed to find user'));
      };
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const db = await openDB();
    const tx = db.transaction([STORES.USERS], 'readonly');
    const store = tx.objectStore(STORES.USERS);
    const index = store.index(INDEXES.USERS.EMAIL);

    return new Promise((resolve, reject) => {
      const request = index.get(email);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        reject(new Error('Failed to find user by email'));
      };
    });
  }

  async create(entity: User): Promise<User> {
    const db = await openDB();
    const tx = db.transaction([STORES.USERS], 'readwrite');
    const store = tx.objectStore(STORES.USERS);

    return new Promise((resolve, reject) => {
      const request = store.add(entity);

      request.onsuccess = () => {
        resolve(entity);
      };

      request.onerror = () => {
        reject(new Error('Failed to create user'));
      };
    });
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    const db = await openDB();
    const tx = db.transaction([STORES.USERS], 'readwrite');
    const store = tx.objectStore(STORES.USERS);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (existing === undefined) {
          reject(new NotFoundError('User', id));
          return;
        }

        const updated = { ...existing, ...updates, id };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => {
          resolve(updated);
        };

        putRequest.onerror = () => {
          reject(new Error('Failed to update user'));
        };
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to find user'));
      };
    });
  }

  async delete(id: string): Promise<boolean> {
    const db = await openDB();
    const tx = db.transaction([STORES.USERS], 'readwrite');
    const store = tx.objectStore(STORES.USERS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('Failed to delete user'));
      };
    });
  }
}
