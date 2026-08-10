/**
 * Zero-flow registry shim (slim wave §21/S3). stapel-docs annotates no
 * `@flow_step` yet — and emits no `docs/flows.json` at all (the contract
 * artifacts are still pending; see `api/types.ts`), so `gen:flows` has
 * nothing to generate for this pair. This hand-written shim preserves the
 * pair's public flow-registry surface at its zero-flow shape.
 *
 * When the backend annotates flows, `pnpm gen:flows` emits
 * `./generated/flows.gen.ts` — replace these exports with re-exports from it
 * (the shapes match by construction) and delete this file.
 */
export const DOCS_FLOWS = {} as const;

/** Canonical flow ids present in flows.json (none yet — see above). */
export type DocsFlowId = keyof typeof DOCS_FLOWS;

export type DocsFlowSpec = (typeof DOCS_FLOWS)[DocsFlowId];

export interface FlowEndpoint {
  readonly method: string;
  readonly path: string;
}

/** All HTTP endpoints a flow touches, in step order (for the contract test / MSW). */
export function flowEndpoints(id: DocsFlowId): readonly FlowEndpoint[] {
  // Same widened body as the generated registry's — valid for the zero-flow
  // shape AND correct once flows exist.
  const spec = DOCS_FLOWS[id] as
    | { readonly steps: readonly { readonly endpoints: readonly FlowEndpoint[] }[] }
    | undefined;
  return spec ? spec.steps.flatMap((s) => s.endpoints) : [];
}
