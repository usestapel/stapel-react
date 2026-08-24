import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  bothLoaded,
  isStapelApiError,
  loadStateFromQuery,
  mapLoad,
  requireLoaded,
} from "@stapel/core";
import type {
  ActionAvailability,
  LoadState,
  StapelApiError,
} from "@stapel/core";
import type {
  FormFieldDef,
  FormVersion,
  Submission,
} from "../api/types.js";
import { useFormVersions, useSubmissions } from "../model/queries.js";
import {
  useCsvExport,
  useDeleteSubmission,
  useResendSubmission,
} from "../model/mutations.js";
import type { ResendRequest } from "../api/types.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/** Default page size for the keyset list. */
const DEFAULT_LIMIT = 50;

/** One column of the responses grid — a field of the version being reviewed. */
export interface ResponseColumn {
  readonly slug: string;
  /** The admin-authored label, or the slug when the field was never named. */
  readonly title: string;
  readonly kind: string;
}

/** The rows and the columns that describe them, loaded together. */
export interface ResponsesView {
  readonly rows: readonly Submission[];
  /**
   * Columns for the CURRENT version filter. Per-version column sets are what
   * the version FK buys: a submission records which schema it answered, so
   * reviewing an old response shows the questions that were actually asked,
   * not today's.
   *
   * With no version filter this is the union of every version's fields, in
   * newest-version-first order — the honest superset, because rows from
   * different versions genuinely have different keys.
   */
  readonly columns: readonly ResponseColumn[];
}

/** The bag `<ResponsesTable>` hands its render prop (spec §8.2). */
export interface ResponsesTableBag {
  readonly state: LoadState<ResponsesView>;
  /** Every published version, for the filter control. */
  readonly versions: LoadState<readonly FormVersion[]>;
  /** The active version filter, or `null` for "all versions". */
  readonly version: number | null;
  setVersion(version: number | null): void;

  /** Go to the next keyset page. Blocked with a reason at the end of the
   * list, while loading, and when the load failed. */
  readonly nextPage: ActionAvailability;
  goNextPage(): void;
  /** Go back one page. Blocked with a reason on the first page. */
  readonly prevPage: ActionAvailability;
  goPrevPage(): void;
  /** 0-based index of the page on screen. */
  readonly pageIndex: number;

  /** The row opened in the detail dialog, or `null`. */
  readonly selected: Submission | null;
  select(submission: Submission | null): void;

  /** `forms.responses.manage`. */
  remove(submissionId: string): void;
  readonly isRemoving: boolean;
  /**
   * Re-deliver one response. An `override` REPLACES the form's configured
   * targets rather than adding to them (backend delta note 7).
   */
  resend(submissionId: string, override?: ResendRequest): void;
  readonly isResending: boolean;
  /** How many deliveries the last resend reported, or `null`. */
  readonly lastResendCount: number | null;

  /** Drive the CSV export to completion; resolves to the whole file's text. */
  exportCsv(): Promise<string>;
  readonly isExporting: boolean;
  readonly exportPages: number;

  /** The last mutation refusal (delete / resend / export). */
  readonly error: StapelApiError | null;
  refetch(): void;
}

/**
 * A caught value → the API dialect, or `null`.
 *
 * `caught as StapelApiError` is a lie for a network fault (no `.code`, no
 * `.status`), and `stapel/no-raw-error-shape` is right to refuse it. A bag
 * that reports `error: null` for a fault it cannot describe is honest; the
 * mutation's own `isError` still says something went wrong.
 */
function asApiError(caught: unknown): StapelApiError | null {
  return isStapelApiError(caught) ? caught : null;
}

function columnsOf(fields: readonly FormFieldDef[]): ResponseColumn[] {
  return fields
    // A header is a caption, not a question: it has no answer, so it is not a
    // column. (The engine regenerates its DAO from config and rejects an
    // answer to one, so a header column would always be empty.)
    .filter((field) => field.kind !== "header")
    .map((field) => ({
      slug: field.slug,
      title:
        typeof field.name === "string" && field.name.length > 0
          ? field.name
          : field.slug,
      kind: field.kind,
    }));
}

/**
 * Headless response review — keyset paging, per-version columns, detail
 * selection, delete, resend and CSV export, renderless.
 *
 * ── Freshness policy: MANUAL POLLING, declared ─────────────────────────────
 *
 * This bag has no live feed and no background timer, and that is a decision
 * with a date on it rather than an unfinished feature:
 *
 *  - `@stapel/realtime` has shipped and this pair could consume it — but
 *    stapel-forms 0.2.0 exposes **no stream to consume**. Its MODULE.md §11
 *    lists "realtime response feed" as out of scope and RESERVES the name
 *    `forms:ws:<workspace_id>` for a consumer that does not exist ("modules do
 *    not open sockets"); `grep -l Consumer stapel-forms/*.py` finds nothing.
 *    A socket opened from here would be this pair inventing a protocol the
 *    backend does not speak — the exact defect `@stapel/realtime` exists to
 *    end.
 *  - No `refetchInterval` either. A reviewer reads one response at a time; a
 *    table that silently reorders under the cursor mid-read loses their place
 *    and can move the row they were about to delete.
 *
 * So freshness is an ACT: {@link ResponsesTableBag.refetch}, surfaced by the
 * skin as a visible control with one sentence saying the list does not update
 * on its own. When stapel-forms grows the consumer, this bag gains a
 * `useStream` subscription and that sentence is what gets deleted.
 */
export function ResponsesTable(props: {
  workspaceId: string;
  formId: string;
  /** Rows per page. Default 50. */
  limit?: number;
  children: (bag: ResponsesTableBag) => ReactNode;
}): ReactNode {
  const limit = props.limit ?? DEFAULT_LIMIT;
  const [version, setVersionState] = useState<number | null>(null);
  // The keyset trail: one cursor per page boundary crossed. Index 0 is the
  // first page (no cursor). Keeping the whole trail — rather than one
  // "current" cursor — is what makes "previous" possible at all: a keyset
  // cursor only ever walks forward.
  const [trail, setTrail] = useState<readonly (string | undefined)[]>([
    undefined,
  ]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [error, setError] = useState<StapelApiError | null>(null);
  const [lastResendCount, setLastResendCount] = useState<number | null>(null);

  const before = trail[pageIndex];

  const submissionsQuery = useSubmissions({
    workspaceId: props.workspaceId,
    formId: props.formId,
    limit,
    ...(before !== undefined ? { before } : {}),
    ...(version !== null ? { version } : {}),
  });
  const versionsQuery = useFormVersions(props.workspaceId, props.formId);

  const rowsState = loadStateFromQuery(submissionsQuery);
  const versionsState = loadStateFromQuery(versionsQuery);

  const state: LoadState<ResponsesView> = useMemo(
    () =>
      mapLoad(bothLoaded(rowsState, versionsState), ([rows, versions]) => {
        const chosen =
          version !== null
            ? versions.filter((v) => v.version === version)
            : [...versions].sort((a, b) => b.version - a.version);
        const seen = new Set<string>();
        const columns: ResponseColumn[] = [];
        for (const v of chosen) {
          for (const column of columnsOf(v.schema.fields ?? [])) {
            if (seen.has(column.slug)) continue;
            seen.add(column.slug);
            columns.push(column);
          }
        }
        return { rows, columns };
      }),
    [rowsState, versionsState, version]
  );

  const deleteMutation = useDeleteSubmission();
  const resendMutation = useResendSubmission();
  const csv = useCsvExport();

  const setVersion = useCallback((next: number | null): void => {
    setVersionState(next);
    // A version filter is a different list, so the keyset trail from the old
    // one is meaningless — carrying it over would page into cursors that
    // belong to rows this filter excludes.
    setTrail([undefined]);
    setPageIndex(0);
    setSelected(null);
  }, []);

  // Memoized, not a bare conditional: `goNextPage` closes over `rows`, and a
  // fresh `[]` on every render would re-create that callback every time.
  const rows = useMemo(
    () => (state.status === "ready" ? state.data.rows : []),
    [state]
  );
  // A short page is the end of the list: the server returns at most `limit`.
  const atEnd = state.status === "ready" && rows.length < limit;

  const nextPage: ActionAvailability = useMemo(
    () =>
      requireLoaded(state, (view) => {
        if (view.rows.length === 0 || view.rows.length < limit) {
          return actionBlocked(FORMS_I18N_KEYS.responsesAtEnd);
        }
        return actionAvailable();
      }),
    [state, limit]
  );

  const prevPage: ActionAvailability = useMemo(
    () =>
      pageIndex === 0
        ? actionBlocked(FORMS_I18N_KEYS.responsesAtStart)
        : actionAvailable(),
    [pageIndex]
  );

  const goNextPage = useCallback((): void => {
    if (atEnd || rows.length === 0) return;
    const last = rows[rows.length - 1];
    if (last === undefined) return;
    setTrail((current) => {
      const next = current.slice(0, pageIndex + 1);
      next.push(last.submitted_at);
      return next;
    });
    setPageIndex((index) => index + 1);
    setSelected(null);
  }, [atEnd, rows, pageIndex]);

  const goPrevPage = useCallback((): void => {
    setPageIndex((index) => (index > 0 ? index - 1 : 0));
    setSelected(null);
  }, []);

  const onError = useCallback((caught: unknown): void => {
    setError(asApiError(caught));
  }, []);

  const remove = useCallback(
    (submissionId: string): void => {
      setError(null);
      deleteMutation.mutate(
        { workspaceId: props.workspaceId, submissionId },
        {
          onError,
          onSuccess: () => {
            setSelected((current) =>
              current !== null && current.id === submissionId ? null : current
            );
          },
        }
      );
    },
    [deleteMutation, props.workspaceId, onError]
  );

  const resend = useCallback(
    (submissionId: string, override?: ResendRequest): void => {
      setError(null);
      setLastResendCount(null);
      resendMutation.mutate(
        {
          workspaceId: props.workspaceId,
          submissionId,
          ...(override !== undefined ? { override } : {}),
        },
        {
          onError,
          onSuccess: (result) => {
            setLastResendCount(result.sent);
          },
        }
      );
    },
    [resendMutation, props.workspaceId, onError]
  );

  const exportCsv = useCallback(async (): Promise<string> => {
    setError(null);
    try {
      return await csv.run({
        workspaceId: props.workspaceId,
        formId: props.formId,
        ...(version !== null ? { version } : {}),
      });
    } catch (caught) {
      setError(asApiError(caught));
      throw caught;
    }
  }, [csv, props.workspaceId, props.formId, version]);

  const refetch = useCallback((): void => {
    void submissionsQuery.refetch();
    void versionsQuery.refetch();
  }, [submissionsQuery, versionsQuery]);

  return props.children({
    state,
    versions: versionsState,
    version,
    setVersion,
    nextPage,
    goNextPage,
    prevPage,
    goPrevPage,
    pageIndex,
    selected,
    select: setSelected,
    remove,
    isRemoving: deleteMutation.isPending,
    resend,
    isResending: resendMutation.isPending,
    lastResendCount,
    exportCsv,
    isExporting: csv.isExporting,
    exportPages: csv.pagesFetched,
    error,
    refetch,
  });
}
