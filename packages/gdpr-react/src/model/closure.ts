import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { loadStateFromQuery, useActiveSessionReady } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { AccountClosure } from "../api/types.js";
import { useGdprApi } from "./context.js";
import { gdprQueryKeys } from "./queryKeys.js";
import { isClosureAlreadyPending, isNoActiveClosure } from "./refusals.js";

/**
 * What {@link useAccountClosure} reports.
 *
 * `state` is the discriminated answer and the only thing a renderer should
 * branch on; the flat fields beside it are conveniences for the ready arm and
 * every one of them is documented with what it means BEFORE an answer lands.
 */
export interface AccountClosureBag {
  /**
   * The closure on record, or `null` for "this account is not being deleted".
   *
   * `null` is a real ANSWER, not an absence: the endpoint says so with a 404
   * (`error.404.gdpr.no_active_closure`) and this hook folds it. A skin
   * renders three arms — loading, failed, ready — and the ready arm still has
   * two shapes, which is exactly the shape of the question.
   */
  readonly state: LoadState<AccountClosure | null>;
  /**
   * The wire's own status (`grace` | `deleting` | `deleted`), `"none"` when
   * the answer landed and there is no closure, `undefined` only while there is
   * no answer yet (loading, or failed).
   */
  readonly status: AccountClosure["status"] | "none" | undefined;
  /** True while the account is on its way out and the person should be told. */
  readonly closing: boolean;
  /**
   * The DATE the account is deleted on, ISO, straight off the wire. Never a
   * countdown computed here: the sweep task acts on the server's instant, and
   * a browser clock that disagrees would show a different deadline from the
   * one that will actually be honoured.
   */
  readonly graceEndsAt: string | undefined;
  /** Whether the closure can still be called off (the server decides). */
  readonly canCancel: boolean;
  /** Start the grace period. Sessions are revoked immediately, server-side. */
  readonly initiate: UseMutationResult<AccountClosure, StapelApiError, void>;
  /** Call it off. Only meaningful while `canCancel`. */
  readonly cancel: UseMutationResult<AccountClosure, StapelApiError, void>;
  readonly refetch: () => void;
}

/**
 * The account's own deletion state, with the two writes that move it.
 *
 * ── The 404 that means "you are fine" ─────────────────────────────────────
 *
 * `GET /user/account/close/status` answers **404
 * `error.404.gdpr.no_active_closure`** whenever no closure exists — which is
 * the state of almost every account, almost always. Left as a failure it
 * would put "something went wrong" (or worse, "not found") on the screen a
 * person opens to ask *"is my account being deleted?"* — the one question
 * where an ambiguous answer is unacceptable. So the fold happens HERE, once,
 * in the model layer: the query resolves to `null`, `matchLoad`'s `failed` arm
 * keeps its meaning ("we could not ask"), and every skin and every host reads
 * the same three states.
 *
 * The fold is by CODE. The module has two other 404s — a missing export and a
 * missing erasure — and swallowing those would hide real misses.
 *
 * ── Gated on the session, like every read here ────────────────────────────
 *
 * Every endpoint on this surface is `IsAuthenticated` (plus `AccountNotClosed`
 * on most). A read that raced a still-bootstrapping session would answer 401,
 * which core folds to `stapel.http.401` — a failure arm on a screen about
 * deletion, for a reason that has nothing to do with deletion.
 */
export function useAccountClosure(
  options: { readonly enabled?: boolean } = {}
): AccountClosureBag {
  const api = useGdprApi();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();
  const enabled = sessionReady && (options.enabled ?? true);

  const query = useQuery<AccountClosure | null>({
    queryKey: gdprQueryKeys.closure,
    queryFn: ({ signal }) =>
      api.closureStatus({ signal }).catch((error: unknown) => {
        if (isNoActiveClosure(error)) return null;
        throw error;
      }),
    enabled,
  });

  // Both writes answer with the closure state they produced, so the cache is
  // seeded from the response and then the whole module is invalidated: a
  // closure that reaches grace end becomes an ErasureRequest, which is what
  // `useMyErasures` lists.
  const settle = (closure: AccountClosure | null): void => {
    queryClient.setQueryData(gdprQueryKeys.closure, closure);
    void queryClient.invalidateQueries({ queryKey: gdprQueryKeys.all });
  };

  // Options as a typed OBJECT rather than call-site generics: that keeps
  // `void` (no variables) in type-reference position, which
  // `no-invalid-void-type` permits (the auth-react precedent).
  const initiateOptions: UseMutationOptions<AccountClosure, StapelApiError, void> = {
    mutationFn: () => api.initiateClosure(),
    onSuccess: (closure) => settle(closure),
    // 409 `closure_already_pending` is not a failure of anything: a closure
    // exists, this call simply was not the one that made it (another tab, a
    // double click, a DSAR of kind `erasure` matched to this account minutes
    // ago). Re-read, so the screen shows the banner instead of complaining
    // about a state it wanted anyway. The error still reaches the caller —
    // suppressing it is the SKIN's decision, not the model's.
    onError: (error) => {
      if (isClosureAlreadyPending(error)) {
        void queryClient.invalidateQueries({ queryKey: gdprQueryKeys.closure });
      }
    },
  };
  const initiate = useMutation(initiateOptions);

  const cancelOptions: UseMutationOptions<AccountClosure, StapelApiError, void> = {
    mutationFn: () => api.cancelClosure(),
    // The cancel response IS a closure row (status `cancelled`), and the
    // module excludes cancelled rows from the status read — so the cache is
    // set to `null`, the same answer the next GET would give, instead of to a
    // row the read can never produce again.
    onSuccess: () => settle(null),
  };
  const cancel = useMutation(cancelOptions);

  const state = loadStateFromQuery(query);
  const closure = state.status === "ready" ? state.data : undefined;

  return {
    state,
    status:
      closure === undefined ? undefined : closure === null ? "none" : closure.status,
    closing: closure != null && closure.status !== "deleted",
    graceEndsAt: closure?.grace_ends_at,
    canCancel: closure?.can_cancel ?? false,
    initiate,
    cancel,
    refetch: () => {
      void query.refetch();
    },
  };
}
