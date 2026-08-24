/**
 * The complaint flow (`reportFlow`) — a client machine, because the backend
 * annotates no `@flow_step` and `docs/flows.json` is literally `[]`.
 *
 * The order of steps is not a UX preference: it mirrors
 * `services.submit_report` (services.py:548-562), which resolves the target
 * type FIRST, then the reason, then asks whether that reason
 * `requires_description`. A form that let somebody type an explanation before
 * choosing a reason would collect text the service is about to refuse — and,
 * unlike legacy, this backend refuses rather than silently erasing it.
 */
import { createFlowMachine } from "@stapel/core";
import type { Analytics, FlowError, FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";

/** The complaint machine's states. */
export type ReportFlowState =
  /** Nothing picked yet — the sheet is showing the policy. */
  | { readonly step: "choosing_reason" }
  /** A reason that demands an explanation is picked and the box is empty. */
  | { readonly step: "describing"; readonly reasonCode: string }
  /** Ready: a reason is picked and any required explanation is written. */
  | { readonly step: "ready"; readonly reasonCode: string }
  | { readonly step: "submitting"; readonly reasonCode: string }
  /** Accepted. `caseRef` is the short reference a person quotes at support —
   * deliberately not the case id, which they may not read. */
  | { readonly step: "accepted"; readonly caseRef: string }
  | { readonly step: "refused"; readonly error: FlowError };

export interface ReportFlowOptions {
  readonly analytics?: Analytics | null;
}

export const REPORT_FLOW_ID = "moderation.report";

export function createReportFlow(
  options: ReportFlowOptions = {}
): FlowMachine<ReportFlowState> {
  return createFlowMachine<ReportFlowState>({
    id: REPORT_FLOW_ID,
    initial: { step: "choosing_reason" },
    ...(options.analytics !== undefined ? { analytics: options.analytics } : {}),
  });
}

/**
 * Where the machine rests once a reason is picked: `describing` while a
 * required explanation is missing, `ready` otherwise.
 *
 * This is the ONE rule the sheet's submit gate reads, so "required" cannot
 * mean one thing in the button and another in the asterisk.
 */
export function reasonStep(
  reasonCode: string,
  requiresDescription: boolean,
  description: string
): ReportFlowState {
  return requiresDescription && description.trim() === ""
    ? { step: "describing", reasonCode }
    : { step: "ready", reasonCode };
}

/** Fold a thrown value into the machine's refusal state. */
export function reportRefused(error: unknown): ReportFlowState {
  return { step: "refused", error: toFlowError(error) };
}
