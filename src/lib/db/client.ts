import { DB_NAME, DB_VERSION, upgradeSchema } from './schema';
import { logger } from '../logging';

/**
 * IndexedDB connection manager
 * Singleton pattern to ensure only one connection per session
 */
class IndexedDBClient {
  private db: IDBDatabase | null = null;
  private connecting: Promise<IDBDatabase> | null = null;

  /**
   * Opens a connection to IndexedDB
   * @returns Promise resolving to the database instance
   */
  async connect(): Promise<IDBDatabase> {
    // Return existing connection if available
    if (this.db !== null) {
      return this.db;
    }

    // Wait for pending connection if one is in progress
    if (this.connecting !== null) {
      return this.connecting;
    }

    // Create new connection
    this.connecting = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('Failed to open IndexedDB', request.error ?? undefined);
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.connecting = null;
        logger.info('IndexedDB connection established');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;

        logger.info(`Upgrading database from version ${oldVersion} to ${DB_VERSION}`);
        upgradeSchema(db, oldVersion);
      };

      request.onblocked = () => {
        logger.warn('IndexedDB upgrade blocked by another connection');
      };
    });

    return this.connecting;
  }

  /**
   * Gets the current database connection
   * @returns The database instance or null if not connected
   */
  getConnection(): IDBDatabase | null {
    return this.db;
  }

  /**
   * Closes the database connection
   */
  close(): void {
    if (this.db !== null) {
      this.db.close();
      this.db = null;
      logger.info('IndexedDB connection closed');
    }
  }

  /**
   * Deletes the database (for testing/development)
   */
  async deleteDatabase(): Promise<void> {
    this.close();

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);

      request.onsuccess = () => {
        logger.info('Database deleted successfully');
        resolve();
      };

      request.onerror = () => {
        logger.error('Failed to delete database', request.error ?? undefined);
        reject(new Error('Failed to delete database'));
      };

      request.onblocked = () => {
        logger.warn('Database deletion blocked');
      };
    });
  }
}

// Singleton instance
const dbClient = new IndexedDBClient();

/**
 * Gets the IndexedDB client instance
 * @returns The database client
 */
export function getDBClient(): IndexedDBClient {
  return dbClient;
}

/**
 * Opens a connection to IndexedDB
 * @returns Promise resolving to the database instance
 */
export async function openDB(): Promise<IDBDatabase> {
  return dbClient.connect();
}

/**
 * Gets the current database connection
 * @returns The database instance or null if not connected
 */
export function getDB(): IDBDatabase | null {
  return dbClient.getConnection();
}

/**
 * Closes the database connection
 */
export function closeDB(): void {
  dbClient.close();
}

/**
 * Creates a transaction for the specified stores
 * @param storeNames Store names to include in transaction
 * @param mode Transaction mode
 * @returns Promise resolving to the transaction
 */
export async function createTransaction(
  storeNames: string | string[],
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBTransaction> {
  const db = await openDB();
  return db.transaction(storeNames, mode);
}
