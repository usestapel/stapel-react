import { useMemo } from "react";
import type { ReactNode } from "react";
import type { OtpChannel } from "../api/types.js";
import { createPasswordResetFlow } from "../flows/passwordResetFlow.js";
import type { PasswordResetState } from "../flows/passwordResetFlow.js";
import { useFlow } from "@stapel/core";
import { useAuthAnalytics, useAuthApi, useAuthSession } from "../model/context.js";

export interface PasswordResetBag {
  readonly state: PasswordResetState;
  request(channel: OtpChannel, value: string): void;
  resend(): void;
  submit(code: string, newPassword: string): void;
  reset(): void;
}

/**
 * Headless unauthenticated password reset (auth-sa.md §5). The `codeSent`
 * human-wait collects the code AND the new password together, then the user
 * lands in a fresh session (`authenticated`).
 */
export function PasswordReset(props: {
  children: (bag: PasswordResetBag) => ReactNode;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const session = useAuthSession();
  const flow = useMemo(
    () =>
      createPasswordResetFlow({
        api,
        analytics,
        onAuthenticated: (r) => session.adopt(r),
      }),
    [api, analytics, session]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    request: (channel, value) => {
      void flow.request(channel, value);
    },
    resend: () => {
      void flow.resend();
    },
    submit: (code, newPassword) => {
      void flow.submit(code, newPassword);
    },
    reset: flow.reset,
  });
}
