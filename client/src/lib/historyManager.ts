import { nanoid } from 'nanoid';
import { ModelHistoryEntry, ModelStats } from './modelManager';

const DB_NAME = 'glb-model-viewer-db';
const DB_VERSION = 1;
const BLOB_STORE = 'model-blobs';
const HISTORY_STORE = 'model-history';
const MAX_HISTORY_ENTRIES = 20;

let dbInstance: IDBDatabase | null = null;

/**
 * 打开或创建数据库
 */
async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 创建 blob store
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'key' });
      }

      // 创建 history store
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const historyStore = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        // 创建索引以便按时间排序
        historyStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      }
    };
  });
}

/**
 * 保存文件 blob 到 IndexedDB
 */
async function saveBlob(file: File): Promise<string> {
  const db = await openDatabase();
  const blobKey = nanoid(16);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BLOB_STORE], 'readwrite');
    const store = transaction.objectStore(BLOB_STORE);

    const request = store.put({
      key: blobKey,
      blob: file,
      createdAt: Date.now(),
    });

    request.onerror = () => {
      reject(new Error('Failed to save blob'));
    };

    request.onsuccess = () => {
      resolve(blobKey);
    };
  });
}

/**
 * 从 IndexedDB 读取 blob
 */
async function getBlob(blobKey: string): Promise<Blob | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BLOB_STORE], 'readonly');
    const store = transaction.objectStore(BLOB_STORE);
    const request = store.get(blobKey);

    request.onerror = () => {
      reject(new Error('Failed to get blob'));
    };

    request.onsuccess = () => {
      resolve(request.result?.blob || null);
    };
  });
}

/**
 * 删除 blob
 */
async function deleteBlob(blobKey: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BLOB_STORE], 'readwrite');
    const store = transaction.objectStore(BLOB_STORE);
    const request = store.delete(blobKey);

    request.onerror = () => {
      reject(new Error('Failed to delete blob'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * 保存历史记录条目
 */
async function saveHistoryEntry(entry: ModelHistoryEntry): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.put(entry);

    request.onerror = () => {
      reject(new Error('Failed to save history entry'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * 获取所有历史记录（按最后访问时间排序）
 */
async function getAllHistoryEntries(): Promise<ModelHistoryEntry[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], 'readonly');
    const store = transaction.objectStore(HISTORY_STORE);
    const index = store.index('lastAccessedAt');
    const request = index.getAll();

    request.onerror = () => {
      reject(new Error('Failed to get history entries'));
    };

    request.onsuccess = () => {
      // 按最后访问时间倒序排列
      const entries = (request.result as ModelHistoryEntry[]).sort(
        (a, b) => b.lastAccessedAt - a.lastAccessedAt
      );
      resolve(entries);
    };
  });
}

/**
 * 获取单条历史记录
 */
async function getHistoryEntry(entryId: string): Promise<ModelHistoryEntry | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], 'readonly');
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.get(entryId);

    request.onerror = () => {
      reject(new Error('Failed to get history entry'));
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
}

/**
 * 删除历史记录条目
 */
async function deleteHistoryEntry(entryId: string): Promise<void> {
  const db = await openDatabase();
  const entry = await getHistoryEntry(entryId);

  if (entry) {
    // 删除关联的 blob
    await deleteBlob(entry.blobKey);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.delete(entryId);

    request.onerror = () => {
      reject(new Error('Failed to delete history entry'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * 清空所有历史记录
 */
async function clearAllHistory(): Promise<void> {
  const db = await openDatabase();

  // 清空 blob store
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([BLOB_STORE], 'readwrite');
    const store = transaction.objectStore(BLOB_STORE);
    const request = store.clear();

    request.onerror = () => reject(new Error('Failed to clear blobs'));
    request.onsuccess = () => resolve();
  });

  // 清空 history store
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.clear();

    request.onerror = () => reject(new Error('Failed to clear history'));
    request.onsuccess = () => resolve();
  });
}

/**
 * 更新历史条目的最后访问时间
 */
async function updateLastAccessedAt(entryId: string): Promise<void> {
  const entry = await getHistoryEntry(entryId);
  if (entry) {
    entry.lastAccessedAt = Date.now();
    await saveHistoryEntry(entry);
  }
}

/**
 * 清理过期的历史记录（保留最近 N 条）
 */
async function cleanupOldEntries(): Promise<void> {
  const entries = await getAllHistoryEntries();

  if (entries.length > MAX_HISTORY_ENTRIES) {
    const toDelete = entries.slice(MAX_HISTORY_ENTRIES);
    for (const entry of toDelete) {
      await deleteHistoryEntry(entry.id);
    }
  }
}

/**
 * 保存模型到历史记录
 */
export async function saveModelToHistory(
  file: File,
  stats: ModelStats,
  thumbDataUrl: string
): Promise<string> {
  // 保存 blob
  const blobKey = await saveBlob(file);

  // 创建历史条目
  const entryId = nanoid(16);
  const now = Date.now();
  const entry: ModelHistoryEntry = {
    id: entryId,
    name: file.name.replace(/\.[^/.]+$/, ''), // 去掉扩展名
    originalFileName: file.name,
    size: file.size,
    uploadedAt: now,
    stats: {
      meshes: stats.meshes,
      triangles: stats.triangles,
      materials: stats.materials,
      textures: stats.textures,
    },
    thumbDataUrl,
    blobKey,
    lastAccessedAt: now,
  };

  // 保存历史条目
  await saveHistoryEntry(entry);

  // 清理过期记录
  await cleanupOldEntries();

  return entryId;
}

/**
 * 从历史记录加载模型
 */
export async function loadModelFromHistory(entryId: string): Promise<File | null> {
  const entry = await getHistoryEntry(entryId);
  if (!entry) {
    return null;
  }

  // 更新最后访问时间
  await updateLastAccessedAt(entryId);

  // 获取 blob
  const blob = await getBlob(entry.blobKey);
  if (!blob) {
    return null;
  }

  // 转换为 File
  return new File([blob], entry.originalFileName, { type: blob.type });
}

/**
 * 获取历史列表
 */
export async function getHistoryList(): Promise<ModelHistoryEntry[]> {
  return getAllHistoryEntries();
}

/**
 * 删除单条历史记录
 */
export async function removeHistoryEntry(entryId: string): Promise<void> {
  return deleteHistoryEntry(entryId);
}

/**
 * 清空所有历史记录
 */
export async function clearModelHistory(): Promise<void> {
  return clearAllHistory();
}
