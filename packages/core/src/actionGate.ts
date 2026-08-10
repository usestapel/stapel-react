/**
 * A control that is switched off must say why.
 *
 * THE INCIDENT (app.ironmemo.com, 2026-08-09), second half. While the
 * workspace list was answering 404, the upload button went grey. No tooltip,
 * no sentence, no alert — a dead rectangle. A person looking at it could not
 * tell whether they had hit a quota, lacked a permission, needed a workspace
 * first, or were looking at an outage. The owner's ruling: whatever the
 * reason, the user must be able to READ it.
 *
 * The general form of the defect is not "this button lacked a tooltip". It is
 * that `disabled` is a BOOLEAN, and a boolean is exactly one bit short of the
 * information a person needs. Every screen that computes `disabled={a || b ||
 * c}` has thrown away which of `a`, `b`, `c` fired — at the moment it decided
 * the person may not proceed, which is the moment the reason mattered most.
 *
 * So this module replaces the bit with {@link ActionAvailability}: available,
 * or blocked WITH a reason that is an i18n key (so it translates) plus the
 * originating failure (so support gets the technical detail). There is no way
 * to construct "blocked" without supplying a reason — `actionBlocked()` takes
 * the code as its first argument, and the union has no `{available: false}`
 * member without a `block`.
 *
 * ── Wording rule for the load-failure case ─────────────────────────────────
 *
 * When the cause is "we could not load the thing this depends on", the copy
 * must not blame the person and must not imply emptiness.
 * {@link ACTION_BLOCKED_LOAD_FAILED}'s floor sentence says the loading failed
 * and offers a retry. It deliberately does NOT reuse
 * `stapel.http.404` ("This is no longer available."), which is the sentence a
 * mis-mounted route would have produced and which asserts, wrongly, that
 * something does not exist — the same class of lie as the empty state this
 * whole change exists to remove, and open tracker item #211.
 */
import { toFlowError } from "./flows/flowError.js";
import type { FlowError } from "./flows/flowError.js";
import { useDescribeFlowError } from "./flows/useFormatFlowError.js";
import { useT } from "./i18n.js";
import { matchLoad } from "./loadState.js";
import type { LoadState } from "./loadState.js";

/** Why an action is unavailable. `code` is an i18n key; `params` feed its
 * `{placeholders}`; `cause` is the failure behind it, when there was one. */
export interface ActionBlock {
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
  /** The load/mutation failure that caused the block, for the technical
   * detail line. `undefined` for a block that is a rule, not a fault
   * (no permission, quota reached). */
  readonly cause: FlowError | undefined;
}

/**
 * Available, or blocked with a stated reason. There is no third shape, and
 * no way to spell "blocked, reason unknown" — if a screen cannot say why, it
 * has no business switching the control off.
 */
export type ActionAvailability =
  | { readonly available: true; readonly block?: undefined }
  | { readonly available: false; readonly block: ActionBlock };

/** The dependency this action needs has not finished loading. */
export const ACTION_BLOCKED_LOADING = "stapel.action.blocked.loading";

/** The dependency this action needs could NOT be loaded. */
export const ACTION_BLOCKED_LOAD_FAILED = "stapel.action.blocked.load_failed";

const AVAILABLE: ActionAvailability = { available: true };

/** The action can be taken. */
export function actionAvailable(): ActionAvailability {
  return AVAILABLE;
}

/**
 * The action is blocked, for the reason named by `code` — an i18n key the
 * host or a pair has copy for (a pair ships its own: quota reached, role
 * lacks the capability, workspace not chosen yet).
 */
export function actionBlocked(
  code: string,
  params: Readonly<Record<string, unknown>> = {}
): ActionAvailability {
  return { available: false, block: { code, params, cause: undefined } };
}

/**
 * The action is blocked because something it depends on FAILED to load.
 * Renders {@link ACTION_BLOCKED_LOAD_FAILED}'s sentence with the failure's
 * technical detail beside it — never the failure's own sentence, which for a
 * 404 would claim the dependency does not exist.
 */
export function actionBlockedByFailure(error: unknown): ActionAvailability {
  return {
    available: false,
    block: {
      code: ACTION_BLOCKED_LOAD_FAILED,
      params: {},
      cause: toFlowError(error),
    },
  };
}

/**
 * The bridge from {@link LoadState} to {@link ActionAvailability}: an action
 * that needs loaded data is blocked while the load is in flight, blocked with
 * the failure when it failed, and otherwise judged by `whenReady`.
 *
 * ```ts
 * const upload = requireLoaded(selection.state, (workspaces) =>
 *   workspaces.length === 0
 *     ? actionBlocked("recordings.upload.blocked.no_workspace")
 *     : actionAvailable(),
 * );
 * ```
 *
 * This is what makes the correct thing shorter than the wrong thing: the
 * screen that used to write `disabled={!workspace}` — one expression covering
 * three unrelated situations — now cannot reach `workspaces` without having
 * answered for the other two.
 */
export function requireLoaded<T>(
  state: LoadState<T>,
  whenReady: (data: T) => ActionAvailability
): ActionAvailability {
  return matchLoad(state, {
    loading: () => actionBlocked(ACTION_BLOCKED_LOADING),
    failed: (error) => actionBlockedByFailure(error),
    ready: whenReady,
  });
}

/**
 * Several conditions, one control: the FIRST block wins and its reason is the
 * one shown. Order the arguments the way you would explain the situation to a
 * person — "we could not load your workspaces" before "you have no
 * workspaces" before "you have reached your quota".
 */
export function firstBlock(
  ...availabilities: readonly ActionAvailability[]
): ActionAvailability {
  for (const availability of availabilities) {
    if (!availability.available) return availability;
  }
  return actionAvailable();
}

/** What a skin renders. Flat strings: there is nothing here a component can
 * accidentally stringify into `[object Object]`. */
export interface ActionGateView {
  /** Bind straight to the control's `disabled` prop. */
  readonly disabled: boolean;
  /**
   * The sentence to show the person, already translated. `undefined` exactly
   * when `disabled` is false.
   *
   * Render it as TEXT beside the control, not only as a `title`/tooltip: a
   * disabled button receives no pointer events in any browser, so a tooltip
   * on it is a reason nobody can read — which is the state this module exists
   * to end.
   */
  readonly reason: string | undefined;
  /** The technical detail a support agent quotes (`"HTTP 404"`), muted and
   * small beside the reason. `undefined` when there is nothing worth
   * quoting. */
  readonly detail: string | undefined;
}

/**
 * {@link ActionAvailability} → the strings a skin renders, through the host's
 * current locale. Reads core's i18n floor for its own two codes, so a pair or
 * host gets a real sentence with zero wiring, and overrides either by
 * registering the same key later.
 *
 * ```tsx
 * const gate = useActionGate(upload);
 * <>
 *   <Button disabled={gate.disabled} onClick={start}>{t("upload.start")}</Button>
 *   {gate.reason && <Text type="secondary">{gate.reason}</Text>}
 * </>
 * ```
 *
 * Re-render-safe on the same terms as `useFormatFlowError`: it reads the
 * current bundle fresh on every render rather than subscribing. `useT()` is
 * called here, so a component using this hook already re-renders on locale
 * change.
 */
export function useActionGate(availability: ActionAvailability): ActionGateView {
  const t = useT();
  const describe = useDescribeFlowError();
  if (availability.available) {
    return { disabled: false, reason: undefined, detail: undefined };
  }
  const { code, params, cause } = availability.block;
  return {
    disabled: true,
    reason: t(code, params),
    detail: cause === undefined ? undefined : describe(cause).detail,
  };
}
