import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createStapelClient } from "@stapel/core";
import { useFlow } from "@stapel/core";
import { createAuthApi } from "../api/authApi.js";
import type { AuthTokens } from "../api/types.js";
import {
  createForcedPasswordChangeFlow,
  createMfaEnrollFlow,
} from "../flows/firstLoginFlow.js";
import type {
  ForcedPasswordChangeState,
  MfaEnrollMethod,
  MfaEnrollState,
} from "../flows/firstLoginFlow.js";
import type { FlowError } from "../flows/errors.js";
import {
  AuthRuntimeContext,
  useAuthAnalytics,
  useAuthApi,
  useAuthRuntime,
  useAuthSession,
} from "../model/context.js";

/**
 * Headless first-login enforcement pair (org-program §C2; stapel-auth
 * ≥0.12.0): the two `FIRST_LOGIN_REQUIRED` branches the password login can
 * park in ({@link ForcedPasswordChange} for `requires="password_change"`,
 * {@link MfaEnrollGate} for `requires="mfa_enroll"`). Both are renderless —
 * state + actions via a render-prop bag, zero visual opinion
 * (frontend-standard §2). The default skins (`ForcedPasswordChangeCard`,
 * `MfaEnrollPanel`) dress exactly these.
 */

// ── ForcedPasswordChange ────────────────────────────────────────────────────

/** Render-prop bag for {@link ForcedPasswordChange}. */
export interface ForcedPasswordChangeBag {
  readonly state: ForcedPasswordChangeState;
  /** The controlled new-password field value. */
  readonly newPassword: string;
  setNewPassword(value: string): void;
  /**
   * Submit against the challenge. Pass `value` to submit uncontrolled form
   * state directly (it also syncs the bag's `newPassword`); omit it to submit
   * the current controlled `newPassword`.
   */
  submit(value?: string): void;
  /** The submit failed (a localizable {@link FlowError}), else null. A
   * rejected password does NOT consume the challenge — retry in place. */
  readonly error: FlowError | null;
  reset(): void;
}

/**
 * Headless forced first-login password change (requires=password_change).
 * On success the session is adopted through the runtime (`session.adopt`);
 * when the account ALSO has the mfa_enroll policy, the flow parks in
 * `mfaEnrollRequired` with a FRESH challenge token — render
 * {@link MfaEnrollGate} with it (`onEnrollRequired` fires once for hosts that
 * route instead of render inline).
 */
export function ForcedPasswordChange(props: {
  /** `challenge_token` from the login's `FIRST_LOGIN_REQUIRED` intermediate. */
  challengeToken: string;
  children: (bag: ForcedPasswordChangeBag) => ReactNode;
  /** Fired once when the change chains into the mfa_enroll challenge. */
  onEnrollRequired?: (challengeToken: string, expiresIn: number) => void;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const session = useAuthSession();
  const { challengeToken, onEnrollRequired } = props;
  const [newPassword, setNewPassword] = useState("");
  const flow = useMemo(
    () =>
      createForcedPasswordChangeFlow({
        api,
        analytics,
        challengeToken,
        onAuthenticated: (r) => session.adopt(r),
      }),
    [api, analytics, session, challengeToken]
  );
  const state = useFlow(flow.machine);

  const enrollNotified = useRef(false);
  useEffect(() => {
    if (state.step !== "mfaEnrollRequired" || enrollNotified.current) return;
    enrollNotified.current = true;
    onEnrollRequired?.(state.challengeToken, state.expiresIn);
  }, [state, onEnrollRequired]);

  return props.children({
    state,
    newPassword,
    setNewPassword,
    submit: (value) => {
      if (value !== undefined) setNewPassword(value);
      void flow.submit(value ?? newPassword);
    },
    error: state.step === "error" ? state.error : null,
    reset: () => {
      enrollNotified.current = false;
      setNewPassword("");
      flow.reset();
    },
  });
}

// ── MfaEnrollGate ───────────────────────────────────────────────────────────

/** Render-prop bag for {@link MfaEnrollGate}. */
export interface MfaEnrollGateBag {
  readonly state: MfaEnrollState;
  /** The strong factors offered for enrollment (host-filterable via props). */
  readonly methods: readonly MfaEnrollMethod[];
  /** The method the user picked, else null. */
  readonly active: MfaEnrollMethod | null;
  choose(method: MfaEnrollMethod): void;
  /**
   * Finish the journey with the full-session pair the enroll-mode endpoint
   * returned (`TotpSetupState.done.tokens` /
   * `PasskeyRegisterState.registered.passkey.tokens`) — the gate commits it
   * through the runtime (`session.setTokens`) and settles `authenticated`.
   */
  complete(tokens: AuthTokens | null | undefined): void;
  reset(): void;
}

const ENROLL_METHODS: readonly MfaEnrollMethod[] = ["totp", "passkey"];

/**
 * Headless MFA-enrollment gate (requires=mfa_enroll). Exchanges the
 * first-login challenge for the LIMITED enroll-only session on mount, then
 * provides a nested auth runtime context whose client rides that enroll
 * access token — so the pair's EXISTING `TotpSetup` / `PasskeyRegistration`
 * headless components (rendered by the host inside `children`) work
 * unchanged against the limited session; no parallel enrollment machinery.
 * Activating the strong factor makes the confirm/complete endpoint return
 * the full-session `tokens` pair — hand it to `complete(...)` and the gate
 * commits it via `session.setTokens`.
 *
 * The nested context shares the OUTER runtime's session/verification —
 * only `client`/`api` are scoped to the enroll token, and only while the
 * limited session is live.
 */
export function MfaEnrollGate(props: {
  /** `challenge_token` from `FIRST_LOGIN_REQUIRED` (requires=mfa_enroll) —
   * or from the forced password change's chained challenge. */
  challengeToken: string;
  children: (bag: MfaEnrollGateBag) => ReactNode;
  /** Restrict/reorder the offered factors. Default `["totp", "passkey"]`. */
  methods?: readonly MfaEnrollMethod[];
  /** Fired once after `complete(tokens)` committed the full session. */
  onAuthenticated?: (tokens: AuthTokens) => void;
}): ReactNode {
  const runtime = useAuthRuntime();
  const analytics = useAuthAnalytics();
  const session = useAuthSession();
  const { challengeToken, onAuthenticated } = props;
  const [active, setActive] = useState<MfaEnrollMethod | null>(null);

  const flow = useMemo(
    () =>
      createMfaEnrollFlow({
        api: runtime.api,
        analytics,
        challengeToken,
        onAuthenticated: (tokens) => {
          // Commit through the runtime: `setTokens` resolves the user via
          // `me()` and settles "authenticated" — the full-session canon for
          // token-pair-only responses (same path as the QR fulfilment).
          void session.setTokens(tokens).then(() => onAuthenticated?.(tokens));
        },
      }),
    [runtime.api, analytics, session, challengeToken, onAuthenticated]
  );
  const state = useFlow(flow.machine);

  useEffect(() => {
    void flow.exchange();
  }, [flow]);

  // The enroll-scoped runtime: same session/verification/analytics, but the
  // client rides the LIMITED session's access token. Built only once the
  // exchange settled (`state.session.access` is stable per exchange).
  const enrollAccess =
    state.step === "enrolling" || state.step === "completing"
      ? state.session.access
      : null;
  const enrollRuntime = useMemo(() => {
    if (enrollAccess === null) return runtime;
    const client = createStapelClient({
      baseUrl: runtime.client.baseUrl,
      getToken: () => enrollAccess,
    });
    return { ...runtime, client, api: createAuthApi(client) };
  }, [runtime, enrollAccess]);

  return (
    <AuthRuntimeContext.Provider value={enrollRuntime}>
      {props.children({
        state,
        methods: props.methods ?? ENROLL_METHODS,
        active,
        choose: setActive,
        complete: (tokens) => {
          flow.complete(tokens);
        },
        reset: () => {
          setActive(null);
          flow.reset();
        },
      })}
    </AuthRuntimeContext.Provider>
  );
}
