/**
 * The server-state layer: one hook per read, one per write, no UI decisions.
 *
 * ── Paging ────────────────────────────────────────────────────────────────
 *
 * Every list this module serves is a BARE ARRAY ordered `-created_at`, paged
 * by a `before` cursor. There is no envelope, no count, no `next` link — so
 * `getNextPageParam` reads the page itself through `nextBefore`
 * (`api/extensions.ts`, which explains why the response header cannot be).
 *
 * ── Invalidation ──────────────────────────────────────────────────────────
 *
 * A verdict does four things at once: it decides one case, removes it from
 * whichever queue page a colleague is looking at, may issue a sanction, and
 * moves the counters. So the console writes invalidate the `case(id)` key AND
 * the `cases` / `sanctions` / `stats` prefixes — never just the key they wrote
 * through, which is how a resolved case stays in an open-cases table.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  QueryClient,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  loadFailed,
  loadLoading,
  loadReady,
  loadStateFromQuery,
  useActiveSessionReady,
} from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import { nextBefore } from "../api/extensions.js";
import type {
  AppealQueueFilters,
  CaseFilters,
  IssueSanctionBody,
  ResolveAppealBody,
  SanctionFilters,
  SubmitAppealBody,
  SubmitReportBody,
  VerdictBody,
} from "../api/moderationApi.js";
import type {
  Appeal,
  Case,
  CaseDetail,
  CaseEvent,
  PolicyDisclosure,
  Report,
  ReportResult,
  RescanResult,
  Sanction,
  Stats,
  Verdict,
} from "../api/types.js";
import { useModerationApi } from "./context.js";
import { filtersKey, moderationQueryKeys } from "./queryKeys.js";

/** The page size every list in this pair asks for. The backend clamps to its
 * own `MAX_PAGE_SIZE`, so this is a request, not a promise. */
export const PAGE_SIZE = 25;

/** What every paged read hands a skin: the rows so far, plus the two facts a
 * "load more" control needs to describe itself. */
export interface PagedRows<T> {
  readonly rows: LoadState<readonly T[]>;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly loadMore: () => void;
  readonly refetch: () => void;
  readonly error: unknown;
}

/** The part of an infinite query {@link pagedRows} reads — spelled
 * structurally so the fold does not depend on TanStack's result generics. */
interface InfiniteLike<T> {
  readonly data: { readonly pages: readonly (readonly T[])[] } | undefined;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
}

/** Fold an infinite query into {@link PagedRows}. Kept here rather than in the
 * skin so the four paged surfaces cannot each invent their own "is there
 * more" rule. */
function pagedRows<T>(query: InfiniteLike<T>): PagedRows<T> {
  // Order matters: pages already fetched stay READY while a later page fails,
  // because a list that had rows and then failed to grow is not an empty list.
  const flat: LoadState<readonly T[]> =
    query.data !== undefined
      ? loadReady(query.data.pages.flat() as readonly T[])
      : query.isError
        ? loadFailed(query.error)
        : loadLoading();
  return {
    rows: flat,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => {
      void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
    error: query.error,
  };
}

// ── reads ───────────────────────────────────────────────────────────────────

/**
 * The public policy disclosure.
 *
 * `AllowAny` on the backend, and the ONE read this pair makes without a
 * session — a visitor who clicks "report" is shown the rules and the sign-in
 * door together, rather than a locked box.
 */
export function usePolicy(targetType = ""): UseQueryResult<
  PolicyDisclosure,
  StapelApiError
> {
  const api = useModerationApi();
  return useQuery<PolicyDisclosure, StapelApiError>({
    queryKey: moderationQueryKeys.policy(targetType),
    queryFn: ({ signal }) =>
      api.policy(targetType !== "" ? { targetType } : {}, { signal }),
    // The registry only changes when a deployment reconfigures itself.
    staleTime: 5 * 60_000,
  });
}

/** The complaints this account filed. */
export function useMyReportsQuery(): PagedRows<Report> {
  const api = useModerationApi();
  const sessionReady = useActiveSessionReady();
  const query = useInfiniteQuery<readonly Report[], StapelApiError>({
    queryKey: moderationQueryKeys.myReports,
    queryFn: ({ pageParam, signal }) =>
      api.myReports(
        { limit: PAGE_SIZE, ...(typeof pageParam === "string" ? { before: pageParam } : {}) },
        { signal }
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => nextBefore(last, PAGE_SIZE),
    enabled: sessionReady,
  });
  return pagedRows(query);
}

/** The appeals this account filed. */
export function useMyAppealsQuery(): PagedRows<Appeal> {
  const api = useModerationApi();
  const sessionReady = useActiveSessionReady();
  const query = useInfiniteQuery<readonly Appeal[], StapelApiError>({
    queryKey: moderationQueryKeys.myAppeals,
    queryFn: ({ pageParam, signal }) =>
      api.myAppeals(
        { limit: PAGE_SIZE, ...(typeof pageParam === "string" ? { before: pageParam } : {}) },
        { signal }
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => nextBefore(last, PAGE_SIZE),
    enabled: sessionReady,
  });
  return pagedRows(query);
}

/** One keyset page of the cross-target queue. */
export function useCasesQuery(filters: CaseFilters): PagedRows<Case> {
  const api = useModerationApi();
  const sessionReady = useActiveSessionReady();
  const key = filtersKey({
    state: filters.state,
    target_type: filters.targetType,
    reason_code: filters.reasonCode,
    scope_key: filters.scopeKey,
    severity_min: filters.severityMin,
    subject_user_id: filters.subjectUserId,
  });
  const query = useInfiniteQuery<readonly Case[], StapelApiError>({
    queryKey: moderationQueryKeys.casePage(key),
    queryFn: ({ pageParam, signal }) =>
      api.cases(
        {
          ...filters,
          limit: PAGE_SIZE,
          ...(typeof pageParam === "string" ? { before: pageParam } : {}),
        },
        { signal }
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => nextBefore(last, PAGE_SIZE),
    enabled: sessionReady,
  });
  return pagedRows(query);
}

/** One case card. */
export function useCaseDetailQuery(
  caseId: string | undefined
): UseQueryResult<CaseDetail, StapelApiError> {
  const api = useModerationApi();
  const sessionReady = useActiveSessionReady();
  return useQuery<CaseDetail, StapelApiError>({
    queryKey: moderationQueryKeys.case(caseId ?? ""),
    queryFn: ({ signal }) => api.caseDetail(caseId as string, { signal }),
    enabled: sessionReady && caseId !== undefined && caseId !== "",
  });
}

/** The case's audit trail — unbounded, so it is only fetched when asked for. */
export function useCaseEventsQuery(
  caseId: string | undefined,
  enabled: boolean
): UseQueryResult<readonly CaseEvent[], StapelApiError> {
  const api = useModerationApi();
  return useQuery<readonly CaseEvent[], StapelApiError>({
    queryKey: moderationQueryKeys.caseEvents(caseId ?? ""),
    queryFn: ({ signal }) => api.caseEvents(caseId as string, { signal }),
    enabled: enabled && caseId !== undefined && caseId !== "",
  });
}

/** Queue counters for the console header. */
export function useStatsQuery(): UseQueryResult<Stats, StapelApiError> {
  const api = useModerationApi();
  const sessionReady = useActiveSessionReady();
  return useQuery<Stats, StapelApiError>({
    queryKey: moderationQueryKeys.stats,
    queryFn: ({ signal }) => api.stats({ signal }),
    enabled: sessionReady,
  });
}

/**
 * Sanctions, filtered.
 *
 * ── The one list this pair cannot page ────────────────────────────────────
 *
 * `SanctionPresenterDTO` does not carry `created_at` — it has `starts_at`,
 * `expires_at`, `lifted_at`, and none of them is the column the backend's
 * keyset cursor is built on (`views._page_cursor` reads `row.created_at` off
 * the MODEL). So there is no value on the wire this client can send back as
 * `before`, and the response header that carries it is not reachable through
 * core's client (`api/extensions.ts`). One page, and the pane says so, rather
 * than a "load more" that would re-fetch the same rows for ever. Filed as an
 * ask on the backend: expose `created_at` on the sanction presenter.
 */
export function useSanctionsQuery(filters: SanctionFilters): PagedRows<Sanction> {
  const api = useModerationApi();
  const sessionReady = useActiveSessionReady();
  const key = filtersKey({
    subject_user_id: filters.subjectUserId,
    state: filters.state,
  });
  const query = useQuery<readonly Sanction[], StapelApiError>({
    queryKey: moderationQueryKeys.sanctionPage(key),
    queryFn: ({ signal }) =>
      api.sanctions({ ...filters, limit: PAGE_SIZE }, { signal }),
    enabled: sessionReady,
  });
  return {
    rows: loadStateFromQuery(query),
    hasMore: false,
    loadingMore: false,
    loadMore: () => {},
    refetch: () => {
      void query.refetch();
    },
    error: query.error,
  };
}

/** The appeal queue. */
export function useAppealQueueQuery(
  filters: AppealQueueFilters
): PagedRows<Appeal> {
  const api = useModerationApi();
  const sessionReady = useActiveSessionReady();
  const key = filtersKey({ state: filters.state });
  const query = useInfiniteQuery<readonly Appeal[], StapelApiError>({
    queryKey: moderationQueryKeys.appealQueuePage(key),
    queryFn: ({ pageParam, signal }) =>
      api.appealQueue(
        {
          ...filters,
          limit: PAGE_SIZE,
          ...(typeof pageParam === "string" ? { before: pageParam } : {}),
        },
        { signal }
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => nextBefore(last, PAGE_SIZE),
    enabled: sessionReady,
  });
  return pagedRows(query);
}

/** `LoadState` for a plain query — the shape every skin arm reads. */
export function loadOf<T>(
  query: UseQueryResult<T, StapelApiError>
): LoadState<T> {
  return loadStateFromQuery(query);
}

// ── writes ──────────────────────────────────────────────────────────────────

/** Everything a console write touches, in one place (see the file header). */
function invalidateConsole(client: QueryClient, caseId?: string): void {
  if (caseId !== undefined) {
    void client.invalidateQueries({ queryKey: moderationQueryKeys.case(caseId) });
    void client.invalidateQueries({
      queryKey: moderationQueryKeys.caseEvents(caseId),
    });
  }
  void client.invalidateQueries({ queryKey: moderationQueryKeys.cases });
  void client.invalidateQueries({ queryKey: moderationQueryKeys.stats });
  void client.invalidateQueries({ queryKey: moderationQueryKeys.sanctions });
  void client.invalidateQueries({ queryKey: moderationQueryKeys.appealQueue });
}

/** File a complaint. */
export function useSubmitReport(): UseMutationResult<
  ReportResult,
  StapelApiError,
  SubmitReportBody
> {
  const api = useModerationApi();
  const client = useQueryClient();
  return useMutation<ReportResult, StapelApiError, SubmitReportBody>({
    mutationFn: (body) => api.submitReport(body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: moderationQueryKeys.myReports });
    },
  });
}

/** Appeal a decision. */
export function useSubmitAppeal(): UseMutationResult<
  Appeal,
  StapelApiError,
  SubmitAppealBody
> {
  const api = useModerationApi();
  const client = useQueryClient();
  return useMutation<Appeal, StapelApiError, SubmitAppealBody>({
    mutationFn: (body) => api.submitAppeal(body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: moderationQueryKeys.myAppeals });
    },
  });
}

/** Take, extend or hand back a lease. `claim` twice IS the extend. */
export function useClaimCase(): UseMutationResult<Case, StapelApiError, string> {
  const api = useModerationApi();
  const client = useQueryClient();
  return useMutation<Case, StapelApiError, string>({
    mutationFn: (caseId) => api.claim(caseId),
    onSuccess: (_data, caseId) => invalidateConsole(client, caseId),
  });
}

export function useReleaseCase(): UseMutationResult<Case, StapelApiError, string> {
  const api = useModerationApi();
  const client = useQueryClient();
  return useMutation<Case, StapelApiError, string>({
    mutationFn: (caseId) => api.release(caseId),
    onSuccess: (_data, caseId) => invalidateConsole(client, caseId),
  });
}

export function useRescanCase(): UseMutationResult<
  RescanResult,
  StapelApiError,
  string
> {
  const api = useModerationApi();
  const client = useQueryClient();
  return useMutation<RescanResult, StapelApiError, string>({
    mutationFn: (caseId) => api.rescan(caseId),
    onSuccess: (_data, caseId) => invalidateConsole(client, caseId),
  });
}

/** Variables for {@link useSubmitVerdict}. */
export interface VerdictVariables extends VerdictBody {
  readonly caseId: string;
}

export function useSubmitVerdict(): UseMutationResult<
  Verdict,
  StapelApiError,
  VerdictVariables
> {
  const api = useModerationApi();
  const client = useQueryClient();
  return useMutation<Verdict, StapelApiError, VerdictVariables>({
    mutationFn: ({ caseId, ...body }) => api.verdict(caseId, body),
    onSuccess: (_data, variables) => invalidateConsole(client, variables.caseId),
  });
}

export function useIssueSanction(): UseMutationResult<
  Sanction,
  StapelApiError,
  IssueSanctionBody
> {
  const api = useModerationApi();
  const client = useQueryClient();
  return useMutation<Sanction, StapelApiError, IssueSanctionBody>({
    mutationFn: (body) => api.issueSanction(body),
    onSuccess: (_data, body) => invalidateConsole(client, body.caseId),
  });
}

/** Variables for {@link useLiftSanction}. */
export interface LiftSanctionVariables {
  readonly sanctionId: string;
  readonly note?: string;
}

export function useLiftSanction(): UseMutationResult<
  Sanction,
  StapelApiError,
  LiftSanctionVariables
> {
  const api = useModerationApi();
  const client = useQueryClient();
  return useMutation<Sanction, StapelApiError, LiftSanctionVariables>({
    mutationFn: ({ sanctionId, note }) => api.liftSanction(sanctionId, note),
    onSuccess: () => invalidateConsole(client),
  });
}

/** Variables for {@link useResolveAppeal}. */
export interface ResolveAppealVariables extends ResolveAppealBody {
  readonly appealId: string;
}

export function useResolveAppeal(): UseMutationResult<
  Appeal,
  StapelApiError,
  ResolveAppealVariables
> {
  const api = useModerationApi();
  const client = useQueryClient();
  return useMutation<Appeal, StapelApiError, ResolveAppealVariables>({
    mutationFn: ({ appealId, ...body }) => api.resolveAppeal(appealId, body),
    // An overturn REOPENS the case (`resolved -> queued`, the module's single
    // backward edge), so the whole console is stale, not just the appeal row.
    onSuccess: () => invalidateConsole(client),
  });
}
