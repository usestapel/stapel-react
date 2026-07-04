import { createStapelClient } from "@stapel/core";
import type { Analytics, PersistStorage, StapelClient } from "@stapel/core";
import { createAuthApi } from "../api/authApi.js";
import type { AuthApi } from "../api/authApi.js";
import {
  createVerificationController,
} from "../flows/verificationFlow.js";
import type { VerificationController } from "../flows/verificationFlow.js";
import { createAuthSession } from "./session.js";
import type { AuthSession, TeardownReason } from "./session.js";

/**
 * The wired auth runtime — the one place the flagship seams are connected
 * (frontend-standard §2). It builds a {@link StapelClient} whose `getToken` /
 * `onAuthRefresh` come from the {@link AuthSession} and whose
 * `onVerificationChallenge` is the {@link VerificationController}'s handler, so
 * the step-up factor flow and token rotation "just work" for every request.
 *
 * The returned `client` is what the host injects into core's
 * `StapelConfigProvider` (as the default or the `"auth"` module client),
 * preserving the client-injection fork seam of §7.2.
 */
export interface AuthRuntime {
  readonly client: StapelClient;
  readonly api: AuthApi;
  readonly session: AuthSession;
  readonly verification: VerificationController;
  readonly analytics: Analytics | null;
}

export interface CreateAuthRuntimeOptions {
  /** e.g. `/auth/api` or `https://app.example.com/auth/api`. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly storage?: PersistStorage;
  readonly analytics?: Analytics | null;
  /** Cookie mode (httponly JWT cookies) vs header/bearer. Default false. */
  readonly cookieMode?: boolean;
  /** Called after a session teardown (revoked/expired/logout). */
  readonly onTeardown?: (reason: TeardownReason) => void;
  /** Extra headers merged into every request (e.g. a captcha or tenant id). */
  readonly defaultHeaders?: Record<string, string>;
  /** THIN WebAuthn binding for the passkey verification factor. */
  readonly webauthnGet?: (options: Record<string, unknown>) => Promise<unknown>;
}

export function createAuthRuntime(
  options: CreateAuthRuntimeOptions
): AuthRuntime {
  const analytics = options.analytics ?? null;

  // `api` is assigned after the client exists; session/verification reference
  // it lazily through the holder, breaking the client↔session/verification
  // wiring cycle without a reassigned `let`.
  const holder: { current: AuthApi | null } = { current: null };
  const getApi = (): AuthApi => {
    if (holder.current === null) {
      throw new Error("auth runtime used before initialization");
    }
    return holder.current;
  };

  const session = createAuthSession({
    api: getApi,
    ...(options.storage !== undefined ? { storage: options.storage } : {}),
    cookieMode: options.cookieMode ?? false,
    ...(options.onTeardown !== undefined ? { onTeardown: options.onTeardown } : {}),
  });

  const verification = createVerificationController({
    api: getApi,
    analytics,
    ...(options.webauthnGet !== undefined
      ? { webauthnGet: options.webauthnGet }
      : {}),
  });

  const client = createStapelClient({
    baseUrl: options.baseUrl,
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    getToken: () => session.getAccessToken(),
    onAuthRefresh: () => session.onAuthRefresh(),
    onVerificationChallenge: verification.handler,
    ...(options.defaultHeaders !== undefined
      ? { defaultHeaders: options.defaultHeaders }
      : {}),
  });

  const api = createAuthApi(client);
  holder.current = api;

  return { client, api, session, verification, analytics };
}
