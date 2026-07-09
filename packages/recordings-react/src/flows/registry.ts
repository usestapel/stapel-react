/**
 * Zero-flow registry shim (slim wave §21/S3). stapel-recordings annotates no
 * `@flow_step` yet — its backend `docs/flows.json` carries no `recordings.*`
 * flows, so `gen:flows` skips emission for this pair (no `flows/generated/`
 * scaffolding). This hand-written shim preserves the pair's public
 * flow-registry surface at its zero-flow shape.
 *
 * When the backend annotates flows, `pnpm gen:flows` emits
 * `./generated/flows.gen.ts` again — replace these exports with re-exports
 * from it (the shapes match by construction) and delete this file.
 */
export const RECORDINGS_FLOWS = {} as const;

/** Canonical flow ids present in flows.json (none yet — see above). */
export type RecordingsFlowId = keyof typeof RECORDINGS_FLOWS;

export type RecordingsFlowSpec = (typeof RECORDINGS_FLOWS)[RecordingsFlowId];

export interface FlowEndpoint {
  readonly method: string;
  readonly path: string;
}

/** All HTTP endpoints a flow touches, in step order (for the contract test / MSW). */
export function flowEndpoints(id: RecordingsFlowId): readonly FlowEndpoint[] {
  // Same widened body as the generated registry's — valid for the zero-flow
  // shape AND correct once flows exist.
  const spec = RECORDINGS_FLOWS[id] as
    | { readonly steps: readonly { readonly endpoints: readonly FlowEndpoint[] }[] }
    | undefined;
  return spec ? spec.steps.flatMap((s) => s.endpoints) : [];
}
