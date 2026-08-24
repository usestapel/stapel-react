/**
 * The appeal flow (DSA Art. 20) — a client machine; the backend annotates no
 * flow steps.
 *
 * ── Why the panel needs a link, and cannot look one up ────────────────────
 *
 * An appeal is `POST appeals/ {case_id}`. The subject of a decision has NO
 * endpoint that lists the cases about them: `GET cases` is the moderator
 * queue (`HasModerationMandate`), and `GET cases/{id}` is too. So the case id
 * reaches a person exactly one way — the deep link in the takedown
 * notification (`?case=<uuid>`, the route `nav/manifest.ts` declares). Without
 * it the panel EXPLAINS that, rather than showing a text box that cannot be
 * submitted.
 */
import { createFlowMachine } from "@stapel/core";
import type { Analytics, FlowError, FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";

export type AppealFlowState =
  /** No `?case=` in the link: there is nothing to appeal against yet. */
  | { readonly step: "no_case" }
  | { readonly step: "writing"; readonly caseId: string }
  | { readonly step: "submitting"; readonly caseId: string }
  | { readonly step: "submitted"; readonly appealId: string }
  | { readonly step: "refused"; readonly error: FlowError };

export interface AppealFlowOptions {
  readonly caseId?: string;
  readonly analytics?: Analytics | null;
}

export const APPEAL_FLOW_ID = "moderation.appeal";

export function createAppealFlow(
  options: AppealFlowOptions = {}
): FlowMachine<AppealFlowState> {
  const initial: AppealFlowState =
    options.caseId !== undefined && options.caseId !== ""
      ? { step: "writing", caseId: options.caseId }
      : { step: "no_case" };
  return createFlowMachine<AppealFlowState>({
    id: APPEAL_FLOW_ID,
    initial,
    ...(options.analytics !== undefined ? { analytics: options.analytics } : {}),
  });
}

export function appealRefused(error: unknown): AppealFlowState {
  return { step: "refused", error: toFlowError(error) };
}
