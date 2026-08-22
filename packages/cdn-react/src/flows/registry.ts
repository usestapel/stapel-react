/**
 * Zero-flow registry shim. stapel-cdn annotates no `@flow_step`: its
 * `docs/flows.json` is an empty array, so `gen:flows` skips emission for this
 * pair (no `flows/generated/`). This hand-written shim preserves the pair's
 * public flow-registry surface at its zero-flow shape.
 *
 * That is not an oversight upstream, and it is worth saying once: an upload is
 * multi-step on the CLIENT (hash → check → POST → wait for variants) but each
 * of those steps is an independent endpoint call the server does not sequence.
 * There is no server-declared funnel here, and inventing one would be a
 * frontend fiction in a machine-readable artifact. `model/upload.ts` is where
 * this pair's real state machine lives.
 *
 * When the backend annotates flows, `pnpm gen:flows` emits
 * `./generated/flows.gen.ts` again — replace these exports with re-exports
 * from it (the shapes match by construction) and delete this file.
 */
export const CDN_FLOWS = {} as const;

/** Canonical flow ids present in flows.json (none yet — see above). */
export type CdnFlowId = keyof typeof CDN_FLOWS;

export type CdnFlowSpec = (typeof CDN_FLOWS)[CdnFlowId];

export interface FlowEndpoint {
  readonly method: string;
  readonly path: string;
}

/** All HTTP endpoints a flow touches, in step order (for the contract test). */
export function flowEndpoints(id: CdnFlowId): readonly FlowEndpoint[] {
  // Same widened body as the generated registry's — valid for the zero-flow
  // shape AND correct once flows exist.
  const spec = CDN_FLOWS[id] as
    | { readonly steps: readonly { readonly endpoints: readonly FlowEndpoint[] }[] }
    | undefined;
  return spec ? spec.steps.flatMap((s) => s.endpoints) : [];
}
