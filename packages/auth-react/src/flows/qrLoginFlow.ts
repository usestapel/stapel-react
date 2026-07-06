import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthTokens, QrType } from "../api/types.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * QR authentication with background polling (auth-sa.md §8). Serves both the
 * `login_request` sign-in tab (polling device receives `access_token` /
 * `refresh_token` on fulfilment) and the `session_share` profile modal (the
 * *scanning* device gets the session; the generator just watches for
 * `fulfilled`).
 *
 * Device binding matters: generate and poll from the same browser context so
 * the httponly `stapel_qr_<key>` cookie is present (the client must send
 * credentials). On `expired` the flow auto-regenerates and resets the poll
 * loop, per spec.
 */
export type QrLoginState =
  | { readonly step: "idle" }
  | { readonly step: "generating"; readonly type: QrType }
  | {
      readonly step: "awaitingScan";
      readonly type: QrType;
      readonly key: string;
      readonly scanUrl: string;
      readonly expiresIn: number;
    }
  | { readonly step: "fulfilled"; readonly tokens: AuthTokens | null }
  | { readonly step: "rejected"; readonly key: string }
  | { readonly step: "error"; readonly error: FlowError };

export interface QrLoginFlow {
  readonly machine: FlowMachine<QrLoginState>;
  /** Generate a QR and begin the poll loop. */
  start(
    type: QrType,
    redirectUrl: string,
    allowUnauthenticatedScanner?: boolean
  ): Promise<void>;
  /** Stop polling and reset to idle (call on modal close / unmount). */
  dispose(): void;
}

export interface QrLoginFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  /** For `login_request` fulfilment — receives the delivered tokens. */
  readonly onAuthenticated?: (tokens: AuthTokens) => void;
  /** Poll cadence; default 5000 ms (auth-sa.md §8). */
  readonly pollIntervalMs?: number;
}

export function createQrLoginFlow(deps: QrLoginFlowDeps): QrLoginFlow {
  const machine = createFlowMachine<QrLoginState>({
    id: "auth.qr_login",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });
  const interval = deps.pollIntervalMs ?? 5000;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let params: {
    type: QrType;
    redirectUrl: string;
    allowUnauth: boolean | undefined;
  } | null = null;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedulePoll(key: string): void {
    clearTimer();
    timer = setTimeout(() => {
      void poll(key);
    }, interval);
  }

  async function poll(key: string): Promise<void> {
    // Bail if the machine moved on (disposed / regenerated).
    const s = machine.getState();
    if (s.step !== "awaitingScan" || s.key !== key) return;
    try {
      const status = await deps.api.qrStatus(key);
      // Re-check KEY identity, not just the step: a dispose()+start() race
      // (modal re-open, StrictMode remount) leaves the machine in
      // `awaitingScan` for a NEW key while this poll's response is airborne.
      // A step-only check lets the stale response hijack the shared timer
      // (silently ending the live QR's polling) or mark the fresh QR rejected.
      const after = machine.getState();
      if (after.step !== "awaitingScan" || after.key !== key) return;
      switch (status.status) {
        case "pending":
          schedulePoll(key);
          break;
        case "fulfilled": {
          clearTimer();
          const tokens: AuthTokens | null =
            status.access_token != null && status.refresh_token != null
              ? { access: status.access_token, refresh: status.refresh_token }
              : null;
          if (tokens) deps.onAuthenticated?.(tokens);
          machine.to({ step: "fulfilled", tokens });
          break;
        }
        case "expired":
          clearTimer();
          if (params) {
            void start(params.type, params.redirectUrl, params.allowUnauth);
          }
          break;
        case "rejected":
          clearTimer();
          machine.to({ step: "rejected", key });
          break;
      }
    } catch (error) {
      // Same identity guard for the failure path: a stale poll's network
      // error must not clobber the live QR's state.
      const after = machine.getState();
      if (after.step !== "awaitingScan" || after.key !== key) return;
      clearTimer();
      machine.to({ step: "error", error: toFlowError(error) });
    }
  }

  async function start(
    type: QrType,
    redirectUrl: string,
    allowUnauthenticatedScanner?: boolean
  ): Promise<void> {
    clearTimer();
    params = { type, redirectUrl, allowUnauth: allowUnauthenticatedScanner };
    await machine.run(
      { step: "generating", type },
      () => deps.api.qrGenerate(type, redirectUrl, allowUnauthenticatedScanner),
      {
        resolve: (r): QrLoginState => ({
          step: "awaitingScan",
          type,
          key: r.key,
          scanUrl: r.scan_url,
          expiresIn: r.expires_in,
        }),
        reject: (error): QrLoginState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
    const after = machine.getState();
    if (after.step === "awaitingScan") schedulePoll(after.key);
  }

  function dispose(): void {
    clearTimer();
    params = null;
    machine.to({ step: "idle" });
  }

  return { machine, start, dispose };
}
