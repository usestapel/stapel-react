/**
 * The complaint bag: the policy, the draft, and the ONE gate that decides
 * whether "send" is a live control.
 *
 * ── Why the reason list is a load state and not an array ──────────────────
 *
 * The reasons come from `GET policy`, and a form built before they arrive
 * would offer nothing to pick; a form built from a FAILED read would offer
 * nothing and look identical. So the sheet renders `reasons` through the
 * substrate's arms, and the submit gate is blocked by `requireLoaded` until
 * the read actually succeeded — which is also what makes the "pick a reason"
 * reason honest: it can only be shown once there were reasons to pick.
 *
 * ── The refusal that repairs itself ───────────────────────────────────────
 *
 * `moderation_reason_not_applicable` means the policy moved under an open
 * sheet (backend 0.3.0 split it out of the "you invented a code" 400 exactly
 * so a client could tell the two apart). Nobody did anything wrong, so the bag
 * refetches the policy, clears the dead selection, and the sheet asks again.
 */
import { useCallback, useMemo, useState } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  mapLoad,
  requireLoaded,
  useActiveSessionStatus,
  useFlow,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { PolicyDisclosure, PolicyReason } from "../api/types.js";
import { createReportFlow, reasonStep, reportRefused } from "../flows/reportFlow.js";
import type { ReportFlowState } from "../flows/reportFlow.js";
import { MODERATION_I18N_KEYS } from "../i18n/keys.js";
import { useModerationAnalytics } from "../model/context.js";
import { loadOf, usePolicy, useSubmitReport } from "../model/queries.js";
import { isAlreadyReported, isReasonNotApplicable } from "../model/refusals.js";

/** What {@link useReportPolicy} hands a screen that only reads the rules. */
export interface ReportPolicyBag {
  readonly policy: LoadState<PolicyDisclosure>;
  readonly reasons: LoadState<readonly PolicyReason[]>;
  readonly refetch: () => void;
}

/**
 * The public disclosure, on its own. Anonymous-safe: this is the module's only
 * `AllowAny` route, so a visitor reads the rules before being asked to sign in.
 */
export function useReportPolicy(targetType = ""): ReportPolicyBag {
  const query = usePolicy(targetType);
  const policy = loadOf(query);
  return {
    policy,
    reasons: mapLoad(policy, (disclosure) => disclosure.reasons),
    refetch: useCallback(() => {
      void query.refetch();
    }, [query]),
  };
}

export interface UseReportOptions {
  readonly targetType: string;
  /** The host's opaque id for the thing. Never parsed by the module. */
  readonly targetKey: string;
  readonly scopeKey?: string;
}

/** Everything the report sheet renders and every reason it may be blocked. */
export interface ReportBag {
  readonly policy: LoadState<PolicyDisclosure>;
  readonly reasons: LoadState<readonly PolicyReason[]>;
  /** Art. 15(1)(e): the deployment screens automatically, and says so. */
  readonly automatedScreening: boolean;
  readonly reasonCode: string;
  readonly setReasonCode: (code: string) => void;
  readonly description: string;
  readonly setDescription: (text: string) => void;
  /** The picked reason demands an explanation (`requires_description`). */
  readonly descriptionRequired: boolean;
  readonly goodFaith: boolean;
  readonly setGoodFaith: (value: boolean) => void;
  /** Settled "there is no session" — not "we have not looked yet". */
  readonly visitor: boolean;
  readonly submit: ActionAvailability;
  readonly run: () => void;
  readonly state: ReportFlowState;
  readonly refetchPolicy: () => void;
  readonly reset: () => void;
}

/** The reason a code names, once the policy is actually loaded. */
function pickReason(
  policy: LoadState<PolicyDisclosure>,
  code: string
): PolicyReason | undefined {
  if (policy.status !== "ready" || code === "") return undefined;
  return policy.data.reasons.find((reason) => reason.code === code);
}

export function useReport(options: UseReportOptions): ReportBag {
  const analytics = useModerationAnalytics();
  const machine = useMemo(() => createReportFlow({ analytics }), [analytics]);
  const state = useFlow(machine);
  const query = usePolicy(options.targetType);
  const policy = loadOf(query);
  const submitReport = useSubmitReport();
  const sessionStatus = useActiveSessionStatus();

  const [reasonCode, setReasonCodeState] = useState("");
  const [description, setDescriptionState] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  // A 409 is not a fault: it is a fact about this target that outlives the
  // request, so it is remembered rather than re-derived from the last error.
  const [alreadyReported, setAlreadyReported] = useState(false);

  const selected = pickReason(policy, reasonCode);
  const descriptionRequired = selected?.requires_description === true;
  // `null` means no module here tracks sessions at all, which is a different
  // fact from "there is no session" and must not gate the control.
  const visitor =
    sessionStatus === "anonymous" || sessionStatus === "unauthenticated";

  const refetchPolicy = useCallback(() => {
    void query.refetch();
  }, [query]);

  const setReasonCode = useCallback(
    (code: string): void => {
      setReasonCodeState(code);
      const next = pickReason(policy, code);
      machine.to(reasonStep(code, next?.requires_description === true, description));
    },
    [description, machine, policy]
  );

  const setDescription = useCallback(
    (text: string): void => {
      setDescriptionState(text);
      if (reasonCode !== "") {
        machine.to(reasonStep(reasonCode, descriptionRequired, text));
      }
    },
    [descriptionRequired, machine, reasonCode]
  );

  const submit = firstBlock(
    visitor ? actionBlocked(MODERATION_I18N_KEYS.reportBlockedVisitor) : actionAvailable(),
    alreadyReported
      ? actionBlocked(MODERATION_I18N_KEYS.reportBlockedReported)
      : actionAvailable(),
    requireLoaded(policy, () => actionAvailable()),
    reasonCode === ""
      ? actionBlocked(MODERATION_I18N_KEYS.reportBlockedNoReason)
      : actionAvailable(),
    descriptionRequired && description.trim() === ""
      ? actionBlocked(MODERATION_I18N_KEYS.reportBlockedDescription)
      : actionAvailable(),
    state.step === "submitting"
      ? actionBlocked(MODERATION_I18N_KEYS.reportBlockedInFlight)
      : actionAvailable()
  );

  const run = useCallback((): void => {
    if (!submit.available) return;
    const trimmed = description.trim();
    void machine.run(
      { step: "submitting", reasonCode },
      () =>
        submitReport.mutateAsync({
          targetType: options.targetType,
          targetKey: options.targetKey,
          reasonCode,
          goodFaith,
          ...(trimmed !== "" ? { description: trimmed } : {}),
          ...(options.scopeKey !== undefined ? { scopeKey: options.scopeKey } : {}),
        }),
      {
        resolve: (result) => ({
          step: "accepted" as const,
          caseRef: result.case_ref ?? "",
        }),
        reject: (error) => {
          if (isAlreadyReported(error)) setAlreadyReported(true);
          if (isReasonNotApplicable(error)) {
            // The form was built from a policy that has since changed: reload
            // it and drop the dead selection, rather than telling somebody
            // their answer was wrong.
            setReasonCodeState("");
            refetchPolicy();
          }
          return reportRefused(error);
        },
      }
    );
  }, [
    description,
    goodFaith,
    machine,
    options.scopeKey,
    options.targetKey,
    options.targetType,
    reasonCode,
    refetchPolicy,
    submit.available,
    submitReport,
  ]);

  const reset = useCallback((): void => {
    setReasonCodeState("");
    setDescriptionState("");
    setGoodFaith(false);
    machine.to({ step: "choosing_reason" });
  }, [machine]);

  return {
    policy,
    reasons: mapLoad(policy, (disclosure) => disclosure.reasons),
    automatedScreening:
      policy.status === "ready" && policy.data.automated_means.enabled,
    reasonCode,
    setReasonCode,
    description,
    setDescription,
    descriptionRequired,
    goodFaith,
    setGoodFaith,
    visitor,
    submit,
    run,
    state,
    refetchPolicy,
    reset,
  };
}
