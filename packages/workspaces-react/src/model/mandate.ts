/**
 * The mandate axis, wired to this module's wire — the single point of truth
 * for "does this person hold a mandate anywhere".
 *
 * The vocabulary and the "unresolved is not a verdict" discipline live in
 * `@stapel/core` (`mandate.ts`); this file is the only thing that knows
 * WHERE the answer comes from, and it comes from two sources that already
 * exist and needed no new endpoint:
 *
 *  - the ACTIVE session's status (`@stapel/core`), which settles anonymous
 *    and no-session without asking anyone;
 *  - `is_guest` on the workspace list, which stapel-workspaces has sent
 *    since 0.19 — the wire form of the backend's own `permissions.is_guest`
 *    predicate — and which nothing on the frontend had ever read. That is
 *    why a registered, mandate-less person was handed every module's nav
 *    entry and mounted every screen, each of which then answered 403.
 *
 * The server evaluates the predicate; this does not re-derive it. A caller
 * can hold membership ROWS that grant no mandate (every one suspended), so
 * `workspaces.length` is not the question and is consulted only when talking
 * to a backend too old to answer it.
 */
import { useMemo } from "react";
import {
  loadStateFromQuery,
  mandateAsking,
  mandateResolved,
  mandateUnavailable,
  useActiveSessionStatus,
} from "@stapel/core";
import type { MandateSource, MandateState } from "@stapel/core";
import type { WorkspaceList } from "../api/types.js";
import { useWorkspaces } from "./queries.js";

/** Guest per the server, falling back to "no memberships" only against a
 * backend that predates `is_guest` (optional on the wire). Reached only with
 * a READY response in hand — an absent list is never an empty one. */
function listSaysGuest(list: WorkspaceList): boolean {
  return list.is_guest ?? (list.workspaces ?? []).length === 0;
}

/**
 * The caller's mandate: `anonymous` / `guest` / `member`, or `unresolved`
 * with the reason it could not be obtained.
 *
 * **`unresolved` is a wait or an explained error, never a hide and never a
 * refusal.** A host renders it with `matchMandate`, whose five required arms
 * make that hard to get wrong. The tempting one-liner this replaces —
 * `data?.is_guest ?? true` — turns every backend hiccup into "you are a
 * guest", which locks members out of their own product and tells them
 * nothing; there is no expression of that shape available here, because the
 * failed and pending states carry no principal to read.
 *
 * The list read is the same `useWorkspaces()` a screen already runs, so the
 * axis costs no extra request: TanStack serves both from one query.
 */
export function useMandateState(): MandateState {
  const sessionStatus = useActiveSessionStatus();
  const query = useWorkspaces();
  const list = loadStateFromQuery(query);

  return useMemo((): MandateState => {
    // "We have not checked yet" — the session's own fourth state, and the
    // same reason `useWorkspaces` is gated: answering here would be a guess.
    if (sessionStatus === "initializing") return mandateAsking();
    // Neither carries an identity that could hold a membership, and asking
    // the server would only spend a request to be told so.
    if (sessionStatus === "anonymous" || sessionStatus === "unauthenticated") {
      return mandateResolved("anonymous");
    }
    // Authenticated — or no session-owning module registered at all, in
    // which case the server's answer about its own caller is the only
    // evidence there is, and it is a better one than a local guess.
    switch (list.status) {
      case "loading":
        return mandateAsking();
      case "failed":
        return mandateUnavailable(list.error);
      case "ready":
        return mandateResolved(listSaysGuest(list.data) ? "guest" : "member");
    }
  }, [sessionStatus, list]);
}

/**
 * This module's derivation, as core's {@link MandateSource} — what a tenant
 * app hands `<MandateProvider>`.
 *
 * The seam exists so that reading the axis and deriving it stop being the
 * same dependency: a public storefront has no workspace list to ask and must
 * not import this package to render a header, while an app that DOES have
 * one wires it here, once, at the root. Nothing about the derivation changes
 * — this is `useMandateState()` in the shape the provider takes.
 *
 * The wrapper is deliberately not memoised: `useMandateState` recomputes from
 * a query result that is a new object on every render, so a memo here would
 * buy nothing. `MandateProvider` compares the answer itself before
 * republishing, which is the guarantee that actually holds.
 *
 * ```tsx
 * function Root({ children }: { children: ReactNode }) {
 *   return <MandateProvider source={useMandateSource()}>{children}</MandateProvider>;
 * }
 * ```
 */
export function useMandateSource(): MandateSource {
  return { state: useMandateState() };
}
