/**
 * Zero-flow registry shim (slim wave §21/S3). stapel-currencies annotates no
 * `@flow_step` yet — its backend `docs/flows.json` carries no `currencies.*`
 * flows, so `gen:flows` skips emission for this pair (no `flows/generated/`
 * scaffolding). This hand-written shim preserves the pair's public
 * flow-registry surface at its zero-flow shape.
 *
 * When the backend annotates flows, `pnpm gen:flows` emits
 * `./generated/flows.gen.ts` again — replace these exports with re-exports
 * from it (the shapes match by construction) and delete this file.
 */
export const CURRENCIES_FLOWS = {} as const;

/** Canonical flow ids present in flows.json (none yet — see above). */
export type CurrenciesFlowId = keyof typeof CURRENCIES_FLOWS;

export type CurrenciesFlowSpec = (typeof CURRENCIES_FLOWS)[CurrenciesFlowId];

export interface FlowEndpoint {
  readonly method: string;
  readonly path: string;
}

/** All HTTP endpoints a flow touches, in step order (for the contract test / MSW). */
export function flowEndpoints(id: CurrenciesFlowId): readonly FlowEndpoint[] {
  // Same widened body as the generated registry's — valid for the zero-flow
  // shape AND correct once flows exist.
  const spec = CURRENCIES_FLOWS[id] as
    | { readonly steps: readonly { readonly endpoints: readonly FlowEndpoint[] }[] }
    | undefined;
  return spec ? spec.steps.flatMap((s) => s.endpoints) : [];
}
