import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useFlow } from "@stapel/core";
import { createInviteAcceptFlow } from "../flows/inviteAcceptFlow.js";
import type { InviteAcceptState } from "../flows/inviteAcceptFlow.js";
import type { Member } from "../api/types.js";
import { useWorkspacesAnalytics, useWorkspacesApi } from "../model/context.js";

/** Render-prop bag for {@link InviteAcceptFlow}. */
export interface InviteAcceptFlowBag {
  readonly state: InviteAcceptState;
  /** From `newUser`/`claimError`: mint the login grant. */
  claim(): void;
  /** From `loginRequired`/`wrongAccount`: a session now exists — re-route on
   * its email. (Also fired automatically when the `sessionEmail` prop
   * becomes non-null while parked in either step.) */
  sessionEstablished(email: string): void;
  /** From `grantIssued`: the host exchanged the grant at auth. */
  grantExchanged(): void;
  /** From `basicData`: the initial-setup slot finished. */
  completeBasicData(): void;
  accept(): void;
  decline(): void;
  /** Re-fetch the preview and re-route (e.g. after a logout on wrongAccount). */
  reload(): void;
}

/**
 * Headless `/invite/{token}` journey (org-program §B4) — the flow machine
 * (`flows/inviteAcceptFlow.ts`, see ITS doc for the full state graph and the
 * grant_token hand-off seam) wired to this pair's runtime. Renderless: every
 * screen (accept modal, wrong-account, the login and initial-setup SLOTS) is
 * the host's; the default `InviteAcceptPage` is the reference skin.
 *
 * The pair knows nothing about auth: pass the signed-in email (or null) as
 * `sessionEmail`, and connect `onLoginGrant` to auth-react's
 * `exchangeLoginGrant` yourself — then call `grantExchanged()`.
 */
export function InviteAcceptFlow(props: {
  /** The invite token from the URL — a bearer secret, never log it. */
  token: string;
  /** The signed-in account's email, or null/undefined when no session. */
  sessionEmail?: string | null;
  children: (bag: InviteAcceptFlowBag) => ReactNode;
  /** The grant_token hand-off (a credential — exchange, never log). */
  onLoginGrant?: (grantToken: string) => void;
  onAccepted?: (member: Member) => void;
  onDeclined?: () => void;
}): ReactNode {
  const api = useWorkspacesApi();
  const analytics = useWorkspacesAnalytics();
  const sessionEmail = props.sessionEmail ?? null;
  const { token, onLoginGrant, onAccepted, onDeclined } = props;
  const flow = useMemo(
    () =>
      createInviteAcceptFlow({
        api,
        analytics,
        token,
        ...(onLoginGrant !== undefined ? { onLoginGrant } : {}),
        ...(onAccepted !== undefined ? { onAccepted } : {}),
        ...(onDeclined !== undefined ? { onDeclined } : {}),
      }),
    [api, analytics, token, onLoginGrant, onAccepted, onDeclined]
  );
  const state = useFlow(flow.machine);

  // Initial load — once per flow instance (a new token remounts the memo).
  useEffect(() => {
    if (flow.machine.getState().step === "idle") {
      void flow.load(sessionEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionEmail is read once at load time by design; later session changes re-route via the dedicated effect below, not a re-load
  }, [flow]);

  // Auto hand-off: the host's login slot signed the user in while we were
  // parked in `loginRequired`/`wrongAccount` — re-route without requiring the
  // host to call `sessionEstablished` manually.
  useEffect(() => {
    if (sessionEmail === null || sessionEmail === "") return;
    const step = flow.machine.getState().step;
    if (step === "loginRequired" || step === "wrongAccount") {
      flow.sessionEstablished(sessionEmail);
    }
  }, [flow, sessionEmail, state.step]);

  return props.children({
    state,
    claim: () => {
      void flow.claim();
    },
    sessionEstablished: flow.sessionEstablished,
    grantExchanged: flow.grantExchanged,
    completeBasicData: flow.completeBasicData,
    accept: () => {
      void flow.accept();
    },
    decline: () => {
      void flow.decline();
    },
    reload: () => {
      void flow.load(sessionEmail);
    },
  });
}
