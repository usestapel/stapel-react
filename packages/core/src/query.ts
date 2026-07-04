import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";
import { defaultPersistStorage } from "./storage.js";
import type { PersistStorage } from "./storage.js";

export type { PersistStorage } from "./storage.js";

interface PersistedRecord {
  readonly version: string;
  readonly state: DehydratedState;
}

export interface StapelQueryClientOptions {
  /** Storage key prefix. Default `"stapel-query"`. */
  readonly cacheKeyPrefix?: string;
  /**
   * Cache buster: persisted state written under a different version is
   * discarded on restore. Convention: the consuming package's version.
   */
  readonly cacheVersion?: string;
  /** Override the storage backend (tests, custom stores). */
  readonly storage?: PersistStorage;
  /** Bring your own QueryClient (defaults applied only when absent). */
  readonly queryClient?: QueryClient;
  /** Debounce for persist writes, ms. Default 100. */
  readonly throttleMs?: number;
}

export interface StapelQueryRuntime {
  readonly queryClient: QueryClient;
  /**
   * Switch the persistence namespace to a user (per-user cache scope,
   * frontend-standard §4.6). Restores that user's persisted state, then
   * mirrors cache changes back to storage. Pass `null` to stop persisting
   * (anonymous / logged out).
   */
  setPersistUser(userId: string | null): Promise<void>;
  /** Write any pending state now (also useful in tests). */
  flushPersist(): Promise<void>;
  /**
   * Remove ALL persisted Stapel query state (every user namespace) and
   * clear the in-memory cache. Call on logout and for GDPR erasure.
   */
  purgePersistedCache(): Promise<void>;
}

/**
 * TanStack Query v5 client wrapped with Stapel persistence: per-user
 * namespaces in IndexedDB (localStorage fallback), version-busted restore,
 * and a GDPR-grade purge.
 */
export function createStapelQueryClient(
  options: StapelQueryClientOptions = {}
): StapelQueryRuntime {
  const prefix = options.cacheKeyPrefix ?? "stapel-query";
  const version = options.cacheVersion ?? "0";
  const storage = options.storage ?? defaultPersistStorage();
  const throttleMs = options.throttleMs ?? 100;

  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          gcTime: 24 * 60 * 60 * 1000,
          retry: (failureCount, error) => {
            // Do not retry envelope errors the app must handle (4xx).
            const status = (error as { status?: number }).status;
            if (status !== undefined && status >= 400 && status < 500) {
              return false;
            }
            return failureCount < 2;
          },
        },
      },
    });

  let currentKey: string | null = null;
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const keyFor = (userId: string): string => `${prefix}:${userId}`;

  async function persistNow(): Promise<void> {
    if (currentKey === null) return;
    const record: PersistedRecord = {
      version,
      state: dehydrate(queryClient),
    };
    await storage.set(currentKey, record);
  }

  function schedulePersist(): void {
    if (currentKey === null || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      void persistNow();
    }, throttleMs);
  }

  function stopPersisting(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    currentKey = null;
  }

  async function setPersistUser(userId: string | null): Promise<void> {
    if (currentKey !== null) await persistNow();
    stopPersisting();
    if (userId === null) return;

    currentKey = keyFor(userId);
    const stored = (await storage.get(currentKey)) as
      | PersistedRecord
      | undefined;
    if (stored && stored.version === version) {
      hydrate(queryClient, stored.state);
    } else if (stored) {
      await storage.del(currentKey);
    }
    unsubscribe = queryClient.getQueryCache().subscribe(schedulePersist);
  }

  async function flushPersist(): Promise<void> {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    await persistNow();
  }

  async function purgePersistedCache(): Promise<void> {
    stopPersisting();
    const allKeys = await storage.keys();
    await Promise.all(
      allKeys
        .filter((key) => key.startsWith(`${prefix}:`))
        .map((key) => storage.del(key))
    );
    queryClient.clear();
  }

  return { queryClient, setPersistUser, flushPersist, purgePersistedCache };
}
