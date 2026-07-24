import type { Analytics } from "@stapel/core";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import type { WorkspacesApi } from "../api/workspacesApi.js";
import type { InvitationPreview, Member } from "../api/types.js";
import { emailMatchesMask } from "../model/emailMask.js";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * The `/invite/{token}` journey (org-program §B4) as a flow machine:
 *
 * ```
 * preview → (session && email match)      → acceptPrompt [accept/decline]
 *         → (session && email mismatch)   → wrongAccount (logout CTA)
 *         → (no session, email_registered)→ loginRequired (host's login slot)
 *         → (no session, new user)        → newUser → claim →
 *              grantIssued (grant_token handed OUT) → [host exchanges at auth]
 *              → basicData (host's initial-setup slot) → acceptPrompt
 * ```
 *
 * Non-`pending` invitations (expired / revoked / accepted / declined) park in
 * the terminal `unavailable` step — the page renders the matching copy.
 *
 * ## The grant_token seam (deliberate pair boundary)
 *
 * `claim` mints a login grant that must be exchanged at AUTH's
 * `POST /grant/exchange/` — an endpoint of the auth pair, and pairs do NOT
 * depend on each other (no auth-react peer dependency here). The flow
 * therefore parks in `grantIssued` and hands `grantToken` OUT via the
 * `onLoginGrant` callback; the HOST connects the two pairs:
 *
 * ```tsx
 * <InviteAcceptFlow token={token}
 *   onLoginGrant={async (grant) => {
 *     const r = await authApi.exchangeLoginGrant(grant); // auth-react
 *     session.adopt(r);                                  // full session
 *   }}>
 * ```
 *
 * then calls `grantExchanged()` (the default `InviteAcceptPage` does this
 * automatically when the host's `onLoginGrant` promise resolves), which moves
 * the flow to `basicData` — the host's profiles-react `InitialSetupPrompt`
 * slot — and `completeBasicData()` finally reaches `acceptPrompt`. The
 * account created by the exchange IS the invited email's account (verified by
 * construction), so no re-match happens on that path.
 *
 * ## Session/email detection
 *
 * The pair has no auth dependency, so the CALLER supplies the signed-in
 * email (`sessionEmail`, e.g. auth-react's `useAuthSessionState().user?.email`
 * — or any other session source; null/undefined = no session). Match against
 * the preview's MASKED email is decided client-side by masking the known
 * email with the same algorithm (see `model/emailMask.ts`); the backend's
 * real email-match on accept/decline stays the enforcement point — a mask
 * collision merely shows the prompt, the accept then surfaces the 403.
 */
export type InviteAcceptState =
  | { readonly step: "idle" }
  | { readonly step: "loadingPreview" }
  | { readonly step: "previewError"; readonly error: FlowError }
  /** Terminal: the invitation is not pending (expired/revoked/accepted/declined). */
  | {
      readonly step: "unavailable";
      readonly preview: InvitationPreview;
      readonly status: string;
    }
  /** Signed in with a non-matching account — logout CTA (host slot). */
  | { readonly step: "wrongAccount"; readonly preview: InvitationPreview }
  /** No session, account exists — the host's login slot; call
   * `sessionEstablished(email)` once signed in. */
  | { readonly step: "loginRequired"; readonly preview: InvitationPreview }
  /** No session, no account — deliberate CTA before minting the grant. */
  | { readonly step: "newUser"; readonly preview: InvitationPreview }
  | { readonly step: "claiming"; readonly preview: InvitationPreview }
  | {
      readonly step: "claimError";
      readonly preview: InvitationPreview;
      readonly error: FlowError;
    }
  /** The grant is out via `onLoginGrant` — waiting for the host to exchange
   * it at auth and call `grantExchanged()`. */
  | {
      readonly step: "grantIssued";
      readonly preview: InvitationPreview;
      readonly grantToken: string;
    }
  /** Host's basic-data slot (profiles-react InitialSetupPrompt canon, §B5). */
  | { readonly step: "basicData"; readonly preview: InvitationPreview }
  | { readonly step: "acceptPrompt"; readonly preview: InvitationPreview }
  | { readonly step: "accepting"; readonly preview: InvitationPreview }
  | { readonly step: "declining"; readonly preview: InvitationPreview }
  | {
      readonly step: "acceptError";
      readonly preview: InvitationPreview;
      readonly error: FlowError;
    }
  | {
      readonly step: "accepted";
      readonly member: Member;
      readonly preview: InvitationPreview;
    }
  | { readonly step: "declined"; readonly preview: InvitationPreview };

export interface InviteAcceptFlow {
  readonly machine: FlowMachine<InviteAcceptState>;
  /** Fetch the preview and route per §B4. `sessionEmail` = the signed-in
   * account's email, or null when there is no session. */
  load(sessionEmail: string | null): Promise<void>;
  /** From `newUser`/`claimError`: mint the login grant (`onLoginGrant` fires
   * with the token; the flow parks in `grantIssued`). */
  claim(): Promise<void>;
  /** From `loginRequired`/`wrongAccount`: a session now exists (host's login
   * slot finished, or the user switched accounts) — re-route on its email. */
  sessionEstablished(email: string): void;
  /** From `grantIssued`: the host exchanged the grant at auth — proceed to
   * the basic-data step. */
  grantExchanged(): void;
  /** From `basicData`: the initial-setup slot finished — show the accept prompt. */
  completeBasicData(): void;
  accept(): Promise<void>;
  decline(): Promise<void>;
  reset(): void;
}

export interface InviteAcceptFlowDeps {
  readonly api: WorkspacesApi;
  /** The invite token from the `/invite/{token}` URL — a bearer secret. */
  readonly token: string;
  readonly analytics?: Analytics | null;
  /** The grant_token hand-off seam (see the module doc). A credential:
   * exchange it, never log it. */
  readonly onLoginGrant?: (grantToken: string) => void;
  readonly onAccepted?: (member: Member) => void;
  readonly onDeclined?: () => void;
}

/**
 * Flow id: stapel-workspaces annotates no `@flow_step` yet (its
 * `docs/flows.json` is empty — the pair's flow registry is the zero-flow
 * shim), so this id is pair-local until the backend documents the flow;
 * switch to the generated registry id when it lands.
 */
const FLOW_ID = "workspaces.invite_accept";

function routeSignedIn(
  preview: InvitationPreview,
  email: string
): InviteAcceptState {
  return emailMatchesMask(email, preview.email_masked)
    ? { step: "acceptPrompt", preview }
    : { step: "wrongAccount", preview };
}

function routePreview(
  preview: InvitationPreview,
  sessionEmail: string | null
): InviteAcceptState {
  if (preview.status !== "pending") {
    return { step: "unavailable", preview, status: preview.status };
  }
  if (sessionEmail !== null && sessionEmail !== "") {
    return routeSignedIn(preview, sessionEmail);
  }
  return preview.email_registered
    ? { step: "loginRequired", preview }
    : { step: "newUser", preview };
}

export function createInviteAcceptFlow(
  deps: InviteAcceptFlowDeps
): InviteAcceptFlow {
  const machine = createFlowMachine<InviteAcceptState>({
    id: FLOW_ID,
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function load(sessionEmail: string | null): Promise<void> {
    await machine.run(
      { step: "loadingPreview" },
      () => deps.api.getInvitationPreview(deps.token),
      {
        resolve: (preview) => routePreview(preview, sessionEmail),
        reject: (error): InviteAcceptState => ({
          step: "previewError",
          error: toFlowError(error),
        }),
      }
    );
  }

  async function claim(): Promise<void> {
    const s = machine.getState();
    if (s.step !== "newUser" && s.step !== "claimError") return;
    const { preview } = s;
    await machine.run(
      { step: "claiming", preview },
      () => deps.api.claimInvitation(deps.token),
      {
        resolve: (r): InviteAcceptState => {
          deps.onLoginGrant?.(r.grant_token);
          return { step: "grantIssued", preview, grantToken: r.grant_token };
        },
        reject: (error): InviteAcceptState => ({
          step: "claimError",
          preview,
          error: toFlowError(error),
        }),
      }
    );
  }

  function sessionEstablished(email: string): void {
    const s = machine.getState();
    if (s.step !== "loginRequired" && s.step !== "wrongAccount") return;
    machine.to(routeSignedIn(s.preview, email));
  }

  function grantExchanged(): void {
    const s = machine.getState();
    if (s.step !== "grantIssued") return;
    machine.to({ step: "basicData", preview: s.preview });
  }

  function completeBasicData(): void {
    const s = machine.getState();
    if (s.step !== "basicData") return;
    machine.to({ step: "acceptPrompt", preview: s.preview });
  }

  async function accept(): Promise<void> {
    const s = machine.getState();
    if (s.step !== "acceptPrompt" && s.step !== "acceptError") return;
    const { preview } = s;
    await machine.run(
      { step: "accepting", preview },
      () => deps.api.acceptInvitation({ token: deps.token }),
      {
        resolve: (member): InviteAcceptState => {
          deps.onAccepted?.(member);
          return { step: "accepted", member, preview };
        },
        reject: (error): InviteAcceptState => ({
          step: "acceptError",
          preview,
          error: toFlowError(error),
        }),
      }
    );
  }

  async function decline(): Promise<void> {
    const s = machine.getState();
    if (s.step !== "acceptPrompt" && s.step !== "acceptError") return;
    const { preview } = s;
    await machine.run(
      { step: "declining", preview },
      () => deps.api.declineInvitation(deps.token),
      {
        resolve: (): InviteAcceptState => {
          deps.onDeclined?.();
          return { step: "declined", preview };
        },
        reject: (error): InviteAcceptState => ({
          step: "acceptError",
          preview,
          error: toFlowError(error),
        }),
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return {
    machine,
    load,
    claim,
    sessionEstablished,
    grantExchanged,
    completeBasicData,
    accept,
    decline,
    reset,
  };
}
