import { useMemo } from "react";
import type { ReactNode } from "react";
import type { TotpSetupRequest } from "../api/types.js";
import { createTotpSetupFlow } from "../flows/totpSetupFlow.js";
import type { TotpSetupState } from "../flows/totpSetupFlow.js";
import { useFlow } from "@stapel/core";
import { useAuthAnalytics, useAuthApi } from "../model/context.js";

export interface TotpSetupBag {
  readonly state: TotpSetupState;
  /**
   * `proof` (current `code` or `backup_code`) is required to REPLACE an
   * already-active device (stapel-auth ≥0.9.0) — omit it for first-time
   * enrollment, or call bare and react to the `"proofRequired"` step if the
   * caller doesn't already know a device is active.
   */
  start(proof?: TotpSetupRequest): void;
  confirm(code: string): void;
  reset(): void;
}

/**
 * Headless TOTP enrollment (auth-sa.md §11). Render the `enrolling` state's
 * `qrUri` as a QR image and `secret` for manual entry; on `done`, surface the
 * one-time `backupCodes` with a copy/warn affordance (shown ONCE). On
 * `"proofRequired"`, render a code/backup-code prompt and retry `start(proof)`.
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
    start: (proof) => {
      void flow.start(proof);
    },
    confirm: (code) => {
      void flow.confirm(code);
    },
    reset: flow.reset,
  });
}
