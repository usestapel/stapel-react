/**
 * Zero-flow registry shim (slim wave §21/S3). stapel-gdpr annotates no
 * `@flow_step` — its backend `docs/flows.json` is literally `[]` — so
 * `gen:flows` emits nothing for this pair (no `flows/generated/`
 * scaffolding). This hand-written shim preserves the pair's public
 * flow-registry surface at its zero-flow shape.
 *
 * Nothing here is missing a machine, either: account closure LOOKS like a
 * multi-step flow and is not one. Its steps are a 30-day grace period and a
 * sweep task on the server; the client makes one call to start it, one to call
 * it off, and otherwise READS state that moves without it. A flow machine
 * would be a client-side model of a clock it does not own.
 *
 * When the backend annotates flows, `pnpm gen:flows` emits
 * `./generated/flows.gen.ts` again — replace these exports with re-exports
 * from it (the shapes match by construction) and delete this file.
 */
export const GDPR_FLOWS = {} as const;

/** Canonical flow ids present in flows.json (none — see above). */
export type GdprFlowId = keyof typeof GDPR_FLOWS;

export type GdprFlowSpec = (typeof GDPR_FLOWS)[GdprFlowId];

export interface FlowEndpoint {
  readonly method: string;
  readonly path: string;
}

/** All HTTP endpoints a flow touches, in step order (for the contract test / MSW). */
export function flowEndpoints(id: GdprFlowId): readonly FlowEndpoint[] {
  // Same widened body as the generated registry's — valid for the zero-flow
  // shape AND correct once flows exist.
  const spec = GDPR_FLOWS[id] as
    | { readonly steps: readonly { readonly endpoints: readonly FlowEndpoint[] }[] }
    | undefined;
  return spec ? spec.steps.flatMap((s) => s.endpoints) : [];
}
