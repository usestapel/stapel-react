/**
 * `useRecents` — the codes a person picked most recently, per scope.
 *
 * ## Why this lives in `@stapel/core` and not in a skin
 *
 * Recency is PRODUCT LOGIC, not paint. "The four makes you last chose, on top
 * of the list" is the same rule whether the list is drawn as a bottom sheet
 * (`@stapel/tokens-antd/skin`'s `SkinPickerSheet`), as a row of chips, as a
 * typeahead in a vocabulary term control, or — next — as a saved-filter row in
 * search. A rule that three unrelated pairs need cannot live in one of them,
 * and it cannot live in the antd bridge either: a pair with no antd (or a host
 * on another design system) needs recents exactly as much as an antd one does,
 * and would otherwise re-derive the MRU list, the cap and the storage key by
 * hand. So the state is here, headless, and the skins render it.
 *
 * ## Persistence goes through core's storage layer, never through a global
 *
 * Direct `localStorage` / `indexedDB` access is legal in exactly three files
 * in this repo (`stapel/no-raw-storage`), and this is not one of them. The
 * hook persists through {@link PersistStorage} — the same
 * IndexedDB → localStorage → memory ladder the query layer and the analytics
 * queue use — so a deployment that swaps the backend swaps this too, and an
 * environment with no storage at all (a server render, a locked-down browser,
 * private mode with IndexedDB refused) degrades to an in-memory list instead
 * of throwing inside a render.
 *
 * Recents are deliberately NOT a `createRepository` scope: they hold no
 * personal data (a code from a public catalogue vocabulary), they must survive
 * a sign-out the way a browser's own form history does, and paying WebCrypto
 * per keystroke for "you picked Toyota last time" would be theatre.
 *
 * ## What the hook guarantees
 *
 *  - **MRU, deduped.** `touch(code)` moves a code to the front; it never
 *    appears twice, and the list is capped at `max` (default
 *    {@link RECENTS_DEFAULT_MAX}).
 *  - **Survives a reload.** The list is written on every `touch` and read back
 *    on mount, under a key derived from the scope.
 *  - **Never throws.** Every storage call is guarded, on both the synchronous
 *    and the promise side; a corrupt or foreign value under the key reads as
 *    "no recents" rather than as a crash inside a picker.
 *  - **SSR-safe.** Nothing is read at module load or during render: the first
 *    server render — and the first client render, which must match it — is an
 *    empty list, and the stored one arrives in an effect.
 *  - **Shared between mounted hooks.** Two controls on the same scope (a
 *    field and the sheet it opened) see one list: a `touch` in either updates
 *    the other in the same tick, without a round trip through storage.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { defaultPersistStorage, memoryStorage } from "./storage.js";
import type { PersistStorage } from "./storage.js";

/** How many codes a scope remembers when the caller does not say. */
export const RECENTS_DEFAULT_MAX: number = 8;

/** The prefix every scope's storage key carries. */
export const RECENTS_KEY_PREFIX: string = "stapel.recents.";

/**
 * Where a scope's list is stored. Exported so a host can wipe one (a
 * "clear my history" setting) through the same storage backend it configured.
 */
export function recentsStorageKey(scope: string): string {
  return `${RECENTS_KEY_PREFIX}${scope}`;
}

export interface UseRecentsOptions {
  /** How many codes to keep. Default {@link RECENTS_DEFAULT_MAX}. */
  readonly max?: number;
  /**
   * The backend to persist through. Defaults to
   * {@link defaultPersistStorage} (IndexedDB → localStorage → memory), shared
   * by every scope in the process.
   *
   * A host passes its own to move recents somewhere else; a test passes
   * {@link memoryStorage} to write and re-read a scope deterministically. It
   * is read once per scope-mount, so hand the SAME instance across the mounts
   * that are meant to see each other's writes.
   */
  readonly storage?: PersistStorage;
}

export interface RecentsBag {
  /** Most recent first, deduped, at most `max` long. */
  readonly recents: readonly string[];
  /** Record a pick. Blank codes are ignored — a picker that commits nothing
   * has nothing to remember. */
  readonly touch: (code: string) => void;
}

const EMPTY: readonly string[] = [];

/** One default backend per process: a second `defaultPersistStorage()` would
 * open a second IndexedDB handle for the same data. */
let sharedDefault: PersistStorage | undefined;

function resolveStorage(provided: PersistStorage | undefined): PersistStorage {
  if (provided !== undefined) return provided;
  if (sharedDefault === undefined) {
    try {
      sharedDefault = defaultPersistStorage();
    } catch {
      // A browser that refuses storage entirely (private mode, an enterprise
      // policy) throws on the feature test itself. Recents are a convenience;
      // losing them across a reload is the correct degradation, a thrown
      // exception inside a picker's first render is not.
      sharedDefault = memoryStorage();
    }
  }
  return sharedDefault;
}

/** Whatever came back from storage → a clean, capped, deduped list. */
function normalizeCodes(value: unknown, max: number): readonly string[] {
  if (!Array.isArray(value)) return EMPTY;
  const out: string[] = [];
  for (const entry of value as readonly unknown[]) {
    if (typeof entry !== "string") continue;
    const code = entry.trim();
    if (code.length === 0 || out.includes(code)) continue;
    out.push(code);
    if (out.length >= max) break;
  }
  return out;
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((code, index) => code === b[index]);
}

/** The MRU move: `code` to the front, everything else in order, capped. */
function moveToFront(list: readonly string[], code: string, max: number): readonly string[] {
  return [code, ...list.filter((entry) => entry !== code)].slice(0, max);
}

/**
 * Live hooks per scope, so a `touch` in one control reaches the other
 * controls on the same scope without waiting for (or trusting) a storage
 * round trip.
 */
const subscribers = new Map<string, Set<(list: readonly string[]) => void>>();

function subscribe(scope: string, handler: (list: readonly string[]) => void): () => void {
  let set = subscribers.get(scope);
  if (set === undefined) {
    set = new Set();
    subscribers.set(scope, set);
  }
  set.add(handler);
  return () => {
    set.delete(handler);
    if (set.size === 0) subscribers.delete(scope);
  };
}

/**
 * Hand a scope's new list to every hook mounted on it. The hook that caused
 * the change is included and costs nothing: it has already written its own
 * ref, so its handler sees the same order and returns without a re-render.
 */
function publish(scope: string, list: readonly string[]): void {
  const set = subscribers.get(scope);
  if (set === undefined) return;
  for (const handler of [...set]) handler(list);
}

/**
 * The codes most recently chosen in `scope`, most recent first.
 *
 * `scope` is the caller's own namespace for one list — a vocabulary slug plus
 * its level (`"car-makes:model"`), a facet id, a category's attribute. Two
 * controls that should share a memory share a scope; two that should not, do
 * not.
 *
 * ```tsx
 * const { recents, touch } = useRecents(`${vocabulary}:${level}`, { max: 5 });
 * // …render `recents` as the sheet's first group, and on a pick:
 * touch(option.value);
 * ```
 */
export function useRecents(scope: string, options: UseRecentsOptions = {}): RecentsBag {
  const max = Math.max(1, Math.floor(options.max ?? RECENTS_DEFAULT_MAX));
  const provided = options.storage;
  const [recents, setRecents] = useState<readonly string[]>(EMPTY);
  // The authoritative list. `touch` must compose on the value it just wrote
  // even when two picks land in one tick, and React state is not readable
  // that soon.
  const list = useRef<readonly string[]>(EMPTY);
  const storage = useRef<PersistStorage>(resolveStorage(provided));

  useEffect(() => {
    const handler = (incoming: readonly string[]): void => {
      const capped = incoming.slice(0, max);
      if (sameOrder(capped, list.current)) return;
      list.current = capped;
      setRecents(capped);
    };
    return subscribe(scope, handler);
  }, [scope, max]);

  useEffect(() => {
    // A new scope is a different memory: show nothing rather than the
    // previous scope's list while the read is in flight.
    list.current = EMPTY;
    setRecents(EMPTY);
    const store = resolveStorage(provided);
    storage.current = store;
    let cancelled = false;
    const read = async (): Promise<void> => {
      const raw = await store.get(recentsStorageKey(scope));
      if (cancelled) return;
      const stored = normalizeCodes(raw, max);
      if (stored.length === 0) return;
      // A pick that landed before the read did stays in front of it: the
      // person's last action outranks what the disk remembers.
      const merged = normalizeCodes([...list.current, ...stored], max);
      list.current = merged;
      setRecents(merged);
    };
    try {
      void read().catch(() => undefined);
    } catch {
      // A backend that throws synchronously from `get` (a closed IndexedDB
      // handle) is a lost list, never a broken render.
    }
    return () => {
      cancelled = true;
    };
  }, [scope, max, provided]);

  const touch = useCallback(
    (code: string): void => {
      const trimmed = code.trim();
      if (trimmed.length === 0) return;
      const next = moveToFront(list.current, trimmed, max);
      if (!sameOrder(next, list.current)) {
        list.current = next;
        setRecents(next);
      }
      publish(scope, next);
      try {
        void storage.current.set(recentsStorageKey(scope), [...next]).catch(() => undefined);
      } catch {
        // Same contract as the read: a full quota or a refused backend costs
        // the memory, not the pick.
      }
    },
    [scope, max]
  );

  return { recents, touch };
}
