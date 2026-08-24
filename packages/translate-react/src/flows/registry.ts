/**
 * Zero-flow registry shim (slim wave §21/S3). stapel-translate annotates no
 * `@flow_step` yet — its backend `docs/flows.json` carries no `translate.*`
 * flows, so `gen:flows` skips emission for this pair (no `flows/generated/`
 * scaffolding). This hand-written shim preserves the pair's public
 * flow-registry surface at its zero-flow shape.
 *
 * When the backend annotates flows, `pnpm gen:flows` emits
 * `./generated/flows.gen.ts` again — replace these exports with re-exports
 * from it (the shapes match by construction) and delete this file.
 */
export const TRANSLATE_FLOWS = {} as const;

/** Canonical flow ids present in flows.json (none yet — see above). */
export type TranslateFlowId = keyof typeof TRANSLATE_FLOWS;

export type TranslateFlowSpec = (typeof TRANSLATE_FLOWS)[TranslateFlowId];

export interface FlowEndpoint {
  readonly method: string;
  readonly path: string;
}

/** All HTTP endpoints a flow touches, in step order (for the contract test / MSW). */
export function flowEndpoints(id: TranslateFlowId): readonly FlowEndpoint[] {
  // Same widened body as the generated registry's — valid for the zero-flow
  // shape AND correct once flows exist.
  const spec = TRANSLATE_FLOWS[id] as
    | { readonly steps: readonly { readonly endpoints: readonly FlowEndpoint[] }[] }
    | undefined;
  return spec ? spec.steps.flatMap((s) => s.endpoints) : [];
}
