import { useMemo } from "react";
import type { ReactNode } from "react";
import type { OtpChannel, SignupAttribution } from "../api/types.js";
import { createOtpFlow } from "../flows/otpFlow.js";
import type { OtpState } from "../flows/otpFlow.js";
import { useFlow } from "@stapel/core";
import { useAuthAnalytics, useAuthApi, useAuthSession } from "../model/context.js";

/** Render-prop bag for {@link PasswordlessLogin}. */
export interface PasswordlessLoginBag {
  readonly state: OtpState;
  requestCode(channel: OtpChannel, value: string, captchaToken?: string): void;
  resend(captchaToken?: string): void;
  submitCode(code: string): void;
  reset(): void;
}

/**
 * Headless Email/Phone OTP login (auth-sa.md §1–2). Owns an `otpFlow` machine
 * and hands its state + actions to a render prop — you supply the markup.
 *
 * ```tsx
 * <PasswordlessLogin>
 *   {({ state, requestCode, submitCode }) =>
 *     state.step === "codeSent"
 *       ? <CodeForm onSubmit={submitCode} />
 *       : <EmailForm onSubmit={(e) => requestCode("email", e)} />}
 * </PasswordlessLogin>
 * ```
 */
export function PasswordlessLogin(props: {
  children: (bag: PasswordlessLoginBag) => ReactNode;
  /** Advertising capture from the host's landing page, carried on the verify
   * call — see `OtpFlowDeps.attribution`. Absent, the body is byte-identical
   * to what this flow has always sent. */
  attribution?: SignupAttribution | (() => SignupAttribution | undefined);
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const session = useAuthSession();
  const flow = useMemo(
    () =>
      createOtpFlow({
        api,
        analytics,
        onAuthenticated: (r) => session.adopt(r),
        ...(props.attribution !== undefined
          ? { attribution: props.attribution }
          : {}),
      }),
    [api, analytics, session, props.attribution]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    requestCode: (channel, value, captchaToken) => {
      void flow.requestCode(channel, value, captchaToken);
    },
    resend: (captchaToken) => {
      void flow.resend(captchaToken);
    },
    submitCode: (code) => {
      void flow.submitCode(code);
    },
    reset: flow.reset,
  });
}
