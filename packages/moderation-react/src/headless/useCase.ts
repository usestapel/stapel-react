/**
 * One case, everything a moderator may do to it, and the reason beside every
 * door that is shut.
 *
 * ── The lease is why this is a machine and not four buttons ───────────────
 *
 * `claim` writes `claimed_by` + `claimed_until`; when the lease runs out the
 * server takes the case back SILENTLY. A console that only knew "claimed"
 * would let somebody write a verdict on a case that had already returned to
 * the queue and meet the refusal at submit — after the note was typed. So the
 * lease is read on every render ({@link leaseStatus}, against the reader's
 * clock) and it is what gates `release` and the verdict form.
 *
 * `viewerId` is a HOST seam: this module has no `/me` and every actor on its
 * wire is an opaque UUID, so without one the pair cannot tell its own lease
 * from a colleague's — and it says "somebody else holds this" rather than
 * offering a release that would 409.
 *
 * ── The rescan poll stops itself twice ────────────────────────────────────
 *
 * `POST rescan` answers 202 with a `task_id` and there is no route to poll it,
 * so the card re-reads ITSELF every three seconds — until the state leaves
 * `screening`, or sixty seconds pass. The second stop is not a nicety: a
 * screening that never finishes (a dead worker) would otherwise poll for as
 * long as the tab is open.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  useFlow,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { Decision, SanctionKind } from "../api/enums.js";
import type { CaseDetail, CaseEvent } from "../api/types.js";
import {
  RESCAN_POLL_INTERVAL_MS,
  RESCAN_POLL_TIMEOUT_MS,
  createTriageFlow,
  leaseStatus,
  triageRefused,
} from "../flows/triageFlow.js";
import type { LeaseStatus, TriageFlowState } from "../flows/triageFlow.js";
import { MODERATION_I18N_KEYS } from "../i18n/keys.js";
import { useModerationAnalytics } from "../model/context.js";
import {
  loadOf,
  useCaseDetailQuery,
  useCaseEventsQuery,
  useClaimCase,
  useReleaseCase,
  useRescanCase,
  useSubmitVerdict,
} from "../model/queries.js";
import { isStepUp } from "../model/refusals.js";

/**
 * How long a sanction lasts. `"indefinite"` is deliberately NOT offered: the
 * verdict wire omits the field for the kind's ladder default and accepts no
 * `null`, so an "until it is lifted" control on this form could not be sent.
 */
export type SanctionDurationMode = "ladder" | "custom";

/** The verdict draft and its gate. */
export interface VerdictDraft {
  readonly decision: Decision | "";
  readonly setDecision: (decision: Decision | "") => void;
  readonly reasonCode: string;
  readonly setReasonCode: (code: string) => void;
  readonly note: string;
  readonly setNote: (note: string) => void;
  /** Whether the decision also carries a consequence for the author. */
  readonly withSanction: boolean;
  readonly setWithSanction: (value: boolean) => void;
  /** Blocked unless the decision is `rejected` — a sanction for content that
   * was found FINE is not a thing the module can express. */
  readonly sanctionAllowed: ActionAvailability;
  readonly sanctionKind: SanctionKind | "";
  readonly setSanctionKind: (kind: SanctionKind | "") => void;
  readonly durationMode: SanctionDurationMode;
  readonly setDurationMode: (mode: SanctionDurationMode) => void;
  readonly durationSeconds: number;
  readonly setDurationSeconds: (seconds: number) => void;
  readonly scope: string;
  readonly setScope: (scope: string) => void;
  readonly submit: ActionAvailability;
  readonly run: () => void;
}

export interface UseCaseOptions {
  readonly caseId: string | undefined;
  /** Who the reader is, so their own lease is telling apart from a colleague's. */
  readonly viewerId?: string;
}

export interface CaseBag {
  readonly detail: LoadState<CaseDetail>;
  readonly events: LoadState<readonly CaseEvent[]>;
  readonly showEvents: boolean;
  readonly setShowEvents: (value: boolean) => void;
  readonly lease: LeaseStatus;
  readonly resolved: boolean;
  readonly claim: ActionAvailability;
  readonly runClaim: () => void;
  readonly release: ActionAvailability;
  readonly runRelease: () => void;
  readonly rescan: ActionAvailability;
  readonly runRescan: () => void;
  readonly verdict: VerdictDraft;
  readonly state: TriageFlowState;
  readonly refetch: () => void;
}

/** Blocked while a write is in flight — a transient, with the spinner beside it. */
const inFlight = (busy: boolean, key: string): ActionAvailability =>
  busy ? actionBlocked(key) : actionAvailable();

export function useCase(options: UseCaseOptions): CaseBag {
  const analytics = useModerationAnalytics();
  const machine = useMemo(() => createTriageFlow({ analytics }), [analytics]);
  const state = useFlow(machine);
  const caseId = options.caseId;

  const detailQuery = useCaseDetailQuery(caseId);
  const detail = loadOf(detailQuery);
  const [showEvents, setShowEvents] = useState(false);
  const eventsQuery = useCaseEventsQuery(caseId, showEvents);

  const claimCase = useClaimCase();
  const releaseCase = useReleaseCase();
  const rescanCase = useRescanCase();
  const submitVerdict = useSubmitVerdict();

  const [decision, setDecision] = useState<Decision | "">("");
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [withSanction, setWithSanction] = useState(false);
  const [sanctionKind, setSanctionKind] = useState<SanctionKind | "">("");
  const [durationMode, setDurationMode] = useState<SanctionDurationMode>("ladder");
  const [durationSeconds, setDurationSeconds] = useState(86_400);
  const [scope, setScope] = useState("");

  // ── the rescan poll ───────────────────────────────────────────────────────
  const [pollUntil, setPollUntil] = useState<number | null>(null);
  // The query object is a new value every render; the poll must not restart
  // with it, so the effect reaches the refetch through a ref.
  const refetchRef = useRef(detailQuery.refetch);
  refetchRef.current = detailQuery.refetch;

  const screening = detail.status === "ready" && detail.data.state === "screening";
  useEffect(() => {
    if (pollUntil === null) return;
    if (!screening) {
      setPollUntil(null);
      return;
    }
    const timer = setInterval(() => {
      if (Date.now() >= pollUntil) {
        setPollUntil(null);
        return;
      }
      void refetchRef.current();
    }, RESCAN_POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [pollUntil, screening]);

  const lease: LeaseStatus =
    detail.status === "ready"
      ? leaseStatus(detail.data, options.viewerId, Date.now())
      : { kind: "free" };
  const resolved = detail.status === "ready" && detail.data.state === "resolved";

  const notMine: ActionAvailability =
    lease.kind === "other" && !lease.expired
      ? actionBlocked(MODERATION_I18N_KEYS.caseBlockedNotMine)
      : actionAvailable();
  const notResolved: ActionAvailability = resolved
    ? actionBlocked(MODERATION_I18N_KEYS.caseBlockedResolved)
    : actionAvailable();
  const mineOnly: ActionAvailability =
    lease.kind === "mine" && !lease.expired
      ? actionAvailable()
      : lease.kind === "free"
        ? actionBlocked(MODERATION_I18N_KEYS.caseBlockedNotClaimed)
        : actionBlocked(MODERATION_I18N_KEYS.caseBlockedNotMine);

  const busy = state.step === "claiming" || state.step === "deciding";
  const working = inFlight(busy, MODERATION_I18N_KEYS.caseBlockedInFlight);

  const claim = firstBlock(notResolved, notMine, working);
  const release = firstBlock(notResolved, mineOnly, working);
  const rescan = firstBlock(notResolved, working);

  const runWrite = useCallback(
    (
      pending: TriageFlowState,
      task: () => Promise<unknown>,
      resolve: () => TriageFlowState
    ): void => {
      void machine.run(pending, task, {
        resolve,
        reject: (error) =>
          // Core's client runs the host's verification challenge and retries
          // once; parking in `verifying` is what turns the second refusal into
          // "confirm it is you" instead of a spinner that means nothing.
          isStepUp(error) ? { step: "verifying" } : triageRefused(error),
      });
    },
    [machine]
  );

  const runClaim = useCallback((): void => {
    if (!claim.available || caseId === undefined) return;
    runWrite(
      { step: "claiming" },
      () => claimCase.mutateAsync(caseId),
      () => ({ step: "queued" })
    );
  }, [caseId, claim.available, claimCase, runWrite]);

  const runRelease = useCallback((): void => {
    if (!release.available || caseId === undefined) return;
    runWrite(
      { step: "claiming" },
      () => releaseCase.mutateAsync(caseId),
      () => ({ step: "queued" })
    );
  }, [caseId, release.available, releaseCase, runWrite]);

  const runRescan = useCallback((): void => {
    if (!rescan.available || caseId === undefined) return;
    void machine.run(
      { step: "claiming" },
      () => rescanCase.mutateAsync(caseId),
      {
        resolve: () => {
          setPollUntil(Date.now() + RESCAN_POLL_TIMEOUT_MS);
          return { step: "screening" };
        },
        reject: (error) => triageRefused(error),
      }
    );
  }, [caseId, machine, rescan.available, rescanCase]);

  const sanctionAllowed: ActionAvailability =
    decision === "rejected"
      ? actionAvailable()
      : actionBlocked(MODERATION_I18N_KEYS.verdictSanctionOnlyRejected);

  const verdictSubmit = firstBlock(
    notResolved,
    mineOnly,
    decision === ""
      ? actionBlocked(MODERATION_I18N_KEYS.verdictBlockedNoDecision)
      : actionAvailable(),
    withSanction && sanctionAllowed.available && sanctionKind === ""
      ? actionBlocked(MODERATION_I18N_KEYS.verdictBlockedNoKind)
      : actionAvailable(),
    inFlight(state.step === "deciding", MODERATION_I18N_KEYS.verdictBlockedInFlight)
  );

  const runVerdict = useCallback((): void => {
    if (!verdictSubmit.available || caseId === undefined || decision === "") return;
    const sanction =
      withSanction && decision === "rejected" && sanctionKind !== ""
        ? {
            kind: sanctionKind,
            ...(durationMode === "custom"
              ? { durationSeconds }
              : {}),
            ...(scope.trim() !== "" ? { scope: scope.trim() } : {}),
            ...(reasonCode !== "" ? { reasonCode } : {}),
          }
        : undefined;
    runWrite(
      { step: "deciding" },
      () =>
        submitVerdict.mutateAsync({
          caseId,
          decision,
          ...(reasonCode !== "" ? { reasonCode } : {}),
          ...(note.trim() !== "" ? { note: note.trim() } : {}),
          ...(sanction !== undefined ? { sanction } : {}),
        }),
      () => ({ step: "resolved" })
    );
  }, [
    caseId,
    decision,
    durationMode,
    durationSeconds,
    note,
    reasonCode,
    runWrite,
    sanctionKind,
    scope,
    submitVerdict,
    verdictSubmit.available,
    withSanction,
  ]);

  return {
    detail,
    events: loadOf(eventsQuery),
    showEvents,
    setShowEvents,
    lease,
    resolved,
    claim,
    runClaim,
    release,
    runRelease,
    rescan,
    runRescan,
    state,
    refetch: useCallback(() => {
      void detailQuery.refetch();
    }, [detailQuery]),
    verdict: {
      decision,
      setDecision,
      reasonCode,
      setReasonCode,
      note,
      setNote,
      withSanction,
      setWithSanction,
      sanctionAllowed,
      sanctionKind,
      setSanctionKind,
      durationMode,
      setDurationMode,
      durationSeconds,
      setDurationSeconds,
      scope,
      setScope,
      submit: verdictSubmit,
      run: runVerdict,
    },
  };
}
