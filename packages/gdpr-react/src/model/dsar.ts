import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import { loadStateFromQuery, useActiveSessionReady } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { DsarPatch, DsarSubmission } from "../api/gdprApi.js";
import type { DsarStatus } from "../api/types.js";
import { useGdprApi } from "./context.js";
import { gdprQueryKeys } from "./queryKeys.js";

/** What {@link useDsar} reports. */
export interface DsarBag {
  /**
   * Record a data-protection request. Takes the discriminated
   * {@link DsarSubmission} — `{ variant: "app", … }` for a signed-in person,
   * `{ variant: "anonymous", email, captchaToken?, … }` for the public form.
   */
  readonly submit: UseMutationResult<DsarStatus, StapelApiError, DsarSubmission>;
  /**
   * The request this session just filed, with its reference number and its two
   * statutory dates. Kept in the bag because the acknowledgement screen is the
   * proof the person walks away with — a form that cleared itself on success
   * would leave them with nothing to quote.
   */
  readonly submitted: DsarStatus | undefined;
}

/**
 * DSAR intake — the front door of Art. 12/15/16/17/20.
 *
 * ── One hook, two callers, and the type keeps them apart ──────────────────
 *
 * `POST /dsar` is `AllowAny` because the form a regulator expects to exist
 * cannot require a login. So the same endpoint serves a signed-in person
 * (channel `app`; the server reads their email off the session and IGNORES a
 * supplied one) and an anonymous visitor (channel `form`; email REQUIRED, and
 * a captcha token whenever a backend is configured). The submission union
 * makes "anonymous with no email" and "authenticated with someone else's
 * email" unspellable, instead of leaving both to a 400.
 *
 * ── The acknowledgement is automatic, and that IS the compliance ──────────
 *
 * Creating the row sends `gdpr.dsar.received` to the requester and records
 * `ack_sent_at`. The three-business-day clock is met by machinery rather than
 * by an operator remembering, which is why the success arm has something real
 * to show: a reference number, `ack_due_at`, and `resolve_due_at`.
 *
 * ── What the intake deliberately does NOT do ──────────────────────────────
 *
 * An anonymous `kind=erasure` does not start an erasure. Turning an unverified
 * email into a deletion is an oracle — anyone could type an address and watch
 * what happens — so matching a request to an account is a STAFF action
 * (`useUpdateDsar` with `userId`). Nothing in this hook papers over that gap
 * with a client-side lookup.
 */
export function useDsar(): DsarBag {
  const api = useGdprApi();
  const queryClient = useQueryClient();

  const submit = useMutation<DsarStatus, StapelApiError, DsarSubmission>({
    mutationFn: (submission) => api.submitDsar(submission),
    onSuccess: () => {
      // A staff screen open in another tab should see the new row; a
      // `kind=erasure` from a matched account also starts a closure, which is
      // why the whole module is invalidated rather than just the queue.
      void queryClient.invalidateQueries({ queryKey: gdprQueryKeys.all });
    },
  });

  return { submit, submitted: submit.data };
}

/** What {@link useDsarQueue} reports. */
export interface DsarQueueBag {
  readonly rows: LoadState<readonly DsarStatus[]>;
  /**
   * Requests whose acknowledgement clock has run out with no `ack_sent_at`.
   *
   * The acknowledgement is automated, so a row in here means the automation
   * did not run — a broken notification wiring, not a slow operator. Same
   * finding as `gdpr.W008` at boot, on the screen where somebody can act.
   */
  readonly ackOverdue: readonly DsarStatus[];
  /** Requests past `resolve_due_at` that nobody has resolved or rejected. */
  readonly resolveOverdue: readonly DsarStatus[];
  readonly refetch: () => void;
}

const STATE_RESOLVED = "resolved";
const STATE_REJECTED = "rejected";

/** Whether an ISO instant on the wire is already in the past. */
function isPast(iso: string, now: number): boolean {
  const at = Date.parse(iso);
  return Number.isFinite(at) && at < now;
}

/**
 * The staff queue, with the two deadline breaches named.
 *
 * ── Comparing dates here is not the same as computing them ────────────────
 *
 * Nothing in this pair derives a deadline (`ack_due_at` and `resolve_due_at`
 * are the server's, business days and all). Asking whether one has PASSED is a
 * different act, and it has to happen where the table is drawn: an operator
 * looking at the queue at 16:00 needs the row that went overdue at 15:00 to be
 * red without a refetch. The comparison uses the reader's clock and says so.
 */
export function useDsarQueue(
  options: { readonly enabled?: boolean } = {}
): DsarQueueBag {
  const api = useGdprApi();
  const sessionReady = useActiveSessionReady();
  const enabled = sessionReady && (options.enabled ?? true);

  const query = useQuery<readonly DsarStatus[]>({
    queryKey: gdprQueryKeys.dsarQueue,
    queryFn: ({ signal }) => api.dsarQueue({ signal }),
    enabled,
  });

  const rows = loadStateFromQuery(query);
  const loaded = rows.status === "ready" ? rows.data : [];
  const now = Date.now();
  const open = (row: DsarStatus): boolean =>
    row.state !== STATE_RESOLVED && row.state !== STATE_REJECTED;

  return {
    rows,
    ackOverdue: loaded.filter(
      (row) => row.ack_sent_at == null && isPast(row.ack_due_at, now)
    ),
    resolveOverdue: loaded.filter(
      (row) => open(row) && isPast(row.resolve_due_at, now)
    ),
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Variables for {@link useUpdateDsar}. */
export interface UpdateDsarVariables extends DsarPatch {
  readonly dsarId: number;
}

/**
 * Staff triage: move a request's state, add a note, or match an anonymous
 * request to an account.
 *
 * Setting `userId` is the moment the machine that ANSWERS the request starts
 * — an erasure becomes the cancellable closure, an access request becomes a
 * data export. That is a deliberate staff decision (see {@link useDsar}), so
 * it is one field on a triage mutation rather than a separate "approve"
 * endpoint that would read as a rubber stamp.
 */
export function useUpdateDsar(): UseMutationResult<
  DsarStatus,
  StapelApiError,
  UpdateDsarVariables
> {
  const api = useGdprApi();
  const queryClient = useQueryClient();

  return useMutation<DsarStatus, StapelApiError, UpdateDsarVariables>({
    mutationFn: ({ dsarId, ...patch }) => api.updateDsar(dsarId, patch),
    onSuccess: (dsar) => {
      queryClient.setQueryData(gdprQueryKeys.dsarOne(dsar.request_id), dsar);
      // Matching a request to a person starts a closure or an export, so the
      // invalidation is module-wide rather than queue-only.
      void queryClient.invalidateQueries({ queryKey: gdprQueryKeys.all });
    },
  });
}
