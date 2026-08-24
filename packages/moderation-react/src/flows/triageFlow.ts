/**
 * The moderator's triage machine: claim → decide → resolved, with the two
 * detours the console actually meets (somebody else holds it; the case goes
 * back for another automatic screen).
 *
 * ── The lease is the whole reason this is a machine ───────────────────────
 *
 * `claim` writes `claimed_by` + `claimed_until` and the sweeper takes the case
 * back when the lease runs out — SILENTLY, server-side. So a console that
 * showed only "claimed" would let somebody write a verdict on a case that has
 * already returned to the queue and be refused at submit. The `claimed` state
 * therefore carries the expiry, and {@link leaseStatus} is the single place
 * that decides whether a lease is mine, somebody else's, or gone.
 *
 * ── Step-up is intercepted ONCE ───────────────────────────────────────────
 *
 * A HIGH-clearance write can answer `403 verification_required`. Core's client
 * runs the host's `VerificationChallengeHandler` and retries the request
 * exactly once; this machine's job is only to park in `verifying` while that
 * happens, so the console shows "confirm it is you" instead of a spinner that
 * means nothing.
 */
import { createFlowMachine } from "@stapel/core";
import type { Analytics, FlowError, FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";

export type TriageFlowState =
  /** In the queue, nobody holding it. */
  | { readonly step: "queued" }
  | { readonly step: "claiming" }
  /** Mine, until `until` (an ISO instant from the server). */
  | { readonly step: "claimed"; readonly until: string | null }
  /** Somebody else's, until `until`. `who` is an actor UUID. */
  | { readonly step: "claimed_by_other"; readonly who: string | null; readonly until: string | null }
  /** The lease ran out under us: the case is back in the queue server-side. */
  | { readonly step: "lease_expired" }
  | { readonly step: "deciding" }
  /** Core is running the host's step-up challenge for this write. */
  | { readonly step: "verifying" }
  | { readonly step: "resolved" }
  /** A rescan was accepted (202) and the case is screening again. */
  | { readonly step: "screening" }
  | { readonly step: "refused"; readonly error: FlowError };

export interface TriageFlowOptions {
  readonly analytics?: Analytics | null;
}

export const TRIAGE_FLOW_ID = "moderation.triage";

export function createTriageFlow(
  options: TriageFlowOptions = {}
): FlowMachine<TriageFlowState> {
  return createFlowMachine<TriageFlowState>({
    id: TRIAGE_FLOW_ID,
    initial: { step: "queued" },
    ...(options.analytics !== undefined ? { analytics: options.analytics } : {}),
  });
}

/** Who holds a case, from the reader's clock. */
export type LeaseStatus =
  | { readonly kind: "free" }
  | { readonly kind: "mine"; readonly until: string | null; readonly expired: boolean }
  | {
      readonly kind: "other";
      readonly who: string;
      readonly until: string | null;
      readonly expired: boolean;
    };

/**
 * Read the lease off a case row.
 *
 * `viewerId` is the host's answer to "who am I" — this module has no `/me` and
 * every actor on its wire is an opaque UUID. Without it a console cannot tell
 * its own lease from a colleague's, so the lease reads as somebody else's:
 * offering "release" for a case you may not hold is worse than not offering it.
 */
export function leaseStatus(
  input: {
    readonly claimed_by?: string | null;
    readonly claimed_until?: string | null;
  },
  viewerId: string | undefined,
  now: number
): LeaseStatus {
  const holder = input.claimed_by ?? null;
  if (holder === null || holder === "") return { kind: "free" };
  const until = input.claimed_until ?? null;
  const at = until !== null ? Date.parse(until) : Number.NaN;
  const expired = Number.isFinite(at) && at <= now;
  if (viewerId !== undefined && viewerId !== "" && holder === viewerId) {
    return { kind: "mine", until, expired };
  }
  return { kind: "other", who: holder, until, expired };
}

/** How often the rescan poll re-reads the case, and when it gives up. */
export const RESCAN_POLL_INTERVAL_MS = 3_000;
export const RESCAN_POLL_TIMEOUT_MS = 60_000;

export function triageRefused(error: unknown): TriageFlowState {
  return { step: "refused", error: toFlowError(error) };
}
