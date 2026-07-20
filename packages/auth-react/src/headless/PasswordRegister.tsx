import { useMemo } from "react";
import type { ReactNode } from "react";
import type { PasswordRegisterRequest } from "../api/types.js";
import { createPasswordRegisterFlow } from "../flows/passwordRegisterFlow.js";
import type { PasswordRegisterState } from "../flows/passwordRegisterFlow.js";
import { useFlow } from "@stapel/core";
import { useAuthAnalytics, useAuthApi, useAuthSession } from "../model/context.js";

export interface PasswordRegisterBag {
  readonly state: PasswordRegisterState;
  register(request: PasswordRegisterRequest): void;
  reset(): void;
}

/**
 * Headless password registration (auth-sa.md §5) — the SET-password
 * counterpart to `PasswordLogin`. Always adopts the resulting session
 * (`session.adopt()`) on success: the backend's `AuthResponse` here always
 * carries the CURRENT user (freshly created, or the SAME anonymous session
 * either promoted or just made portable — see `passwordRegisterFlow.ts`'s
 * doc), so `adopt()`'s own `user.is_anonymous` branch does the right thing
 * either way without this hook needing to know which case it was.
 */
export function PasswordRegister(props: {
  children: (bag: PasswordRegisterBag) => ReactNode;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const session = useAuthSession();
  const flow = useMemo(
    () =>
      createPasswordRegisterFlow({
        api,
        analytics,
        onAuthenticated: (r) => session.adopt(r),
      }),
    [api, analytics, session]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    register: (request) => {
      void flow.register(request);
    },
    reset: flow.reset,
  });
}
