import { useMemo } from "react";
import type { ReactNode } from "react";
import { createPasswordLoginFlow } from "../flows/passwordLoginFlow.js";
import type {
  PasswordLoginState,
  TotpProof,
} from "../flows/passwordLoginFlow.js";
import { useFlow } from "@stapel/core";
import { useAuthAnalytics, useAuthApi, useAuthSession } from "../model/context.js";

export interface PasswordLoginBag {
  readonly state: PasswordLoginState;
  login(loginId: string, password: string): void;
  submitTotp(proof: TotpProof): void;
  reset(): void;
}

/**
 * Headless password login with the TOTP step-up branch (auth-sa.md §3 + §11).
 * When `state.step === "totpRequired"`, render a TOTP input and call
 * `submitTotp({ code })` (or `{ backup_code }`).
 */
export function PasswordLogin(props: {
  children: (bag: PasswordLoginBag) => ReactNode;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const session = useAuthSession();
  const flow = useMemo(
    () =>
      createPasswordLoginFlow({
        api,
        analytics,
        onAuthenticated: (r) => session.adopt(r),
      }),
    [api, analytics, session]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    login: (loginId, password) => {
      void flow.login(loginId, password);
    },
    submitTotp: (proof) => {
      void flow.submitTotp(proof);
    },
    reset: flow.reset,
  });
}
