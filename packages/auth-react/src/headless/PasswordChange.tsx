import { useMemo } from "react";
import type { ReactNode } from "react";
import type { OtpChannel } from "../api/types.js";
import { createPasswordChangeFlow } from "../flows/passwordChangeFlow.js";
import type { PasswordChangeState } from "../flows/passwordChangeFlow.js";
import { useFlow } from "../flows/useFlow.js";
import { useAuthAnalytics, useAuthApi } from "../model/context.js";

export interface PasswordChangeBag {
  readonly state: PasswordChangeState;
  changeWithPassword(oldPassword: string, newPassword: string): void;
  requestOtp(method: OtpChannel): void;
  submitOtp(code: string, newPassword: string): void;
  reset(): void;
}

/**
 * Headless authenticated password change (auth-sa.md §4). Pair with
 * `usePasswordMethods()` to decide which tabs to render; call
 * `changeWithPassword` for the old-password tab or `requestOtp`/`submitOtp`
 * for the email/SMS tabs.
 */
export function PasswordChange(props: {
  children: (bag: PasswordChangeBag) => ReactNode;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const flow = useMemo(
    () => createPasswordChangeFlow({ api, analytics }),
    [api, analytics]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    changeWithPassword: (oldPassword, newPassword) => {
      void flow.changeWithPassword(oldPassword, newPassword);
    },
    requestOtp: (method) => {
      void flow.requestOtp(method);
    },
    submitOtp: (code, newPassword) => {
      void flow.submitOtp(code, newPassword);
    },
    reset: flow.reset,
  });
}
