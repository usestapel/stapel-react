/**
 * Storage seam for the InitialSetupPrompt canon (workspaces-org-program §B5):
 * the last-prompted-at timestamp behind `useInitialSetupGate({ mode: "daily" })`
 * and `InitialSetupPrompt`'s `skip()`.
 *
 * Persistence goes through `createRepository` (@stapel/core) — the ONE
 * sanctioned client-side store (`stapel/no-raw-storage` bans raw
 * `localStorage` everywhere else, frontend-core-architecture-v2 §43.4).
 * The canonical identity of the value is
 * `stapel.profiles.initialSetup.lastPromptAt` (spec §B5): repository
 * namespace `profiles.initialSetup`, key `lastPromptAt`; the physical
 * localStorage key is the repository's own scheme,
 * `stapel:repo:profiles.initialSetup:lastPromptAt`.
 *
 * Scope is `"app"`, deliberately: a prompt rate limit is per-BROWSER chrome,
 * not per-user data — it must not require an active `SessionManager` (a
 * `scope: "user"` repository throws without one), must not be encrypted (a
 * timestamp is not sensitive; encryption would tie it to the session key),
 * and should survive logout (logging out and back in must not instantly
 * re-prompt a "daily" host). Backend is `"local"` (localStorage per §B5),
 * degrading to in-memory outside a browser.
 */
import { createRepository } from "@stapel/core";
import type { Repository } from "@stapel/core";

/** Repository namespace — with {@link INITIAL_SETUP_LAST_PROMPT_KEY} it forms
 * the §B5 canonical key `stapel.profiles.initialSetup.lastPromptAt`. */
export const INITIAL_SETUP_REPO_NAMESPACE = "profiles.initialSetup";

/** Repository key of the last-prompted-at timestamp (epoch milliseconds). */
export const INITIAL_SETUP_LAST_PROMPT_KEY = "lastPromptAt";

let repo: Repository<number> | undefined;

function repository(): Repository<number> {
  // Lazy singleton: created on first gate/skip use, not at import time, so
  // merely importing the pair never touches storage (SSR-safe by
  // `createRepository`'s own backend fallback).
  repo ??= createRepository<number>(INITIAL_SETUP_REPO_NAMESPACE, {
    scope: "app",
    storage: "local",
  });
  return repo;
}

/** When the initial-setup prompt was last shown (or skipped), epoch ms —
 * `undefined` when it never was. */
export async function readInitialSetupLastPromptAt(): Promise<
  number | undefined
> {
  const value = await repository().get(INITIAL_SETUP_LAST_PROMPT_KEY);
  return typeof value === "number" ? value : undefined;
}

/**
 * Record that the prompt was shown (a "daily" gate stamps at show-time — "at
 * most once per 24 h" measures from when the user last SAW it) or skipped
 * (`InitialSetupPrompt.skip()` — a skip also refreshes the stamp, so a
 * "daily" gate does not re-prompt right after an explicit "maybe later").
 */
export async function recordInitialSetupPrompt(
  at: number = Date.now()
): Promise<void> {
  await repository().set(INITIAL_SETUP_LAST_PROMPT_KEY, at);
}
