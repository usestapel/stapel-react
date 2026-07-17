import { useSyncExternalStore } from "react";
import { getActiveSessionManager } from "./session.js";
import type { SessionManager } from "./session.js";

/**
 * The framework-level session ready-gate (owner directive, 2026-07-17
 * incident: a query hook with no manual `enabled` condition fired before the
 * session had finished figuring out whether it was authenticated — read via
 * `session.ts`'s `"initializing"` status doc comment for the full incident).
 *
 * `false` while the session is `"initializing"` (hasn't yet restored a
 * persisted session, nor run its bootstrap probe); `true` the instant it
 * settles into `"authenticated"`, `"anonymous"`, or a confirmed
 * `"unauthenticated"` — any of the three is a real answer, only "haven't
 * checked yet" is not.
 *
 * A pair's query hook uses this INSTEAD OF hand-rolling its own readiness
 * check:
 *
 * ```tsx
 * export function useWorkspaces() {
 *   const session = useAuthSessionManager(); // however the pair gets at it
 *   const ready = useSessionReady(session);
 *   return useQuery({ queryKey: …, queryFn: …, enabled: ready });
 * }
 * ```
 *
 * Every read hook across every `@stapel/*-react` pair should gate on this
 * (or be unconditionally safe pre-session, e.g. a public GET) — a hook that
 * doesn't is the exact shape of bug this incident traced back to.
 */
export function useSessionReady(manager: SessionManager): boolean {
  return useSyncExternalStore(
    manager.subscribe,
    () => manager.isReady(),
    () => manager.isReady()
  );
}

/**
 * The zero-plumbing version of {@link useSessionReady}: reads the ACTIVE
 * session manager (`getActiveSessionManager()` — the last one any module
 * created, e.g. `@stapel/auth-react`'s `createAuthRuntime`) instead of
 * taking one as a prop. This is what lets a pair like `@stapel/workspaces-react`
 * gate its query hooks on session readiness with NO cross-pair dependency
 * and no host wiring: whichever module owns the session already registered
 * itself, and this just asks the registry.
 *
 * `true` (never blocks) when there is no active session manager at all — a
 * host that doesn't use a session-owning module (no `@stapel/auth-react`,
 * e.g. a fully public read-only app) has nothing to gate on, so every query
 * hook built on this stays enabled exactly as before this existed.
 */
export function useActiveSessionReady(): boolean {
  const manager = getActiveSessionManager();
  return useSyncExternalStore(
    manager?.subscribe ?? (() => () => {}),
    () => manager?.isReady() ?? true,
    () => manager?.isReady() ?? true
  );
}
