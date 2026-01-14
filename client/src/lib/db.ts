/**
 * 统一 IndexedDB 数据库封装
 * 处理数据库初始化、版本升级、错误恢复
 */

const DB_NAME = 'glb_viewer';
const DB_VERSION = 1;

export interface DBConfig {
  name: string;
  version: number;
  stores: {
    [storeName: string]: {
      keyPath: string;
      indexes?: Array<{
        name: string;
        keyPath: string;
        unique?: boolean;
      }>;
    };
  };
}

const DB_CONFIG: DBConfig = {
  name: DB_NAME,
  version: DB_VERSION,
  stores: {
    models: {
      keyPath: 'id',
      indexes: [
        { name: 'createdAt', keyPath: 'createdAt' },
      ],
    },
    events: {
      keyPath: 'id',
      indexes: [
        { name: 'modelId', keyPath: 'modelId' },
        { name: 'createdAt', keyPath: 'createdAt' },
      ],
    },
    measurements: {
      keyPath: 'id',
      indexes: [
        { name: 'modelId', keyPath: 'modelId' },
        { name: 'createdAt', keyPath: 'createdAt' },
      ],
    },
    states: {
      keyPath: 'modelId',
      indexes: [],
    },
  },
};

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * 打开数据库
 */
export async function openDatabase(): Promise<IDBDatabase> {
  // 如果已经有实例，直接返回
  if (dbInstance) {
    return dbInstance;
  }

  // 如果正在打开，返回现有的 Promise
  if (dbPromise) {
    return dbPromise;
  }

  // 创建新的打开操作
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

    // 处理版本升级
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('[DB] Upgrading database to version', DB_CONFIG.version);

      // 创建所有必要的 object stores
      for (const [storeName, storeConfig] of Object.entries(DB_CONFIG.stores)) {
        // 如果 store 已存在，先删除
        if (db.objectStoreNames.contains(storeName)) {
          console.log(`[DB] Dropping existing store: ${storeName}`);
          db.deleteObjectStore(storeName);
        }

        // 创建新的 store
        console.log(`[DB] Creating store: ${storeName}`);
        const store = db.createObjectStore(storeName, { keyPath: storeConfig.keyPath });

        // 创建索引
        if (storeConfig.indexes) {
          for (const index of storeConfig.indexes) {
            console.log(`[DB] Creating index: ${storeName}.${index.name}`);
            store.createIndex(index.name, index.keyPath, { unique: index.unique || false });
          }
        }
      }

      console.log('[DB] Database upgrade completed');
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[DB] Database opened successfully');
      resolve(dbInstance);
    };

    request.onerror = () => {
      const error = request.error;
      console.error('[DB] Failed to open database:', error);
      reject(error);
    };

    request.onblocked = () => {
      console.warn('[DB] Database open blocked - close other tabs');
    };
  });

  try {
    const db = await dbPromise;
    return db;
  } catch (error) {
    // 如果打开失败，尝试删除数据库并重新创建
    console.error('[DB] Error opening database, attempting recovery:', error);
    dbPromise = null;
    dbInstance = null;

    try {
      await deleteDatabase();
      console.log('[DB] Database deleted, retrying...');
      return openDatabase();
    } catch (deleteError) {
      console.error('[DB] Failed to recover database:', deleteError);
      throw error;
    }
  }
}

/**
 * 删除数据库
 */
export async function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 关闭现有连接
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }

    const request = indexedDB.deleteDatabase(DB_CONFIG.name);

    request.onsuccess = () => {
      console.log('[DB] Database deleted successfully');
      dbPromise = null;
      resolve();
    };

    request.onerror = () => {
      console.error('[DB] Failed to delete database:', request.error);
      reject(request.error);
    };
  });
}

/**
 * 关闭数据库
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
    console.log('[DB] Database closed');
  }
}

/**
 * 重置数据库（删除所有数据）
 */
export async function resetDatabase(): Promise<void> {
  const db = await openDatabase();

  for (const storeName of Object.keys(DB_CONFIG.stores)) {
    try {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const clearRequest = store.clear();

      await new Promise<void>((resolve, reject) => {
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      console.log(`[DB] Cleared store: ${storeName}`);
    } catch (error) {
      console.warn(`[DB] Failed to clear store ${storeName}:`, error);
    }
  }
}

/**
 * 获取数据库统计信息
 */
export async function getDatabaseStats(): Promise<{
  [storeName: string]: number;
}> {
  const db = await openDatabase();
  const stats: { [storeName: string]: number } = {};

  for (const storeName of Object.keys(DB_CONFIG.stores)) {
    try {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const countRequest = store.count();

      const count = await new Promise<number>((resolve, reject) => {
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => reject(countRequest.error);
      });

      stats[storeName] = count;
    } catch (error) {
      console.warn(`[DB] Failed to count store ${storeName}:`, error);
      stats[storeName] = 0;
    }
  }

  return stats;
}

/**
 * 安全的事务操作
 */
export async function transaction<T>(
  storeNames: string[],
  mode: 'readonly' | 'readwrite',
  callback: (transaction: IDBTransaction) => Promise<T>
): Promise<T> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(storeNames, mode);

    return await callback(transaction);
  } catch (error) {
    // 检查是否是 object store not found 错误
    if (error instanceof Error && error.message.includes('object store was not found')) {
      console.error('[DB] Object store not found, attempting recovery:', error);
      throw new Error('Database corrupted. Please refresh the page.');
    }
    throw error;
  }
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const db = await openDatabase();

    // 检查所有 stores 是否存在
    for (const storeName of Object.keys(DB_CONFIG.stores)) {
      if (!db.objectStoreNames.contains(storeName)) {
        console.error(`[DB] Store ${storeName} not found`);
        return false;
      }
    }

    console.log('[DB] Health check passed');
    return true;
  } catch (error) {
    console.error('[DB] Health check failed:', error);
    return false;
  }
}

// 在应用启动时进行健康检查
if (typeof window !== 'undefined') {
  window.addEventListener('load', async () => {
    try {
      const healthy = await healthCheck();
      if (!healthy) {
        console.warn('[DB] Database health check failed, attempting recovery...');
        await deleteDatabase();
        await openDatabase();
      }
    } catch (error) {
      console.error('[DB] Failed to perform health check:', error);
    }
  });
}
