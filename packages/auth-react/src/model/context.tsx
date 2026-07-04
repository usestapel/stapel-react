import { createContext, useContext, useSyncExternalStore } from "react";
import type { Context } from "react";
import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { VerificationController } from "../flows/verificationFlow.js";
import type { AuthRuntime } from "./runtime.js";
import type { AuthSession, AuthSessionState } from "./session.js";

/**
 * The auth runtime shared through React context by `<AuthProvider>`. Hooks in
 * `model/` and `headless/` read the wired singletons from here; per-flow
 * machines are created by the headless components using `useAuthApi()` +
 * `useAuthAnalytics()`.
 */
export const AuthRuntimeContext: Context<AuthRuntime | null> =
  createContext<AuthRuntime | null>(null);

export function useAuthRuntime(): AuthRuntime {
  const runtime = useContext(AuthRuntimeContext);
  if (runtime === null) {
    throw new Error("Auth hooks must be used within an <AuthProvider>");
  }
  return runtime;
}

export function useAuthApi(): AuthApi {
  return useAuthRuntime().api;
}

export function useAuthSession(): AuthSession {
  return useAuthRuntime().session;
}

/** The singleton step-up verification controller (one modal per app). */
export function useVerification(): VerificationController {
  return useAuthRuntime().verification;
}

export function useAuthAnalytics(): Analytics | null {
  return useAuthRuntime().analytics;
}

/** Reactive session state (user / tokens / status). Re-renders on change. */
export function useAuthSessionState(): AuthSessionState {
  const session = useAuthSession();
  return useSyncExternalStore(
    session.subscribe,
    session.getState,
    session.getState
  );
}
