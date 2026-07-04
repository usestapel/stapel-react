import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from "idb-keyval";

/**
 * Pluggable persistence backend shared by the query persist layer and the
 * analytics offline queue. Default resolution order:
 * IndexedDB (idb-keyval) → localStorage → in-memory (no-op across reloads).
 */
export interface PersistStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function idbStorage(): PersistStorage {
  return {
    get: (key) => idbGet(key),
    set: (key, value) => idbSet(key, value),
    del: (key) => idbDel(key),
    keys: async () => (await idbKeys()).map(String),
  };
}

export function localStorageAdapter(storageArea: Storage): PersistStorage {
  return {
    get: (key) => {
      const raw = storageArea.getItem(key);
      if (raw === null) return Promise.resolve(undefined);
      try {
        return Promise.resolve(JSON.parse(raw) as unknown);
      } catch {
        return Promise.resolve(undefined);
      }
    },
    set: (key, value) => {
      storageArea.setItem(key, JSON.stringify(value));
      return Promise.resolve();
    },
    del: (key) => {
      storageArea.removeItem(key);
      return Promise.resolve();
    },
    keys: () => {
      const result: string[] = [];
      for (let i = 0; i < storageArea.length; i += 1) {
        const key = storageArea.key(i);
        if (key !== null) result.push(key);
      }
      return Promise.resolve(result);
    },
  };
}

export function memoryStorage(): PersistStorage {
  const map = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(map.get(key)),
    set: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    del: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
    keys: () => Promise.resolve([...map.keys()]),
  };
}

export function defaultPersistStorage(): PersistStorage {
  if (typeof indexedDB !== "undefined") return idbStorage();
  if (typeof localStorage !== "undefined") {
    return localStorageAdapter(localStorage);
  }
  return memoryStorage();
}
