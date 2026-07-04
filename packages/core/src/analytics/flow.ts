import type { Analytics } from "./types.js";

export type FlowStepPhase = "started" | "completed" | "failed";

/**
 * Auto-instrumentation seam for flow machines (analytics-standard §1.2):
 * emits `flow.<flowId>.<stepId>` with `{phase, ...props}`. Funnel = flow —
 * the `@stapel/<module>-react` machines call this on every transition, so
 * funnels exist without hand-written instrumentation.
 */
export function trackFlowStep(
  analytics: Analytics,
  flowId: string,
  stepId: string,
  phase: FlowStepPhase,
  props?: Record<string, unknown>
): void {
  analytics.track(`flow.${flowId}.${stepId}`, { phase, ...props });
}
