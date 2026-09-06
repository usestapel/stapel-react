/**
 * The absence of a result, made impossible to mistake for a result.
 *
 * THE INCIDENT (app.ironmemo.com, 2026-08-09). The workspace-list endpoint
 * was mounted one path segment too deep and answered 404 to every request.
 * The screen said **"you have no workspaces"** and greyed out the upload
 * button, for hours, while the network tab showed the outage the whole time.
 * Nobody was lied to by the backend: it said "404". The lie was manufactured
 * on the frontend, by one line —
 *
 *     workspaces: query.data?.workspaces ?? []
 *
 * — after which `workspaces.length === 0` was the ONLY thing a skin could
 * ask, and that question has three different true answers ("still asking",
 * "asked, none", "could not ask") collapsed into one `[]`.
 *
 * This is the fleet's most-repeated root class, not a one-off: an rsync dry
 * run whose empty output read as "nothing to delete", a media guard that
 * swallowed its own errors, gates that skipped silently. Every instance is
 * the same sentence — THE ABSENCE OF A RESULT IS INDISTINGUISHABLE FROM A
 * RESULT — and every instance was closed by hand, at the call site, until
 * this module.
 *
 * ── Why a type and not a convention ────────────────────────────────────────
 *
 * `WorkspaceListBag` already carried `isError` and `error` beside the array.
 * The distinction was AVAILABLE and the skin still flattened it, because
 * nothing forced the skin to look: `workspaces` was reachable without ever
 * mentioning `isError`, so the shortest correct-looking code was wrong code.
 * A comment asking skins to check first would have changed nothing.
 *
 * So {@link LoadState} puts the data BEHIND the discriminant. There is no
 * `.data` to read on a failed or loading state — reaching it is a type error,
 * not a code review note. And {@link matchList} goes one step further: it
 * takes FOUR arms, all required, so "empty" and "failed" cannot share a
 * branch by omission. Forgetting the failure case stops compiling.
 *
 * ── The fourth state that is not here, and why ─────────────────────────────
 *
 * TanStack has a fourth condition this deliberately folds into `loading`: a
 * DISABLED query (`enabled: false`), which sits at `status: "pending"`,
 * `fetchStatus: "idle"` forever. That is why {@link loadStateFromQuery} reads
 * `query.status` and NOT `query.isLoading` — `isLoading` is
 * `isPending && isFetching`, so it is FALSE for a disabled query, and every
 * session-ready-gated list hook in this fleet (`useWorkspaces` and friends)
 * therefore reported "not loading, no error, zero rows" for the entire
 * session bootstrap. Same lie, arriving a few hundred milliseconds earlier.
 * "We have not asked yet" is not "there is nothing"; it renders as loading.
 */

/** A load that has not produced an answer yet — including one that has not
 * been allowed to start (a disabled query; see this module's header). */
export interface LoadLoading {
  readonly status: "loading";
}

/** A load that succeeded. `data` exists ONLY here — that is the whole point. */
export interface LoadReady<T> {
  readonly status: "ready";
  readonly data: T;
  /**
   * This answer is the PREVIOUS one, and a newer read is in flight.
   *
   * Only ever set by the `keepPrevious` seam ({@link keepPreviousLoad},
   * {@link useKeptLoad}, {@link loadStateFromQuery}'s option) — and then it is
   * set on EVERY ready answer, `false` included, so a renderer's DOM does not
   * change shape between "settled" and "refreshing". Absent means the caller
   * never asked to keep anything, which is every existing call site.
   *
   * It is not a fourth state: the data is real, the screen is correct, and a
   * skin that ignores this field renders exactly what it rendered before.
   */
  readonly refreshing?: boolean;
}

/** A load that failed. Carries the thrown value for the error dialect
 * (`toFlowError` / `useErrorText` — @stapel/core errors.ts "One dialect"). */
export interface LoadFailed {
  readonly status: "failed";
  readonly error: unknown;
}

/**
 * The three states a remote read can be in, as a discriminated union.
 *
 * ```tsx
 * matchList(bag.state, {
 *   loading: () => <Spinner />,
 *   failed: (error) => <ErrorAlert error={errorShown(error)} onRetry={bag.refetch} />,
 *   empty: () => <Empty description={t("workspaces.list.empty")} />,
 *   ready: (workspaces) => <List items={workspaces} />,
 * })
 * ```
 */
export type LoadState<T> = LoadLoading | LoadReady<T> | LoadFailed;

/** A non-empty readonly array — what {@link matchList} hands its `ready` arm,
 * so `items[0]` is a value rather than `T | undefined`. */
export type NonEmptyArray<T> = readonly [T, ...T[]];

const LOADING: LoadLoading = { status: "loading" };

/** The loading state (a shared frozen singleton — it carries no data). */
export function loadLoading(): LoadLoading {
  return LOADING;
}

/**
 * A successful load.
 *
 * `refreshing` is omitted from the object entirely when it is not passed —
 * the shape a caller that never asked for {@link LoadReady.refreshing} has
 * always received, down to `toStrictEqual`.
 */
export function loadReady<T>(data: T, refreshing?: boolean): LoadReady<T> {
  return refreshing === undefined
    ? { status: "ready", data }
    : { status: "ready", data, refreshing };
}

/** A failed load, carrying the thrown value verbatim. */
export function loadFailed(error: unknown): LoadFailed {
  return { status: "failed", error };
}

export function isLoadLoading<T>(state: LoadState<T>): state is LoadLoading {
  return state.status === "loading";
}

export function isLoadReady<T>(state: LoadState<T>): state is LoadReady<T> {
  return state.status === "ready";
}

export function isLoadFailed<T>(state: LoadState<T>): state is LoadFailed {
  return state.status === "failed";
}

/**
 * The minimal structural shape {@link loadStateFromQuery} reads. TanStack's
 * `UseQueryResult` and `UseInfiniteQueryResult` both satisfy it; declaring it
 * structurally keeps this module free of a value import from
 * `@tanstack/react-query` (which is a peer dependency, and which a non-React
 * caller may not have at all).
 */
export interface QueryLike<T> {
  readonly status: "pending" | "error" | "success";
  readonly data: T | undefined;
  readonly error: unknown;
  /**
   * TanStack's own "the data in hand belongs to a DIFFERENT key" flag, set by
   * `placeholderData: keepPreviousData`. Read only under
   * {@link KeepPreviousOption.keepPrevious}; absent everywhere else, which is
   * why it is optional and why `UseQueryResult` still satisfies this shape.
   */
  readonly isPlaceholderData?: boolean;
}

/**
 * "Answer with the PREVIOUS data while the next one is in flight, rather than
 * with a skeleton."
 *
 * ── The defect (D454, storefront `/c/:slug`) ───────────────────────────────
 *
 * A boundary's three arms are three DIFFERENT elements at one position, so
 * every trip through `loading` UNMOUNTS the subtree. On a category page that
 * meant a partition press — a navigation to a SIBLING, where the page's whole
 * frame is unchanged and only its rows differ — rebuilt the filter rail, the
 * facet panel and the segmented control the person had just pressed, losing
 * its focus and its scroll position, and drew a four-row skeleton where the
 * page was, twice (out and back). The host worked around it by holding the
 * category id until both of the pair's reads had landed for it — 47 lines of
 * container code re-mounting the pair's own queries to learn what the pair
 * already knew.
 *
 * `loading` is still the honest answer when there is NOTHING to show. It is
 * the wrong answer when there is a whole correct page on the glass and the
 * only news is that a newer one is coming.
 */
export interface KeepPreviousOption {
  /**
   * `true` — a load with no answer YET answers with the last one this seam
   * saw, stamped {@link LoadReady.refreshing}. `loading` survives only for a
   * first load, where there is genuinely nothing behind the skeleton.
   *
   * A REFUSAL is never kept: `failed` passes straight through, on top of
   * however much good data there was. A dead category shown as the previous
   * live one is a dead link wearing a working page — the error arm owns its
   * own retry, and holding the old answer over a refusal is the same lie
   * this module exists to end, one state along.
   */
  readonly keepPrevious?: boolean;
}

/**
 * The merge {@link KeepPreviousOption} is made of, as a pure function: `next`,
 * or `previous` marked refreshing while `next` has nothing to show.
 *
 * `previous` is the last data this caller saw — {@link useKeptLoad} is the
 * seam that remembers it; this is the rule it applies, kept React-free so it
 * can be tested (and reused) without one.
 *
 * Ready answers come back with `refreshing` ALWAYS set once this is in play,
 * `false` included. That is deliberate: a renderer keying its DOM off the
 * field (`<LoadBoundary>` stamps `data-stapel-load-refreshing`) must not grow
 * and drop a wrapper as the flag comes and goes, because a wrapper that
 * appears is a different element at the same position — which is the remount
 * this whole seam exists to prevent.
 */
export function keepPreviousLoad<T>(
  next: LoadState<T>,
  previous: T | undefined
): LoadState<T> {
  if (next.status === "ready") return loadReady(next.data, false);
  // A refusal is the caller's to render, always. See `keepPrevious`.
  if (next.status === "failed" || previous === undefined) return next;
  return loadReady(previous, true);
}

/**
 * A TanStack query result → {@link LoadState}. The ONE sanctioned adapter;
 * `stapel/no-flattened-load-state` (@stapel/eslint-plugin) bans the
 * `query.data ?? []` shape it replaces.
 *
 * Reads `status`, deliberately, and not `isLoading`/`isError`:
 *
 * * `isLoading` is false for a query that has not been ENABLED yet — see the
 *   header. `status: "pending"` covers both "in flight" and "not started",
 *   which are the same thing to a person looking at the screen.
 * * `status: "error"` is only set while there is NO successful data. A
 *   background refetch that fails on top of good data leaves `status:
 *   "success"`, so this returns `ready` and the screen keeps showing the rows
 *   it has — correct, and the reason this does not read `isError` either.
 *
 * {@link KeepPreviousOption.keepPrevious} extends that same rule one step: a
 * query holding data that belongs to the PREVIOUS key (TanStack's
 * `placeholderData: keepPreviousData`, which reports `isPlaceholderData` and
 * may still sit at `status: "pending"`) reads as `ready` + `refreshing`
 * instead of `loading`. Without that option the behaviour is byte-for-byte
 * what it always was, placeholder data included.
 *
 * The option is for a SINGLE query that TanStack itself keeps the previous
 * answer for. A screen composed of several reads — or one whose hooks are
 * shared with surfaces that must NOT see a stale rung — keeps its own memory
 * with {@link useKeptLoad} instead.
 */
export function loadStateFromQuery<T>(
  query: QueryLike<T>,
  options?: KeepPreviousOption
): LoadState<T> {
  if (query.status === "error") return loadFailed(query.error);
  const keep = options?.keepPrevious === true;
  if (query.status === "success" && query.data !== undefined) {
    return keep ? loadReady(query.data, query.isPlaceholderData === true) : loadReady(query.data);
  }
  if (keep && query.data !== undefined) return loadReady(query.data, true);
  return loadLoading();
}

/** Transform the loaded value, leaving loading/failed untouched — and
 * carrying {@link LoadReady.refreshing} across, so a projection of a kept
 * answer is still a kept answer. */
export function mapLoad<T, U>(
  state: LoadState<T>,
  fn: (data: T) => U
): LoadState<U> {
  return state.status === "ready"
    ? loadReady(fn(state.data), state.refreshing)
    : state;
}

/**
 * Two loads that must BOTH land before a screen can answer — e.g. a query
 * plus a local repository read. Fails on the first failure (so a real error
 * is never masked by a sibling that is merely slow), otherwise loads until
 * both are ready.
 */
export function bothLoaded<A, B>(
  a: LoadState<A>,
  b: LoadState<B>
): LoadState<readonly [A, B]> {
  if (a.status === "failed") return a;
  if (b.status === "failed") return b;
  if (a.status === "ready" && b.status === "ready") {
    // Refreshing if EITHER half is: the pair is only settled once both are.
    const refreshing =
      a.refreshing === undefined && b.refreshing === undefined
        ? undefined
        : a.refreshing === true || b.refreshing === true;
    return loadReady([a.data, b.data] as const, refreshing);
  }
  return loadLoading();
}

/**
 * Exhaustive render for a {@link LoadState}. All three arms are REQUIRED —
 * that is the mechanism, not an inconvenience: a skin cannot forget the
 * failure case, because forgetting it does not compile.
 */
export function matchLoad<T, R>(
  state: LoadState<T>,
  arms: {
    loading: () => R;
    failed: (error: unknown) => R;
    ready: (data: T) => R;
  }
): R {
  switch (state.status) {
    case "loading":
      return arms.loading();
    case "failed":
      return arms.failed(state.error);
    case "ready":
      return arms.ready(state.data);
  }
}

/**
 * Exhaustive render for a LIST load — the shape the incident happened in.
 *
 * FOUR arms, all required, because a list has four things it can be and the
 * bug was two of them sharing a branch. `empty` is the one that gets to say
 * "there is nothing here"; it is reachable only from a load that actually
 * succeeded, so that sentence can only ever be true.
 *
 * `ready` receives a {@link NonEmptyArray}: if the code is in that arm, there
 * is at least one row, and `items[0]` is a value.
 */
export function matchList<T, R>(
  state: LoadState<readonly T[]>,
  arms: {
    loading: () => R;
    failed: (error: unknown) => R;
    empty: () => R;
    ready: (items: NonEmptyArray<T>) => R;
  }
): R {
  return matchLoad(state, {
    loading: arms.loading,
    failed: arms.failed,
    ready: (items) =>
      items.length === 0
        ? arms.empty()
        : arms.ready(items as unknown as NonEmptyArray<T>),
  });
}

/**
 * The rows, or `[]` — the ONE place in the fleet allowed to flatten a
 * {@link LoadState} back down, for the callers that genuinely do not
 * discriminate (a count badge, an analytics prop, a `useMemo` input).
 *
 * Named to be unpleasant to reach for, and deliberately NOT what a renderer
 * should call: if a skin uses this and then branches on `.length`, it has
 * rebuilt the defect by hand and `stapel/no-flattened-load-state` will not
 * see it. Render through {@link matchList}.
 */
export function loadedRowsOrEmpty<T>(
  state: LoadState<readonly T[]>
): readonly T[] {
  return state.status === "ready" ? state.data : [];
}
