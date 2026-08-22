/**
 * Zero-flow registry shim. stapel-listings annotates no `@flow_step`: its
 * `docs/flows.json` is an empty array, so `gen:flows` skips emission for this
 * pair (no `flows/generated/`). This hand-written shim preserves the pair's
 * public flow-registry surface at its zero-flow shape — the stapel-chat /
 * stapel-cdn / stapel-categories precedent, three directories over.
 *
 * Submitting a listing IS multi-step, and it is worth saying why that does
 * not contradict the empty artifact. The steps —
 *
 *     create draft → save draft (repeatedly) → validate → publish
 *
 * — are four independent endpoint calls that the server does not sequence:
 * nothing on the backend remembers that a `save-draft` was part of a
 * submission, `publish` may be called on a draft created a week ago, and
 * `validate-draft` is optional. A `@flow_step`-annotated funnel would be a
 * frontend fiction in a machine-readable artifact. The pair's real state
 * machine lives in `headless/ListingComposer.tsx`, and its stages are named
 * there ({@link ComposeStage}) so analytics can still follow the funnel.
 *
 * When the backend annotates flows, `pnpm gen:flows` emits
 * `./generated/flows.gen.ts` again — replace these exports with re-exports
 * from it (the shapes match by construction) and delete this file.
 */
export const LISTINGS_FLOWS = {} as const;

/** Canonical flow ids present in flows.json (none yet — see above). */
export type ListingsFlowId = keyof typeof LISTINGS_FLOWS;

export type ListingsFlowSpec = (typeof LISTINGS_FLOWS)[ListingsFlowId];

export interface FlowEndpoint {
  readonly method: string;
  readonly path: string;
}

/** All HTTP endpoints a flow touches, in step order (for the contract test). */
export function flowEndpoints(id: ListingsFlowId): readonly FlowEndpoint[] {
  // Same widened body as the generated registry's — valid for the zero-flow
  // shape AND correct once flows exist.
  const spec = LISTINGS_FLOWS[id] as
    | { readonly steps: readonly { readonly endpoints: readonly FlowEndpoint[] }[] }
    | undefined;
  return spec ? spec.steps.flatMap((step) => step.endpoints) : [];
}
