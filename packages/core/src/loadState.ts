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

/** A successful load. */
export function loadReady<T>(data: T): LoadReady<T> {
  return { status: "ready", data };
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
 */
export function loadStateFromQuery<T>(query: QueryLike<T>): LoadState<T> {
  if (query.status === "error") return loadFailed(query.error);
  if (query.status === "success" && query.data !== undefined) {
    return loadReady(query.data);
  }
  return loadLoading();
}

/** Transform the loaded value, leaving loading/failed untouched. */
export function mapLoad<T, U>(
  state: LoadState<T>,
  fn: (data: T) => U
): LoadState<U> {
  return state.status === "ready" ? loadReady(fn(state.data)) : state;
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
    return loadReady([a.data, b.data] as const);
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
