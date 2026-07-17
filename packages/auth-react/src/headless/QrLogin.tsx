import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import type { QrType } from "../api/types.js";
import { createQrLoginFlow } from "../flows/qrLoginFlow.js";
import type { QrLoginState } from "../flows/qrLoginFlow.js";
import { useFlow } from "@stapel/core";
import { useAuthAnalytics, useAuthApi, useAuthSession } from "../model/context.js";

export interface QrLoginBag {
  readonly state: QrLoginState;
  start(
    type: QrType,
    redirectUrl: string,
    allowUnauthenticatedScanner?: boolean
  ): void;
  /** Stop polling, no server call (existing behavior — modal close/unmount). */
  dispose(): void;
  /** User-initiated cancel — best-effort `/reject/` then dispose. */
  cancel(): void;
}

/**
 * Headless QR authentication with background polling (auth-sa.md §8). Render
 * the `awaitingScan` state's `scanUrl` as a QR image. The poll loop starts on
 * `start()` and is torn down on unmount. For `login_request`, delivered tokens
 * are adopted into the session automatically.
 */
export function QrLogin(props: {
  children: (bag: QrLoginBag) => ReactNode;
  pollIntervalMs?: number;
}): ReactNode {
  const api = useAuthApi();
  const analytics = useAuthAnalytics();
  const session = useAuthSession();
  const { pollIntervalMs } = props;
  const flow = useMemo(
    () =>
      createQrLoginFlow({
        api,
        analytics,
        onAuthenticated: (tokens) => session.setTokens(tokens),
        ...(pollIntervalMs !== undefined ? { pollIntervalMs } : {}),
      }),
    [api, analytics, session, pollIntervalMs]
  );
  const state = useFlow(flow.machine);
  useEffect(() => () => flow.dispose(), [flow]);
  return props.children({
    state,
    start: (type, redirectUrl, allow) => {
      void flow.start(type, redirectUrl, allow);
    },
    dispose: flow.dispose,
    cancel: flow.cancel,
  });
}
