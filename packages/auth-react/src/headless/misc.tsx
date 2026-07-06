import { useMemo } from "react";
import type { ReactNode } from "react";
import type { OtpChannel } from "../api/types.js";
import { createAnonymousFlow } from "../flows/anonymousFlow.js";
import type { AnonymousState } from "../flows/anonymousFlow.js";
import { createAuthenticatorChangeFlow } from "../flows/authenticatorChangeFlow.js";
import type { AuthenticatorChangeState } from "../flows/authenticatorChangeFlow.js";
import { createMagicLinkFlow } from "../flows/magicLinkFlow.js";
import type { MagicLinkState } from "../flows/magicLinkFlow.js";
import { createSsoFlow } from "../flows/ssoFlow.js";
import type { SsoState } from "../flows/ssoFlow.js";
import { useFlow } from "@stapel/core";
import { useAuthAnalytics, useAuthApi, useAuthSession } from "../model/context.js";

// ── Magic link ──────────────────────────────────────────────────────────────

export interface MagicLinkBag {
  readonly state: MagicLinkState;
  request(email: string, redirectUrl?: string): void;
  reset(): void;
}

/** Headless magic-link request (auth-sa.md §15). */
export function MagicLink(props: {
  children: (bag: MagicLinkBag) => ReactNode;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const flow = useMemo(
    () => createMagicLinkFlow({ api, analytics }),
    [api, analytics]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    request: (email, redirectUrl) => {
      void flow.request(email, redirectUrl);
    },
    reset: flow.reset,
  });
}

// ── Anonymous ────────────────────────────────────────────────────────────────

export interface AnonymousBag {
  readonly state: AnonymousState;
  create(deviceId?: string): void;
  reset(): void;
}

/** Headless anonymous session (auth-sa.md §6). */
export function AnonymousSession(props: {
  children: (bag: AnonymousBag) => ReactNode;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const session = useAuthSession();
  const flow = useMemo(
    () =>
      createAnonymousFlow({
        api,
        analytics,
        onAuthenticated: (r) => session.adopt(r),
      }),
    [api, analytics, session]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    create: (deviceId) => {
      void flow.create(deviceId);
    },
    reset: flow.reset,
  });
}

// ── SSO discovery ────────────────────────────────────────────────────────────

export interface SsoDiscoveryBag {
  readonly state: SsoState;
  lookup(domain: string): void;
  beginLogin(orgSlug: string): void;
  reset(): void;
}

/** Headless SSO domain discovery + login redirect (auth-sa.md §18). */
export function SsoDiscovery(props: {
  children: (bag: SsoDiscoveryBag) => ReactNode;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const flow = useMemo(
    () => createSsoFlow({ api, analytics }),
    [api, analytics]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    lookup: (domain) => {
      void flow.lookup(domain);
    },
    beginLogin: flow.beginLogin,
    reset: flow.reset,
  });
}

// ── Authenticator change (instant) ───────────────────────────────────────────

export interface AuthenticatorChangeBag {
  readonly state: AuthenticatorChangeState;
  startInstant(channel: OtpChannel): void;
  submitOldCode(code: string): void;
  requestNew(newValue: string): void;
  submitNewCode(code: string): void;
  reset(): void;
}

/** Headless instant email/phone change (auth-sa.md §9). */
export function AuthenticatorChange(props: {
  children: (bag: AuthenticatorChangeBag) => ReactNode;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const session = useAuthSession();
  const flow = useMemo(
    () =>
      createAuthenticatorChangeFlow({
        api,
        analytics,
        onAuthenticated: (r) => session.adopt(r),
      }),
    [api, analytics, session]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    startInstant: (channel) => {
      void flow.startInstant(channel);
    },
    submitOldCode: (code) => {
      void flow.submitOldCode(code);
    },
    requestNew: (newValue) => {
      void flow.requestNew(newValue);
    },
    submitNewCode: (code) => {
      void flow.submitNewCode(code);
    },
    reset: flow.reset,
  });
}
