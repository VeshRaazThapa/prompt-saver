import { PromptVersion, Prompt } from '@/types';
import { IPromptVersionRepository } from './types';
import { STORES, INDEXES } from '../schema';
import { openDB } from '../client';
import { NotFoundError } from '@/lib/errors';
import { now } from '@/lib/utils/datetime';

export class IndexedDBPromptVersionRepository implements IPromptVersionRepository {
  async findById(id: string): Promise<PromptVersion | null> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPT_VERSIONS], 'readonly');
    const store = tx.objectStore(STORES.PROMPT_VERSIONS);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        reject(new Error('Failed to find prompt version'));
      };
    });
  }

  async create(entity: PromptVersion): Promise<PromptVersion> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPT_VERSIONS], 'readwrite');
    const store = tx.objectStore(STORES.PROMPT_VERSIONS);

    return new Promise((resolve, reject) => {
      const request = store.add(entity);

      request.onsuccess = () => {
        resolve(entity);
      };

      request.onerror = () => {
        reject(new Error('Failed to create prompt version'));
      };
    });
  }

  async update(_id: string, _updates: Partial<PromptVersion>): Promise<PromptVersion> {
    throw new Error('Prompt versions are immutable and cannot be updated');
  }

  async delete(id: string): Promise<boolean> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPT_VERSIONS], 'readwrite');
    const store = tx.objectStore(STORES.PROMPT_VERSIONS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('Failed to delete prompt version'));
      };
    });
  }

  async findByPromptId(
    promptId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PromptVersion[]> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPT_VERSIONS], 'readonly');
    const store = tx.objectStore(STORES.PROMPT_VERSIONS);
    const index = store.index(INDEXES.PROMPT_VERSIONS.PROMPT_ID);

    return new Promise((resolve, reject) => {
      const request = index.getAll(promptId);

      request.onsuccess = () => {
        let results = request.result as PromptVersion[];

        // Sort by version number descending
        results.sort((a, b) => b.version_number - a.version_number);

        // Pagination
        const offset = options.offset ?? 0;
        const limit = options.limit ?? results.length;
        results = results.slice(offset, offset + limit);

        resolve(results);
      };

      request.onerror = () => {
        reject(new Error('Failed to find prompt versions'));
      };
    });
  }

  async findByVersion(promptId: string, versionNumber: number): Promise<PromptVersion | null> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPT_VERSIONS], 'readonly');
    const store = tx.objectStore(STORES.PROMPT_VERSIONS);
    const index = store.index(INDEXES.PROMPT_VERSIONS.PROMPT_VERSION);

    return new Promise((resolve, reject) => {
      const request = index.get([promptId, versionNumber]);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        reject(new Error('Failed to find prompt version'));
      };
    });
  }

  async getLatestVersion(promptId: string): Promise<PromptVersion | null> {
    const versions = await this.findByPromptId(promptId, { limit: 1 });
    return versions[0] ?? null;
  }

  async createVersionAtomic(version: PromptVersion, promptId: string): Promise<PromptVersion> {
    const db = await openDB();
    const tx = db.transaction([STORES.PROMPTS, STORES.PROMPT_VERSIONS], 'readwrite');
    const promptStore = tx.objectStore(STORES.PROMPTS);
    const versionStore = tx.objectStore(STORES.PROMPT_VERSIONS);

    return new Promise((resolve, reject) => {
      // Get the prompt first
      const getPromptRequest = promptStore.get(promptId);

      getPromptRequest.onsuccess = () => {
        const prompt = getPromptRequest.result as Prompt | undefined;

        if (prompt === undefined) {
          reject(new NotFoundError('Prompt', promptId));
          return;
        }

        // Add the new version
        const addVersionRequest = versionStore.add(version);

        addVersionRequest.onsuccess = () => {
          // Update the prompt to point to the new version
          const updatedPrompt = {
            ...prompt,
            current_version_id: version.id,
            updated_at: now(),
            metadata: {
              ...prompt.metadata,
              version_count: prompt.metadata.version_count + 1,
            },
          };

          const updatePromptRequest = promptStore.put(updatedPrompt);

          updatePromptRequest.onsuccess = () => {
            resolve(version);
          };

          updatePromptRequest.onerror = () => {
            reject(new Error('Failed to update prompt with new version'));
          };
        };

        addVersionRequest.onerror = () => {
          reject(new Error('Failed to create prompt version'));
        };
      };

      getPromptRequest.onerror = () => {
        reject(new Error('Failed to find prompt'));
      };
    });
  }
}
