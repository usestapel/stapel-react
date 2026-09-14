/**
 * Zero-flow registry shim (slim wave §21/S3). stapel-alerts annotates no
 * `@flow_step` — its `docs/flows.json` is an empty array, so `gen:flows` skips
 * emission for this pair (no `flows/generated/` scaffolding at all). This
 * hand-written shim preserves the pair's public flow-registry surface at its
 * zero-flow shape.
 *
 * When the backend annotates flows, `pnpm gen:flows` emits
 * `./generated/flows.gen.ts` again — replace these exports with re-exports
 * from it (the shapes match by construction) and delete this file.
 */
export const ALERTS_FLOWS = {} as const;

/** Canonical flow ids present in flows.json (none yet — see above). */
export type AlertsFlowId = keyof typeof ALERTS_FLOWS;

export type AlertsFlowSpec = (typeof ALERTS_FLOWS)[AlertsFlowId];

export interface FlowEndpoint {
  readonly method: string;
  readonly path: string;
}

/** All HTTP endpoints a flow touches, in step order (for the contract test / MSW). */
export function flowEndpoints(id: AlertsFlowId): readonly FlowEndpoint[] {
  // Same widened body as the generated registry's — valid for the zero-flow
  // shape AND correct once flows exist.
  const spec = ALERTS_FLOWS[id] as
    | { readonly steps: readonly { readonly endpoints: readonly FlowEndpoint[] }[] }
    | undefined;
  return spec ? spec.steps.flatMap((s) => s.endpoints) : [];
}
