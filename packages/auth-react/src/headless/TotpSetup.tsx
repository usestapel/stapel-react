import { useMemo } from "react";
import type { ReactNode } from "react";
import { createTotpSetupFlow } from "../flows/totpSetupFlow.js";
import type { TotpSetupState } from "../flows/totpSetupFlow.js";
import { useFlow } from "@stapel/core";
import { useAuthAnalytics, useAuthApi } from "../model/context.js";

export interface TotpSetupBag {
  readonly state: TotpSetupState;
  start(): void;
  confirm(code: string): void;
  reset(): void;
}

/**
 * Headless TOTP enrollment (auth-sa.md §11). Render the `enrolling` state's
 * `qrUri` as a QR image and `secret` for manual entry; on `done`, surface the
 * one-time `backupCodes` with a copy/warn affordance (shown ONCE).
 */
export function TotpSetup(props: {
  children: (bag: TotpSetupBag) => ReactNode;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const flow = useMemo(
    () => createTotpSetupFlow({ api, analytics }),
    [api, analytics]
  );
  const state = useFlow(flow.machine);
  return props.children({
    state,
    start: () => {
      void flow.start();
    },
    confirm: (code) => {
      void flow.confirm(code);
    },
    reset: flow.reset,
  });
}
