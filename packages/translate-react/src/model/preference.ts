/**
 * The viewer's chosen language — the one thing this module remembers about a
 * person.
 *
 * Persistence goes through `@stapel/core`'s `createRepository`, the one
 * sanctioned client-side store (`stapel/no-raw-storage` refuses anything
 * else). Which SCOPE it uses is decided per call rather than once at
 * construction, because the answer changes while the page is open:
 *
 *  - signed in (an active `SessionManager`) → `scope: "user"`, wiped on logout
 *    with no opt-out. A shared computer must not greet the next person in the
 *    previous one's language.
 *  - a visitor → `scope: "app"` in `localStorage`, which survives a reload and
 *    is not encrypted. A language choice is not a secret, and a visitor has no
 *    session key to encrypt it with.
 *
 * Reads try the user scope first and fall back to the visitor one, so a
 * language chosen before signing in is still in effect after.
 */
import { createRepository, getActiveSessionManager } from "@stapel/core";
import type { Repository } from "@stapel/core";

const NAMESPACE = "translate";
const KEY = "language";

export interface LanguagePreferenceStore {
  /** The stored code, or `undefined` when nothing has been chosen. */
  read(): Promise<string | undefined>;
  write(code: string): Promise<void>;
}

let userRepo: Repository<string> | null = null;
let visitorRepo: Repository<string> | null = null;

/** Built lazily: a `scope: "user"` repository registers a logout wipe hook the
 * moment it is constructed, and a host that never signs anyone in should not
 * acquire one just by importing this module. */
function userScope(): Repository<string> {
  userRepo ??= createRepository<string>(NAMESPACE, { scope: "user" });
  return userRepo;
}

function visitorScope(): Repository<string> {
  visitorRepo ??= createRepository<string>(NAMESPACE, {
    scope: "app",
    storage: "local",
  });
  return visitorRepo;
}

const signedIn = (): boolean => getActiveSessionManager() !== null;

/**
 * The default store. A host with its own preference service (a server-side
 * profile field — `stapel-profiles` has one) passes its own implementation to
 * `createTranslateRuntime` instead: the seam is the interface, not this
 * function.
 */
export function createLanguagePreferenceStore(): LanguagePreferenceStore {
  return {
    async read() {
      if (signedIn()) {
        // A rotated/absent session key reads as a cache miss inside the
        // repository, never a throw — so this falls through to the visitor
        // value rather than losing the preference.
        const mine = await userScope().get(KEY);
        if (mine !== undefined) return mine;
      }
      return visitorScope().get(KEY);
    },
    async write(code) {
      if (signedIn()) {
        await userScope().set(KEY, code);
        return;
      }
      await visitorScope().set(KEY, code);
    },
  };
}

/** @internal Test seam — drops the memoized repositories between cases. */
export function __resetLanguagePreferenceStores(): void {
  userRepo = null;
  visitorRepo = null;
}
