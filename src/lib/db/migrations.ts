import { DB_VERSION } from './schema';
import { logger } from '../logging';

/**
 * Database migration utilities
 * Handles schema migrations and data transformations
 */

export interface Migration {
  version: number;
  description: string;
  up: (db: IDBDatabase) => Promise<void>;
  down: (db: IDBDatabase) => Promise<void>;
}

/**
 * Migration registry
 * Add new migrations here as the schema evolves
 */
const migrations: Migration[] = [
  // Example migration for future use:
  // {
  //   version: 2,
  //   description: 'Add user preferences table',
  //   up: async (db) => {
  //     const store = db.createObjectStore('user_preferences', { keyPath: 'user_id' });
  //     store.createIndex('user_id', 'user_id', { unique: true });
  //   },
  //   down: async (db) => {
  //     db.deleteObjectStore('user_preferences');
  //   },
  // },
];

/**
 * Runs all pending migrations
 * @param db The database instance
 * @param oldVersion The current database version
 * @returns Promise that resolves when migrations complete
 */
export async function runMigrations(db: IDBDatabase, oldVersion: number): Promise<void> {
  logger.info(`Running migrations from version ${oldVersion} to ${DB_VERSION}`);

  const pendingMigrations = migrations.filter(
    (m) => m.version > oldVersion && m.version <= DB_VERSION
  );

  for (const migration of pendingMigrations) {
    logger.info(`Applying migration ${migration.version}: ${migration.description}`);
    try {
      await migration.up(db);
      logger.info(`Migration ${migration.version} completed successfully`);
    } catch (error) {
      logger.error(`Migration ${migration.version} failed`, error as Error);
      throw error;
    }
  }
}

/**
 * Checks if a migration is needed
 * @param currentVersion The current database version
 * @returns True if migrations are pending
 */
export function hasPendingMigrations(currentVersion: number): boolean {
  return migrations.some((m) => m.version > currentVersion && m.version <= DB_VERSION);
}

/**
 * Gets the list of pending migrations
 * @param currentVersion The current database version
 * @returns Array of pending migrations
 */
export function getPendingMigrations(currentVersion: number): Migration[] {
  return migrations.filter((m) => m.version > currentVersion && m.version <= DB_VERSION);
}

/**
 * Exports all data from the database for backup
 * @returns Promise resolving to serialized database data
 */
export async function exportDatabase(): Promise<Record<string, unknown[]>> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('prompt-saver');

    request.onsuccess = async () => {
      const db = request.result;
      const storeNames = Array.from(db.objectStoreNames);
      const data: Record<string, unknown[]> = {};

      try {
        for (const storeName of storeNames) {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const getAllRequest = store.getAll();

          const storeData = await new Promise<unknown[]>((res, rej) => {
            getAllRequest.onsuccess = () => res(getAllRequest.result);
            getAllRequest.onerror = () => rej(getAllRequest.error);
          });

          data[storeName] = storeData;
        }

        db.close();
        resolve(data);
      } catch (error) {
        db.close();
        reject(error);
      }
    };

    request.onerror = () => {
      reject(new Error('Failed to open database for export'));
    };
  });
}

/**
 * Imports data into the database from a backup
 * @param data The data to import
 * @returns Promise that resolves when import completes
 */
export async function importDatabase(data: Record<string, unknown[]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('prompt-saver');

    request.onsuccess = async () => {
      const db = request.result;

      try {
        for (const [storeName, records] of Object.entries(data)) {
          if (!db.objectStoreNames.contains(storeName)) {
            logger.warn(`Skipping unknown store: ${storeName}`);
            continue;
          }

          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);

          for (const record of records) {
            await new Promise<void>((res, rej) => {
              const addRequest = store.put(record);
              addRequest.onsuccess = () => res();
              addRequest.onerror = () => rej(addRequest.error);
            });
          }
        }

        db.close();
        logger.info('Database import completed successfully');
        resolve();
      } catch (error) {
        db.close();
        logger.error('Database import failed', error as Error);
        reject(error);
      }
    };

    request.onerror = () => {
      reject(new Error('Failed to open database for import'));
    };
  });
}
