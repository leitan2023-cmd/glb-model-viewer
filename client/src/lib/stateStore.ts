import { nanoid } from 'nanoid';

export interface PartState {
  stage?: string;
  status?: string;
  updatedAt: number;
  metrics?: Record<string, any>;
}

export interface ModelState {
  modelId: string;
  parts: {
    [stableKey: string]: PartState;
  };
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'glb-model-viewer-db';
const DB_VERSION = 1;
const STATE_STORE = 'model-states';

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

      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE, { keyPath: 'modelId' });
      }
    };
  });
}

/**
 * 保存模型状态
 */
export async function saveModelState(state: ModelState): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STATE_STORE], 'readwrite');
    const store = transaction.objectStore(STATE_STORE);

    const request = store.put({
      ...state,
      updatedAt: Date.now(),
    });

    request.onerror = () => {
      reject(new Error('Failed to save model state'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * 获取模型状态
 */
export async function getModelState(modelId: string): Promise<ModelState | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STATE_STORE], 'readonly');
    const store = transaction.objectStore(STATE_STORE);
    const request = store.get(modelId);

    request.onerror = () => {
      reject(new Error('Failed to get model state'));
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
}

/**
 * 更新单个构件状态
 */
export async function updatePartState(
  modelId: string,
  stableKey: string,
  state: Partial<PartState>
): Promise<void> {
  const existing = await getModelState(modelId);

  const newState: ModelState = existing || {
    modelId,
    parts: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  newState.parts[stableKey] = {
    ...newState.parts[stableKey],
    ...state,
    updatedAt: Date.now(),
  };

  await saveModelState(newState);
}

/**
 * 获取构件状态
 */
export async function getPartState(
  modelId: string,
  stableKey: string
): Promise<PartState | null> {
  const state = await getModelState(modelId);
  return state?.parts[stableKey] || null;
}

/**
 * 导入状态 JSON
 */
export async function importModelState(modelId: string, json: any): Promise<void> {
  if (!json.modelId || !json.parts) {
    throw new Error('Invalid state JSON format');
  }

  // 如果 modelId 不匹配，更新为当前 modelId
  const state: ModelState = {
    modelId,
    parts: json.parts || {},
    createdAt: json.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  await saveModelState(state);
}

/**
 * 删除模型状态
 */
export async function deleteModelState(modelId: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STATE_STORE], 'readwrite');
    const store = transaction.objectStore(STATE_STORE);
    const request = store.delete(modelId);

    request.onerror = () => {
      reject(new Error('Failed to delete model state'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * 创建空的模型状态
 */
export function createEmptyModelState(modelId: string): ModelState {
  return {
    modelId,
    parts: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
