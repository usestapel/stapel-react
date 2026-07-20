import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import type { DehydratedState, QueryKey } from "@tanstack/react-query";
import { defaultPersistStorage } from "./storage.js";
import type { PersistStorage } from "./storage.js";
import { __registerWipeWhenActive } from "./session.js";

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

// ── /me-class cache-first persister ─────────────────────────────────────────
//
// `createStapelQueryClient` above persists the WHOLE per-user query cache,
// namespaced by user id — but on a cold load we do not yet KNOW the user id
// (that is the very thing `/me` is about to tell us), so it cannot be used to
// render a last-known user/profile before the network responds. This is a
// second, narrower persister: it selectively dehydrates only the query keys
// the caller names (the "/me-class" queries — current user, current
// profile, …) into ONE fixed localStorage entry, and hydrates it back
// SYNCHRONOUSLY at construction time — before any component using those
// queries has rendered — so the very first paint already has the persisted
// data (owner directive: "the app renders the last-known user/profile
// INSTANTLY from cache, then updates when the network responds").
//
// Wiped on logout through the SAME registry `createRepository`'s
// `scope: "user"` repositories use (`__registerWipeWhenActive`, ./session.js)
// — no bespoke clear call, no separate contract to keep in sync.

function meCacheStorageGet(key: string): DehydratedState | undefined {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as DehydratedState;
  } catch {
    // Corrupt/foreign JSON under our key — treat as a cache miss, never
    // crash the caller over a persistence-layer read.
    return undefined;
  }
}

function meCacheStorageSet(key: string, state: DehydratedState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Quota exceeded / private-mode Safari — best effort, drop silently.
  }
}

function meCacheStorageDel(key: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key);
}

export interface MeCachePersisterOptions {
  readonly queryClient: QueryClient;
  /**
   * The "/me-class" query keys to persist (e.g. `authQueryKeys.me()`,
   * `profilesQueryKeys.me()`). Matched by PREFIX — a live query is persisted
   * when its key starts with one of these, mirroring the `xQueryKeys.all`
   * prefix-invalidation convention used across the `@stapel/*-react` pairs.
   */
  readonly queryKeys: readonly QueryKey[];
  /** Storage key. Default `"stapel-me-cache"`. */
  readonly storageKey?: string;
  /** Debounce for persist writes, ms. Default 100. */
  readonly throttleMs?: number;
}

export interface MeCachePersister {
  /** Write any pending state now (also useful in tests). */
  flushPersist(): void;
}

function meKeyMatches(queryKeys: readonly QueryKey[], candidate: QueryKey): boolean {
  return queryKeys.some(
    (key) =>
      key.length <= candidate.length &&
      key.every((part, i) => candidate[i] === part)
  );
}

/**
 * Selective, localStorage-backed persister for the /me-class queries only
 * (SSR-safe: every storage touch is guarded, so this is a no-op on the
 * server). See the module doc above for why this is a distinct primitive
 * from {@link createStapelQueryClient}'s per-user persistence.
 */
export function createMeCachePersister(
  options: MeCachePersisterOptions
): MeCachePersister {
  const { queryClient, queryKeys } = options;
  const storageKey = options.storageKey ?? "stapel-me-cache";
  const throttleMs = options.throttleMs ?? 100;

  // Synchronous hydrate: runs NOW, before the caller's first render, so
  // `useQuery` calls for these keys see already-populated data on mount
  // (cache-first) instead of an empty cache that fills in a tick later.
  const stored = meCacheStorageGet(storageKey);
  if (stored) hydrate(queryClient, stored);

  let timer: ReturnType<typeof setTimeout> | null = null;

  function persistNow(): void {
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) =>
        meKeyMatches(queryKeys, query.queryKey) && query.state.status === "success",
    });
    if (state.queries.length === 0) {
      meCacheStorageDel(storageKey);
      return;
    }
    meCacheStorageSet(storageKey, state);
  }

  function schedule(): void {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      persistNow();
    }, throttleMs);
  }

  queryClient.getQueryCache().subscribe((event) => {
    if (meKeyMatches(queryKeys, event.query.queryKey)) schedule();
  });

  function clear(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    meCacheStorageDel(storageKey);
  }

  // Same registry `createRepository(namespace, { scope: "user" })` uses
  // (repository.ts) — registers on whichever `SessionManager` is/becomes
  // active, fires on BOTH explicit logout() and involuntary sessionLost(),
  // no opt-out. This is what guarantees no stale /me survives a logout: the
  // NEXT cold load (even for a different user on the same device) finds
  // nothing under `storageKey` to hydrate from.
  __registerWipeWhenActive(() => clear());

  return {
    flushPersist(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      persistNow();
    },
  };
}
