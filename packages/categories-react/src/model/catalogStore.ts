/**
 * Where the catalogue lives between page loads.
 *
 * `createRepository` is the ONE sanctioned client-side persistence primitive
 * (`@stapel/core` `repository.ts`; direct `localStorage` outside it is a lint
 * error, `stapel/no-raw-storage`), and the spec's verdict (§4.3) puts the tree
 * in it with `scope: "app"`.
 *
 * **`scope: "app"` is a correctness choice, not a size one.** A user-scoped
 * repository is encrypted with the per-session key and wiped on logout, with
 * no opt-out — both of which are wrong here twice over: the category tree is
 * a deployment's PUBLIC content, identical for every visitor and for a visitor
 * with no session at all, and wiping it at logout would re-download the whole
 * catalogue for somebody who just signed out of a storefront they are still
 * browsing. App scope also means `createRepository` never asks for a
 * `SessionManager`, so the store works on a page with no auth wired at all.
 *
 * A repository read can fail or return junk (a private window, cleared site
 * data, a snapshot written by an older shape). Every read here degrades to
 * "no snapshot" — a cold sync costs one request; a cache that throws costs
 * the page.
 */
import { createRepository } from "@stapel/core";
import type { Repository } from "@stapel/core";
import { EMPTY_SNAPSHOT, parseSnapshot } from "../catalog/sync.js";
import type { CategorySnapshot } from "../catalog/sync.js";

/** The repository namespace. Changing it orphans every stored snapshot, which
 * is the intended migration for a shape change too large for `version`. */
export const CATALOG_NAMESPACE = "categories.catalog";

/** The single key inside that namespace. */
export const CATALOG_KEY = "snapshot";

/** Read / write the catalogue snapshot, with every failure mode absorbed. */
export interface CatalogStore {
  load(): Promise<CategorySnapshot>;
  save(snapshot: CategorySnapshot): Promise<void>;
  clear(): Promise<void>;
}

export interface CreateCatalogStoreOptions {
  /** Inject a repository (tests, SSR, a host with its own backend). Default:
   * an app-scoped repository under {@link CATALOG_NAMESPACE}. */
  readonly repository?: Repository<unknown>;
  /**
   * Called when no storage backend could be created and the catalogue will
   * run UNPERSISTED — a full re-download on every page load. Default: one
   * `console.warn` (see {@link UNPERSISTED_WARNING}). Pass `() => undefined`
   * to accept the degradation deliberately and silence it.
   */
  readonly onUnpersisted?: (error: unknown) => void;
}

/**
 * What the default `onUnpersisted` prints. A silent fallback to an in-memory
 * store is the §83 shape: the page still works, so nobody reports it, and the
 * whole catalogue is fetched again on every navigation forever. Naming it in
 * the console is the minimum — the person who can fix it is the one looking
 * at that console.
 */
export const UNPERSISTED_WARNING: string =
  "[@stapel/categories-react] No storage backend: the category catalogue will " +
  "be re-downloaded on every page load. Pass `repository` to " +
  "createCatalogStore, or `onUnpersisted` to accept this deliberately.";

/** A store that remembers nothing — the honest fallback when persistence is
 * unavailable, and what a caller passes to opt out of caching entirely. */
export function memoryCatalogStore(): CatalogStore {
  let held: CategorySnapshot = EMPTY_SNAPSHOT;
  return {
    load: () => Promise.resolve(held),
    save: (snapshot) => {
      held = snapshot;
      return Promise.resolve();
    },
    clear: () => {
      held = EMPTY_SNAPSHOT;
      return Promise.resolve();
    },
  };
}

export function createCatalogStore(
  options: CreateCatalogStoreOptions = {}
): CatalogStore {
  let repository: Repository<unknown>;
  try {
    repository =
      options.repository ??
      createRepository<unknown>(CATALOG_NAMESPACE, { scope: "app" });
  } catch (error) {
    // No storage backend at all (an exotic runtime, a locked-down origin).
    // Degrading is right; degrading QUIETLY is not — say so once.
    (options.onUnpersisted ??
      ((cause: unknown) => {
        console.warn(UNPERSISTED_WARNING, cause);
      }))(error);
    return memoryCatalogStore();
  }

  return {
    async load() {
      try {
        return parseSnapshot(await repository.get(CATALOG_KEY)) ?? EMPTY_SNAPSHOT;
      } catch {
        return EMPTY_SNAPSHOT;
      }
    },
    async save(snapshot) {
      try {
        await repository.set(CATALOG_KEY, snapshot);
      } catch {
        // A full quota or a blocked origin must not fail the render that
        // triggered the sync: the catalogue is already in memory and correct.
      }
    },
    async clear() {
      try {
        await repository.del(CATALOG_KEY);
      } catch {
        /* nothing to undo */
      }
    },
  };
}
