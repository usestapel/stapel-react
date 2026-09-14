/**
 * The two reads — the triage feed and one issue — and the ETag machinery that
 * makes re-asking cheap.
 *
 * ── The validator lives in the CACHE ENTRY, not in a ref ──────────────────
 *
 * The obvious place to keep an `ETag` is a `useRef` beside the query. It is
 * the wrong place: two panes mounted on the same filters are two refs over one
 * cache entry, an unmount throws the validator away while the rows survive,
 * and a re-mount then asks unconditionally for a page it already has.
 *
 * So the cached VALUE is `{etag, page}` — the rows and the validator the
 * server issued for exactly those rows, stored together because that is what
 * they are. `queryFn` reads the previous entry, offers its validator, and on a
 * 304 returns **the previous object itself**. Same reference in, same
 * reference out: TanStack compares by identity, sees nothing changed, and
 * notifies nobody — so a feed polling every minute through a quiet night
 * repaints exactly zero times.
 *
 * A validator is offered only when there ARE previous rows to keep. "I have a
 * validator but no data" is a state this hook cannot reach, and the one arm
 * that could produce it (a 304 with an empty cache) re-asks without the
 * validator rather than inventing an empty page.
 */
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadStateFromQuery, mapLoad, useActiveSessionReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { IssueFilters } from "../api/alertsApi.js";
import type { Issue, IssueDetail, IssuePage } from "../api/types.js";
import { useAlertsApi, useAlertsRuntime } from "./context.js";
import { alertsQueryKeys } from "./queryKeys.js";

/** The filters a feed carries. The page cursor is the hook's, not the caller's. */
export type IssueFeedFilters = Omit<IssueFilters, "offset">;

/** What one cache entry of the feed holds: the rows and their validator. */
export interface IssuesSnapshot {
  readonly etag: string | null;
  readonly page: IssuePage;
}

/** What one cache entry of the detail holds. */
export interface IssueSnapshot {
  readonly etag: string | null;
  readonly detail: IssueDetail;
}

/**
 * A stable cache identity for a filter set. Sorted, so `{level, service}` and
 * `{service, level}` are ONE cache entry rather than two copies of the same
 * page that invalidate independently — and so the same two filters always
 * offer the same validator.
 */
export function issueFiltersKey(filters?: IssueFilters): string {
  if (filters === undefined) return "";
  const parts: string[] = [];
  if (filters.status !== undefined) parts.push(`status=${filters.status}`);
  if (filters.level !== undefined) parts.push(`level=${filters.level}`);
  if (filters.service !== undefined) parts.push(`service=${filters.service}`);
  if (filters.since !== undefined) parts.push(`since=${filters.since}`);
  if (filters.open !== undefined) parts.push(`open=${String(filters.open)}`);
  if (filters.offset !== undefined) parts.push(`offset=${String(filters.offset)}`);
  return parts.sort().join("&");
}

/** One service's rows, as the feed groups them. */
export interface IssueGroup {
  readonly service: string;
  readonly issues: readonly Issue[];
  /** The worst level present, for the group header. */
  readonly worstLevel: Issue["level"];
  /** Occurrences across the group — what makes one service louder than another. */
  readonly count: number;
}

const LEVEL_RANK: Readonly<Record<string, number>> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  fatal: 4,
};

/**
 * Group a page's rows by reporting service, worst-first.
 *
 * Pure and exported: "which service is on fire" is the first question the feed
 * answers, and it must be answerable in a test without a render. Services are
 * ordered by their worst level and then by how loud they are, because a
 * service with one fatal outranks a service with two hundred warnings — and
 * alphabetical order would bury it under `auth`.
 */
export function groupIssuesByService(
  issues: readonly Issue[]
): readonly IssueGroup[] {
  const byService = new Map<string, Issue[]>();
  for (const issue of issues) {
    const rows = byService.get(issue.service);
    if (rows) rows.push(issue);
    else byService.set(issue.service, [issue]);
  }
  const groups: IssueGroup[] = [];
  for (const [service, rows] of byService) {
    let worst: Issue["level"] = "debug";
    let count = 0;
    for (const row of rows) {
      count += row.count;
      if ((LEVEL_RANK[row.level] ?? 0) > (LEVEL_RANK[worst] ?? 0)) {
        worst = row.level;
      }
    }
    groups.push({ service, issues: rows, worstLevel: worst, count });
  }
  return groups.sort(
    (a, b) =>
      (LEVEL_RANK[b.worstLevel] ?? 0) - (LEVEL_RANK[a.worstLevel] ?? 0) ||
      b.count - a.count ||
      a.service.localeCompare(b.service)
  );
}

/** The shape a 304 with nothing to keep degrades to — see the module header. */
const EMPTY_PAGE: IssuePage = { count: 0, offset: 0, limit: 0, results: [] };

/** What {@link useIssues} reports. */
export interface IssuesBag {
  /** The rows of the current page. */
  readonly rows: LoadState<readonly Issue[]>;
  /** The same rows, grouped by service, worst-first. */
  readonly groups: LoadState<readonly IssueGroup[]>;
  /** How many issues match the filters across every page. */
  readonly total: number;
  /** The server's page size, as it reported it. */
  readonly pageSize: number;
  readonly offset: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly previousPage: () => void;
  readonly nextPage: () => void;
  /** The validator the last answer carried — `null` until the first 200. */
  readonly etag: string | null;
  /** A re-read that still offers the validator: usually a 304. */
  readonly refetch: () => void;
  /** A read is in flight (including a conditional poll that will 304). */
  readonly isFetching: boolean;
}

/**
 * The triage feed.
 *
 * The page cursor is INSIDE the hook and resets to zero whenever the filters
 * change — the alternative (a caller-held offset) reliably leaves somebody on
 * page 4 of a filter with one page, looking at an empty screen that is not
 * empty.
 */
export function useIssues(
  filters: IssueFeedFilters = {},
  options: { readonly enabled?: boolean } = {}
): IssuesBag {
  const api = useAlertsApi();
  const runtime = useAlertsRuntime();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();
  const enabled = sessionReady && (options.enabled ?? true);

  const filtersKey = issueFiltersKey(filters);
  // Derived-during-render reset: a filter change is a new question, and the
  // answer to it starts at its first page. No effect, so there is no frame in
  // which the old offset is applied to the new filters.
  const [cursor, setCursor] = useState<{ key: string; offset: number }>({
    key: filtersKey,
    offset: 0,
  });
  const offset = cursor.key === filtersKey ? cursor.offset : 0;

  const queryKey = alertsQueryKeys.issueList(
    issueFiltersKey({ ...filters, offset })
  );

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<IssuesSnapshot> => {
      const previous = queryClient.getQueryData<IssuesSnapshot>(queryKey);
      const request = { ...filters, offset };
      const answer = await api.issues(request, {
        // Offered only when there are rows the validator belongs to.
        etag: previous ? previous.etag : null,
        signal,
      });
      if (answer.outcome === "unchanged") {
        // The identity IS the message: same object, so nothing re-renders.
        if (previous) return previous;
        const fresh = await api.issues(request, { signal });
        return fresh.outcome === "modified"
          ? { etag: fresh.etag, page: fresh.data }
          : { etag: fresh.etag, page: EMPTY_PAGE };
      }
      return { etag: answer.etag, page: answer.data };
    },
    enabled,
    // No stream in this module, so the feed asks. Conditionally, which is why
    // the backend put an ETag on this route in the first place.
    refetchInterval: runtime.pollIntervalMs > 0 ? runtime.pollIntervalMs : false,
  });

  const snapshot = loadStateFromQuery(query);
  const page = query.data?.page;
  const pageSize = page?.limit ?? 0;
  const total = page?.count ?? 0;

  const goto = useCallback(
    (next: number) => setCursor({ key: filtersKey, offset: Math.max(0, next) }),
    [filtersKey]
  );

  return {
    rows: mapLoad(snapshot, (s) => s.page.results),
    groups: mapLoad(snapshot, (s) => groupIssuesByService(s.page.results)),
    total,
    pageSize,
    offset,
    hasPrevious: offset > 0,
    hasNext: pageSize > 0 && offset + pageSize < total,
    previousPage: () => goto(offset - (pageSize || 0)),
    nextPage: () => goto(offset + (pageSize || 0)),
    etag: query.data?.etag ?? null,
    refetch: () => {
      void query.refetch();
    },
    isFetching: query.isFetching,
  };
}

/** What {@link useIssue} reports. */
export interface IssueBag {
  readonly state: LoadState<IssueDetail>;
  /** The last events the store still holds for this issue (up to 20). */
  readonly events: LoadState<IssueDetail["events"]>;
  readonly etag: string | null;
  readonly refetch: () => void;
  readonly isFetching: boolean;
}

/**
 * One issue, with its last events — the read the detail screen is built on.
 *
 * Conditional in the same way as the feed, and for a sharper reason: an issue
 * detail carries up to twenty full tracebacks, which is the largest body this
 * module serves and the one nobody wants re-sent every minute.
 */
export function useIssue(
  issueId: string | undefined,
  options: { readonly enabled?: boolean } = {}
): IssueBag {
  const api = useAlertsApi();
  const runtime = useAlertsRuntime();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();
  const enabled =
    sessionReady && issueId !== undefined && (options.enabled ?? true);
  const queryKey = alertsQueryKeys.issue(issueId ?? "");

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<IssueSnapshot> => {
      const previous = queryClient.getQueryData<IssueSnapshot>(queryKey);
      const id = issueId ?? "";
      const answer = await api.issue(id, {
        etag: previous ? previous.etag : null,
        signal,
      });
      if (answer.outcome === "unchanged") {
        if (previous) return previous;
        const fresh = await api.issue(id, { signal });
        if (fresh.outcome === "modified") {
          return { etag: fresh.etag, detail: fresh.data };
        }
        throw new Error("alerts: a conditional read answered 304 with no cache");
      }
      return { etag: answer.etag, detail: answer.data };
    },
    enabled,
    refetchInterval: runtime.pollIntervalMs > 0 ? runtime.pollIntervalMs : false,
  });

  const snapshot = loadStateFromQuery(query);

  return {
    state: mapLoad(snapshot, (s) => s.detail),
    events: mapLoad(snapshot, (s) => s.detail.events),
    etag: query.data?.etag ?? null,
    refetch: () => {
      void query.refetch();
    },
    isFetching: query.isFetching,
  };
}
