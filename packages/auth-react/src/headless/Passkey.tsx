import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  createPasskeyLoginFlow,
  createPasskeyRegistrationFlow,
} from "../flows/passkeyFlow.js";
import type {
  PasskeyLoginState,
  PasskeyRegisterState,
} from "../flows/passkeyFlow.js";
import { useFlow } from "@stapel/core";
import { useAuthAnalytics, useAuthApi, useAuthSession } from "../model/context.js";
import type { WebauthnBinding } from "../webauthn.js";

/**
 * Optional WebAuthn binding for the passkey headless components — an
 * OVERRIDE of the built-in browser one (`../webauthn.ts`), which is what runs
 * when this prop is omitted. Only environments with no
 * `navigator.credentials` fall back to the thin contract (park on
 * `awaiting*`, host calls `submit*` with a credential it obtained itself).
 */
export type { WebauthnBinding };

export interface PasskeyRegistrationBag {
  readonly state: PasskeyRegisterState;
  begin(deviceName?: string): void;
  submitCredential(credential: unknown): void;
  reset(): void;
}

/** Headless passkey registration (auth-sa.md §17, requires auth). */
export function PasskeyRegistration(props: {
  children: (bag: PasskeyRegistrationBag) => ReactNode;
  webauthnCreate?: WebauthnBinding;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const { webauthnCreate } = props;
  const flow = useMemo(
    () =>
      createPasskeyRegistrationFlow({
        api,
        analytics,
        ...(webauthnCreate !== undefined ? { webauthnCreate } : {}),
      }),
    [api, analytics, webauthnCreate]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    begin: (deviceName) => {
      void flow.begin(deviceName);
    },
    submitCredential: (credential) => {
      void flow.submitCredential(credential);
    },
    reset: flow.reset,
  });
}

export interface PasskeyLoginBag {
  readonly state: PasskeyLoginState;
  begin(email?: string): void;
  submitAssertion(credential: unknown): void;
  reset(): void;
}

/** Headless passkey login (auth-sa.md §17, no auth required). */
export function PasskeyLogin(props: {
  children: (bag: PasskeyLoginBag) => ReactNode;
  webauthnGet?: WebauthnBinding;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const session = useAuthSession();
  const { webauthnGet } = props;
  const flow = useMemo(
    () =>
      createPasskeyLoginFlow({
        api,
        analytics,
        onAuthenticated: (r) => session.adopt(r),
        ...(webauthnGet !== undefined ? { webauthnGet } : {}),
      }),
    [api, analytics, session, webauthnGet]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    begin: (email) => {
      void flow.begin(email);
    },
    submitAssertion: (credential) => {
      void flow.submitAssertion(credential);
    },
    reset: flow.reset,
  });
}
