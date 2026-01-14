import { nanoid } from 'nanoid';

export type EventType = 'cut_line' | 'bearing' | 'column' | 'backburn';

export interface EventRecord {
  id: string;
  modelId: string;
  type: EventType;
  title: string;
  targetKey: string;
  targetName: string;
  createdAt: number;
  updatedAt: number;
  note: string;

  fields: {
    code?: string;
    remark?: string;
    location?: string;
    height?: number;
    verticality?: number;
    area?: number;
    offset?: number;
    reason?: string;
    photo?: string;
  };

  points: Array<{ x: number; y: number; z: number }>;
  attachments: Array<{ name: string; dataUrl: string }>;
}

const DB_NAME = 'glb-model-viewer-db';
const DB_VERSION = 1;
const EVENT_STORE = 'event-records';

let dbInstance: IDBDatabase | null = null;

/**
 * 打开数据库
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

      if (!db.objectStoreNames.contains(EVENT_STORE)) {
        const store = db.createObjectStore(EVENT_STORE, { keyPath: 'id' });
        store.createIndex('modelId', 'modelId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * 创建事件记录
 */
export async function createEventRecord(
  modelId: string,
  data: Omit<EventRecord, 'id' | 'createdAt' | 'updatedAt' | 'modelId'>
): Promise<EventRecord> {
  const db = await openDatabase();
  const now = Date.now();

  const record: EventRecord = {
    id: nanoid(16),
    createdAt: now,
    updatedAt: now,
    ...data,
    modelId,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EVENT_STORE], 'readwrite');
    const store = transaction.objectStore(EVENT_STORE);
    const request = store.put(record);

    request.onerror = () => {
      reject(new Error('Failed to create event record'));
    };

    request.onsuccess = () => {
      resolve(record);
    };
  });
}

/**
 * 获取事件记录
 */
export async function getEventRecord(id: string): Promise<EventRecord | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EVENT_STORE], 'readonly');
    const store = transaction.objectStore(EVENT_STORE);
    const request = store.get(id);

    request.onerror = () => {
      reject(new Error('Failed to get event record'));
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
}

/**
 * 获取模型的所有事件记录
 */
export async function getEventsByModelId(modelId: string): Promise<EventRecord[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EVENT_STORE], 'readonly');
    const store = transaction.objectStore(EVENT_STORE);
    const index = store.index('modelId');
    const request = index.getAll(modelId);

    request.onerror = () => {
      reject(new Error('Failed to get events'));
    };

    request.onsuccess = () => {
      const records = (request.result as EventRecord[]).sort(
        (a, b) => b.createdAt - a.createdAt
      );
      resolve(records);
    };
  });
}

/**
 * 更新事件记录
 */
export async function updateEventRecord(
  id: string,
  data: Partial<Omit<EventRecord, 'id' | 'createdAt'>>
): Promise<EventRecord> {
  const existing = await getEventRecord(id);
  if (!existing) {
    throw new Error('Event record not found');
  }

  const updated: EventRecord = {
    ...existing,
    ...data,
    updatedAt: Date.now(),
  };

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EVENT_STORE], 'readwrite');
    const store = transaction.objectStore(EVENT_STORE);
    const request = store.put(updated);

    request.onerror = () => {
      reject(new Error('Failed to update event record'));
    };

    request.onsuccess = () => {
      resolve(updated);
    };
  });
}

/**
 * 删除事件记录
 */
export async function deleteEventRecord(id: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EVENT_STORE], 'readwrite');
    const store = transaction.objectStore(EVENT_STORE);
    const request = store.delete(id);

    request.onerror = () => {
      reject(new Error('Failed to delete event record'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * 按类型筛选事件
 */
export async function filterEventsByType(
  modelId: string,
  type: EventType
): Promise<EventRecord[]> {
  const events = await getEventsByModelId(modelId);
  return events.filter((e) => e.type === type);
}

/**
 * 搜索事件
 */
export async function searchEvents(
  modelId: string,
  keyword: string
): Promise<EventRecord[]> {
  const events = await getEventsByModelId(modelId);
  const lowerKeyword = keyword.toLowerCase();

  return events.filter(
    (e) =>
      e.title.toLowerCase().includes(lowerKeyword) ||
      e.note.toLowerCase().includes(lowerKeyword) ||
      e.targetName.toLowerCase().includes(lowerKeyword)
  );
}
