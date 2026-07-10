/**
 * `createRepository` — the ONE sanctioned client-side persistence primitive
 * (frontend-core-architecture-v2 §43.4). Direct `localStorage` / `indexedDB`
 * access outside this file is a lint error (`stapel/no-raw-storage`) — that is
 * what makes the rest of this file's guarantees mechanically enforceable
 * rather than a convention someone can forget.
 *
 * `scope: "user"` repositories:
 *  - auto-register a wipe-at-logout hook on the active `SessionManager` — NO
 *    opt-out. Put data in, it is torn down on `logout()` / `sessionLost()`.
 *  - are `encrypted` by default (WebCrypto AES-GCM, §43.5). Honest boundary
 *    (state it, do not oversell it): this defends data AT REST — a shared
 *    computer, residual bytes on disk, casual/forensic access after the tab
 *    is gone. It does NOT defend against XSS with code execution in the live
 *    page — a script running in your origin can just call `repo.get()` like
 *    any other code. Encryption-at-rest and script-injection defense are
 *    different problems; this primitive only solves the first.
 *
 * `scope: "app"` repositories (theme, locale, …) survive logout by design and
 * are never encrypted with the per-session key — that key is dropped on
 * logout, which would make "survives logout" and "encrypted with the session
 * key" contradictory.
 */
import {
  defaultPersistStorage,
  idbStorage,
  localStorageAdapter,
  memoryStorage,
} from "./storage.js";
import type { PersistStorage } from "./storage.js";
import {
  getActiveSessionManager,
  __registerWipeWhenActive,
} from "./session.js";
import type { SessionManager } from "./session.js";

export interface RepositoryOptions {
  /** Preferred backend; falls back gracefully like `defaultPersistStorage()`. */
  readonly storage?: "local" | "indexeddb";
  /**
   * `"user"` — wiped on logout/session-loss, no opt-out, encrypted by
   * default. `"app"` — survives logout (theme, locale, …), never encrypted
   * with the per-session key.
   */
  readonly scope: "user" | "app";
  /**
   * Default: `true` for `scope: "user"`, always `false` for `scope: "app"`
   * (the per-session key is dropped on logout — encrypting app-scope data
   * with it would silently break the "survives logout" guarantee, so the
   * scope wins over an explicit `true` here).
   */
  readonly encrypted?: boolean;
  /**
   * Escape hatch for tests / multi-manager hosts (SSR, multi-tenant): which
   * `SessionManager` to wire the wipe hook and encryption key to. Default:
   * the active manager (`getActiveSessionManager()`).
   */
  readonly sessionManager?: SessionManager;
}

export interface Repository<T = unknown> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  /** Keys in THIS namespace only (prefix stripped). */
  keys(): Promise<string[]>;
  /** Delete every key in this namespace. Called automatically on logout for `scope: "user"`. */
  clear(): Promise<void>;
}

interface EncryptedBlob {
  readonly __stapelEncrypted: true;
  readonly iv: number[];
  readonly data: number[];
}

function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __stapelEncrypted?: unknown }).__stapelEncrypted === true
  );
}

async function encryptValue(key: CryptoKey, value: unknown): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    __stapelEncrypted: true,
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(cipher)),
  };
}

async function decryptValue(key: CryptoKey, blob: EncryptedBlob): Promise<unknown> {
  const iv = new Uint8Array(blob.iv);
  const data = new Uint8Array(blob.data);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plainBuf)) as unknown;
}

function backendFor(storage: RepositoryOptions["storage"]): PersistStorage {
  if (storage === "local") {
    return typeof localStorage !== "undefined"
      ? localStorageAdapter(localStorage)
      : memoryStorage();
  }
  if (storage === "indexeddb") {
    if (typeof indexedDB !== "undefined") return idbStorage();
    if (typeof localStorage !== "undefined") return localStorageAdapter(localStorage);
    return memoryStorage();
  }
  return defaultPersistStorage();
}

/**
 * Create a namespaced, optionally-encrypted client-side repository — the one
 * sanctioned way to persist app/user data in the browser (§43.4).
 */
export function createRepository<T = unknown>(
  namespace: string,
  options: RepositoryOptions
): Repository<T> {
  const backend = backendFor(options.storage);
  const prefix = `stapel:repo:${namespace}:`;
  const storageKey = (key: string): string => `${prefix}${key}`;

  const scope = options.scope;
  // scope "app" survives logout by design — encrypting it with the per-session
  // key (dropped on logout) would contradict that, so it always wins over an
  // explicit `encrypted: true`.
  const encrypted = scope === "user" ? (options.encrypted ?? true) : false;

  function resolveManager(): SessionManager {
    const manager = options.sessionManager ?? getActiveSessionManager();
    if (!manager) {
      throw new Error(
        `createRepository("${namespace}", { scope: "user" }) needs an active SessionManager — ` +
          "call createSessionManager() (directly, or via createAuthRuntime()) before reading or " +
          "writing user-scoped repositories, or pass one explicitly as `sessionManager`."
      );
    }
    return manager;
  }

  async function sessionKey(): Promise<CryptoKey> {
    return resolveManager().getSessionKey();
  }

  async function clear(): Promise<void> {
    const all = await backend.keys();
    await Promise.all(
      all.filter((k) => k.startsWith(prefix)).map((k) => backend.del(k))
    );
  }

  if (scope === "user") {
    // No opt-out (§43.4): every user-scoped repository is torn down on
    // logout/session-loss, mechanically, regardless of whether the caller
    // remembered to wire anything.
    __registerWipeWhenActive(() => clear());
  }

  return {
    async get(key) {
      const raw = await backend.get(storageKey(key));
      if (raw === undefined) return undefined;
      if (!encrypted) return raw as T;
      if (!isEncryptedBlob(raw)) return undefined;
      try {
        const cryptoKey = await sessionKey();
        return (await decryptValue(cryptoKey, raw)) as T;
      } catch {
        // Wrong/rotated/dropped key (a new session, or logout raced a
        // straggling write) — treat as a cache miss, never crash the caller.
        return undefined;
      }
    },
    async set(key, value) {
      if (!encrypted) {
        await backend.set(storageKey(key), value);
        return;
      }
      const cryptoKey = await sessionKey();
      const blob = await encryptValue(cryptoKey, value);
      await backend.set(storageKey(key), blob);
    },
    async del(key) {
      await backend.del(storageKey(key));
    },
    async keys() {
      const all = await backend.keys();
      return all.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
    },
    clear,
  };
}
