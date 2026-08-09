import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Context, ReactElement, ReactNode } from "react";
import { createRepository } from "@stapel/core";
import type { Repository } from "@stapel/core";
import type { Workspace } from "../api/types.js";
import { useWorkspaces } from "./queries.js";
import { useSetPreferredWorkspace } from "./mutations.js";

/**
 * Which workspace am I in — the resolution the whole fleet was inventing
 * separately, in one place.
 *
 * There are three places an answer can come from, and the design IS the order
 * between them:
 *
 * 1. **the URL** — highest. This is what makes several browser tabs each work
 *    in a different workspace, and it only works because it is highest: a
 *    tab's identity must never be stolen by another tab writing shared
 *    storage.
 * 2. **local storage** — the returning-user default on this device.
 * 3. **the backend preference** (`preferred_workspace_id`, stapel-workspaces
 *    0.20) — follows the person across devices and browsers.
 *
 * then the instance's `default_workspace_id`, then the personal workspace,
 * then, and only then, the first row.
 *
 * `workspaces[0]` was the rule every client invented, and it is #239: the
 * owner's pending invitations sat in the org workspace while his screen showed
 * his personal one, because the list is ordered by `-last_accessed_at` and the
 * first row is therefore "wherever you happened to be last", not a choice. It
 * survives here only as step 6 — reached by someone with no URL, no local
 * history, no recorded choice, no instance default and no personal workspace —
 * because for the single-workspace majority it is trivially right, and
 * refusing to pick would punish them with a chooser screen listing one option.
 */

/** Where {@link WorkspaceSelection.current} came from — the step of the chain
 * that answered. Exposed because "why am I here" is otherwise unanswerable
 * from the outside, and every previous version of this bug was invisible. */
export type WorkspaceSelectionSource =
  | "url"
  | "local"
  | "preference"
  | "instance-default"
  | "personal"
  | "positional";

/**
 * How a host binds the URL layer. Both halves are optional: omitted, the
 * library runs on the remaining layers and multi-tab independence is simply
 * not available — it is not an error, it is a host that has not wired it.
 *
 * Controlled props rather than the library reading `window.location` itself,
 * and rather than an injected `{read, write}` adapter, for one mechanical
 * reason: SPA routers navigate through `history.pushState`, which emits no
 * observable event. A library reading `location` could not RE-RENDER when the
 * URL changed, and a `read()` adapter has the same defect in disguise (a
 * correct one would need `subscribe`, re-implementing what the host router's
 * own re-render already gives us for free). Writing `history` directly would
 * also desynchronise the host router's location state.
 */
export interface WorkspaceSelectionUrlBinding {
  /**
   * The workspace id the host read out of the URL — `?workspace=<uuid>` by
   * convention. `null`/`undefined` means the URL names none.
   *
   * A query parameter, not a path segment, deliberately: a path parameter
   * would force a `/w/:workspaceId/*` prefix into every host's route table,
   * which is this pair dictating routing structure — the exact thing the seam
   * exists to avoid.
   */
  readonly urlWorkspaceId?: string | null;
  /**
   * The URL should now name `workspaceId`. The host navigates; this pair
   * never touches history itself.
   *
   * `reason: "switch"` is an explicit picker action and wants a history
   * PUSH — back should return the person to the workspace they came from.
   * `reason: "invalid-url"` is the correction after a URL named a workspace
   * the person cannot open, and wants a REPLACE — a URL that does not work
   * must not stay reachable with the back button.
   */
  readonly onUrlWorkspaceChange?: (
    workspaceId: string,
    meta: { reason: "switch" | "invalid-url"; history: "push" | "replace" }
  ) => void;
}

/** What {@link useWorkspaceSelection} hands back. */
export interface WorkspaceSelection {
  /** The caller's workspaces (empty before load, and for a guest). */
  readonly workspaces: readonly Workspace[];
  /**
   * The resolved workspace — `null` while loading, and for a person who
   * belongs to none.
   *
   * Downstream fetching must gate on THIS, never on a raw id: an id that has
   * not been checked against the fetched list is exactly how a client ends up
   * briefly rendering with a workspace the person cannot open.
   */
  readonly current: Workspace | null;
  /** Which step of the chain answered, or `null` before one has. */
  readonly source: WorkspaceSelectionSource | null;
  /**
   * The URL named a workspace that is not in the caller's list — it does not
   * exist, or they are not a member, or their membership is suspended (the
   * backend deliberately does not say which). Drive a visible notice off
   * this. The person has already been landed somewhere sane.
   */
  readonly urlWorkspaceInvalid: boolean;
  /** The workspace list is still loading. */
  readonly loading: boolean;
  /**
   * An EXPLICIT choice by the person — the only entry point that persists.
   * Writes the URL (push), local storage, and the backend preference.
   * Returns immediately; the backend write is fire-and-forget.
   */
  switchTo: (workspaceId: string) => void;
  /** Refetch the workspace list. */
  refetch: () => Promise<void>;
}

const SelectionContext: Context<WorkspaceSelection | null> =
  createContext<WorkspaceSelection | null>(null);

/** The repository namespace and key holding the local-storage layer. */
const REPO_NAMESPACE = "workspaces";
const REPO_KEY = "selected";

/**
 * `scope: "user"` is deliberate on both counts it implies. It is encrypted at
 * rest like the rest of the session's data, and — the part that matters — it
 * is wiped at logout, so the next account signed in on a shared machine
 * cannot inherit the previous account's workspace pointer.
 */
function defaultRepository(): Repository<string> {
  return createRepository<string>(REPO_NAMESPACE, { scope: "user" });
}

/** Props for {@link WorkspaceSelectionProvider}. */
export interface WorkspaceSelectionProviderProps
  extends WorkspaceSelectionUrlBinding {
  readonly children: ReactNode;
  /**
   * Override the local-storage layer. Injected for tests and for a host with
   * its own persistence policy; the default is core's `createRepository`
   * (`scope: "user"`). Pass `null` to run with NO local layer at all.
   */
  readonly repository?: Repository<string> | null;
}

/**
 * Resolves and holds the active workspace. Wrap the part of the app that
 * needs one; read it with {@link useWorkspaceSelection}.
 *
 * ```tsx
 * // react-router 7 host — the pair never imports the router
 * const [params, setParams] = useSearchParams();
 * <WorkspaceSelectionProvider
 *   urlWorkspaceId={params.get("workspace")}
 *   onUrlWorkspaceChange={(id, { history }) =>
 *     setParams((prev) => {
 *       const next = new URLSearchParams(prev);
 *       next.set("workspace", id);
 *       return next;
 *     }, { replace: history === "replace" })}
 * >
 *   <App />
 * </WorkspaceSelectionProvider>
 * ```
 */
export function WorkspaceSelectionProvider(
  props: WorkspaceSelectionProviderProps
): ReactElement {
  const { urlWorkspaceId, onUrlWorkspaceChange, children } = props;
  const query = useWorkspaces();
  // Same rule as `query.refetch` below: TanStack's mutation result is a new
  // object every render, so the stable `mutate` handle is what `switchTo`
  // closes over — depending on the result object would restore the very
  // instability the memoisation exists to remove.
  const savePreferred = useSetPreferredWorkspace().mutate;

  // Built once. `createRepository` registers a logout wipe hook, so calling it
  // per render would register one per render.
  const repoRef = useRef<Repository<string> | null | undefined>(undefined);
  if (repoRef.current === undefined) {
    repoRef.current =
      props.repository === undefined ? defaultRepository() : props.repository;
  }
  const repo = repoRef.current;

  const [localId, setLocalId] = useState<string | null>(null);
  const [localRead, setLocalRead] = useState(!repo);
  const [chosenId, setChosenId] = useState<string | null>(null);

  // The local layer is read EXACTLY ONCE, at mount, and never subscribed to.
  //
  // That is the multi-tab requirement, stated as code. The obvious "improvement"
  // is a `storage` event listener to keep tabs in sync — and it is precisely
  // what breaks the feature: `storage` fires in the OTHER tabs on every write,
  // so switching in tab A would drag tab B onto A's workspace, which is the
  // behaviour the URL layer exists to prevent. There is no listener here, and
  // there must never be one.
  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    void repo
      .get(REPO_KEY)
      .then((value) => {
        if (cancelled) return;
        if (typeof value === "string") setLocalId(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLocalRead(true);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const workspaces = useMemo(
    () => query.data?.workspaces ?? [],
    [query.data]
  );
  const loading = query.isLoading || !localRead;

  const memberOf = useCallback(
    (id: string | null | undefined): Workspace | null =>
      id ? (workspaces.find((w) => w.id === id) ?? null) : null,
    [workspaces]
  );

  // The chain. Runs against the FETCHED list only — never against an
  // unresolved one, or a raw stored id would be briefly authoritative and the
  // app would fetch a workspace it has not verified the person can open.
  const resolved = useMemo<{
    workspace: Workspace | null;
    source: WorkspaceSelectionSource | null;
  }>(() => {
    if (loading || workspaces.length === 0) {
      return { workspace: null, source: null };
    }
    const explicit = memberOf(chosenId);
    if (explicit) return { workspace: explicit, source: "url" };
    const fromUrl = memberOf(urlWorkspaceId);
    if (fromUrl) return { workspace: fromUrl, source: "url" };
    const fromLocal = memberOf(localId);
    if (fromLocal) return { workspace: fromLocal, source: "local" };
    const fromPreference = memberOf(query.data?.preferred_workspace_id);
    if (fromPreference)
      return { workspace: fromPreference, source: "preference" };
    const fromInstance = memberOf(query.data?.default_workspace_id);
    if (fromInstance)
      return { workspace: fromInstance, source: "instance-default" };
    const personal = workspaces.find((w) => w.type === "personal");
    if (personal) return { workspace: personal, source: "personal" };
    // Last resort only — see this module's header for why it is last and why
    // it is still here.
    return { workspace: workspaces[0] ?? null, source: "positional" };
  }, [loading, workspaces, memberOf, chosenId, urlWorkspaceId, localId, query.data]);

  // The URL named something the person cannot open. Deliberately NOT an
  // error state that blanks the screen, and deliberately NOT a silent
  // substitution: they clicked a link expecting workspace X, and quietly
  // showing workspace Y's data is the same misattribution class as #239.
  // They land through the rest of the chain, and this flag drives the notice.
  const urlWorkspaceInvalid =
    !loading &&
    workspaces.length > 0 &&
    chosenId === null &&
    !!urlWorkspaceId &&
    memberOf(urlWorkspaceId) === null;

  // Correct the address bar once, with a REPLACE so the broken URL does not
  // stay reachable with the back button.
  const correctedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!urlWorkspaceInvalid || !resolved.workspace) return;
    if (correctedFor.current === urlWorkspaceId) return;
    correctedFor.current = urlWorkspaceId ?? null;
    onUrlWorkspaceChange?.(resolved.workspace.id, {
      reason: "invalid-url",
      history: "replace",
    });
  }, [urlWorkspaceInvalid, resolved.workspace, urlWorkspaceId, onUrlWorkspaceChange]);

  // A stale local pointer is DELETED rather than rewritten to the fallback.
  // Writing the fallback would ossify a guess into something that outranks a
  // later-corrected backend preference or instance default; deleting it just
  // stops the next boot retrying a dead id.
  useEffect(() => {
    if (loading || !repo || localId === null) return;
    if (memberOf(localId)) return;
    setLocalId(null);
    void repo.del(REPO_KEY).catch(() => undefined);
  }, [loading, repo, localId, memberOf]);

  /**
   * The only path that persists anything, and that is the whole write policy:
   * a URL is per-tab CONTEXT, a picker click is a CHOICE.
   *
   * If resolving from a shared link wrote the preference, one link pasted into
   * a chat would permanently repoint its recipient's home — so a URL-driven
   * resolution writes nothing at all, on either layer. A person who is in a
   * URL-driven workspace and then picks it in the switcher is making a choice,
   * and that goes through here.
   */
  const switchTo = useCallback(
    (workspaceId: string) => {
      if (!workspaces.some((w) => w.id === workspaceId)) return;
      setChosenId(workspaceId);
      if (repo) void repo.set(REPO_KEY, workspaceId).catch(() => undefined);
      // Fire-and-forget: the tab has already switched. A switch that blocks on
      // a flaky network is worse than a preference that lags one click.
      savePreferred({ workspace_id: workspaceId });
      onUrlWorkspaceChange?.(workspaceId, {
        reason: "switch",
        history: "push",
      });
    },
    [workspaces, repo, savePreferred, onUrlWorkspaceChange]
  );

  // `query.refetch`, NOT `query`: TanStack returns a NEW result object on every
  // render, so depending on the whole query would make this callback — and
  // therefore the memoised bag below — change identity every render, which is
  // exactly the #251 render-loop this memoisation exists to prevent. The
  // `refetch` handle itself is stable.
  const refetchQuery = query.refetch;
  const refetch = useCallback(async () => {
    await refetchQuery();
  }, [refetchQuery]);

  // Memoised, and that is load-bearing rather than a performance nicety
  // (ironmemo #251): consumers put `current` straight into `useEffect`
  // dependency arrays to refetch when the workspace changes. A fresh object
  // literal here would be a new value on every render of this provider, so
  // every such effect would re-run on every render — and when the effect also
  // sets state, that is an unbounded render loop whose only symptom is a
  // spinner that never resolves, with nothing in the console.
  const value = useMemo<WorkspaceSelection>(
    () => ({
      workspaces,
      current: resolved.workspace,
      source: resolved.source,
      urlWorkspaceInvalid,
      loading,
      switchTo,
      refetch,
    }),
    [
      workspaces,
      resolved.workspace,
      resolved.source,
      urlWorkspaceInvalid,
      loading,
      switchTo,
      refetch,
    ]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

/**
 * The resolved active workspace. Throws outside
 * {@link WorkspaceSelectionProvider} — a silent `null` here would be read as
 * "no workspace yet" and produce exactly the blank screen this pair exists to
 * prevent.
 */
export function useWorkspaceSelection(): WorkspaceSelection {
  const value = useContext(SelectionContext);
  if (!value) {
    throw new Error(
      "useWorkspaceSelection must be used inside <WorkspaceSelectionProvider>"
    );
  }
  return value;
}
