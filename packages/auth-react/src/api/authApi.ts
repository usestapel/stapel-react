import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  AuthResponse,
  AuditPage,
  AuthSession,
  Capabilities,
  ChangeOldVerifiedResponse,
  DelayedChangeInitiatedResponse,
  DelayedChangeStatus,
  LinkedOAuthAccount,
  LoginResponse,
  OtpChannel,
  OtpRequestResponse,
  Passkey,
  PasskeyAuthenticateBeginResponse,
  PasskeyRegisterBeginResponse,
  PasswordMethods,
  QrGenerateResponse,
  QrStatusResponse,
  QrType,
  RefreshResponse,
  SecurityStatus,
  SsoLookupResponse,
  StapelUser,
  StatusResponse,
  TotpDisableRequest,
  TotpSetupConfirmResponse,
  TotpSetupResponse,
  VerificationCompleteResponse,
  VerificationEnvelope,
  VerificationFactorId,
  VerificationInitiateResponse,
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (auth-sa.md §"CSRF"):
 * the simplest SPA rule is to always send `X-Requested-With: XMLHttpRequest`
 * on mutating requests. Header-token clients are exempt but it is harmless
 * for them, so we send it on every mutation.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/**
 * The typed auth surface. One method per auth-sa.md endpoint that a JS client
 * may call. Browser-redirect endpoints (OAuth authorize, SSO login, QR scan,
 * magic-link verify) are intentionally absent — see `authUrls`.
 */
export interface AuthApi {
  readonly client: StapelClient;

  // Capabilities & identity
  capabilities(): Promise<Capabilities>;
  me(): Promise<StapelUser>;
  logout(): Promise<StatusResponse>;

  // Email / Phone OTP (auth-sa.md §1–2)
  otpRequest(channel: OtpChannel, value: string, captchaToken?: string): Promise<OtpRequestResponse>;
  otpVerify(channel: OtpChannel, value: string, code: string): Promise<AuthResponse>;

  // Password (auth-sa.md §3–5)
  passwordLogin(login: string, password: string): Promise<LoginResponse>;
  passwordMethods(): Promise<PasswordMethods>;
  passwordChange(oldPassword: string, newPassword: string): Promise<StatusResponse>;
  passwordChangeOtpRequest(method: OtpChannel): Promise<OtpRequestResponse>;
  passwordChangeOtpVerify(method: OtpChannel, code: string, newPassword: string): Promise<StatusResponse>;
  passwordResetRequest(channel: OtpChannel, value: string): Promise<OtpRequestResponse>;
  passwordResetVerify(channel: OtpChannel, value: string, code: string, newPassword: string): Promise<AuthResponse>;

  // Anonymous (auth-sa.md §6)
  anonymous(deviceId?: string): Promise<AuthResponse>;

  // OAuth (auth-sa.md §7, option B)
  oauthLogin(provider: string, accessToken: string): Promise<LoginResponse>;

  // OAuth account links — security settings, requires auth. WIP on the
  // stapel-auth side (not yet committed/pinned — see `LinkedOAuthAccount`'s
  // doc in api/types.ts); same client-side-token-exchange pattern as
  // `oauthLogin`, just while already signed in.
  oauthLinks(): Promise<readonly LinkedOAuthAccount[]>;
  oauthLink(provider: string, accessToken: string): Promise<readonly LinkedOAuthAccount[]>;
  oauthUnlink(provider: string): Promise<void>;

  // TOTP (auth-sa.md §11)
  totpChallengeVerify(challengeToken: string, proof: { code?: string; backup_code?: string }): Promise<AuthResponse>;
  totpSetup(): Promise<TotpSetupResponse>;
  totpSetupConfirm(code: string): Promise<TotpSetupConfirmResponse>;
  totpDisable(request: TotpDisableRequest): Promise<StatusResponse>;
  totpDisableOtpRequest(): Promise<OtpRequestResponse>;

  // Verification / step-up factor flow (auth-sa.md §11)
  verificationGet(challengeId: string): Promise<VerificationEnvelope>;
  verificationInitiate(challengeId: string, factor: VerificationFactorId): Promise<VerificationInitiateResponse>;
  verificationComplete(challengeId: string, body: Record<string, unknown>): Promise<VerificationCompleteResponse>;

  // Security status (auth-sa.md §10)
  securityStatus(): Promise<SecurityStatus>;

  // Sessions (auth-sa.md §12)
  sessions(): Promise<readonly AuthSession[]>;
  confirmSession(id: string): Promise<StatusResponse>;
  revokeSession(id: string): Promise<StatusResponse>;
  revokeOtherSessions(): Promise<StatusResponse>;

  // Token refresh (auth-sa.md §13)
  tokenRefresh(refresh?: string): Promise<RefreshResponse>;

  // QR (auth-sa.md §8)
  qrGenerate(type: QrType, redirectUrl: string, allowUnauthenticatedScanner?: boolean): Promise<QrGenerateResponse>;
  qrStatus(key: string): Promise<QrStatusResponse>;
  qrConfirm(key: string): Promise<StatusResponse>;
  qrReject(key: string): Promise<StatusResponse>;

  // Magic links (auth-sa.md §15)
  magicRequest(email: string, redirectUrl?: string): Promise<StatusResponse>;

  // Passkeys (auth-sa.md §17)
  passkeys(): Promise<readonly Passkey[]>;
  passkeyRegisterBegin(): Promise<PasskeyRegisterBeginResponse>;
  passkeyRegisterComplete(credential: unknown, deviceName?: string): Promise<Passkey>;
  passkeyAuthenticateBegin(email?: string): Promise<PasskeyAuthenticateBeginResponse>;
  passkeyAuthenticateComplete(sessionKey: string, credential: unknown): Promise<AuthResponse>;
  passkeyRemove(id: string): Promise<void>;

  // Authenticator change (auth-sa.md §9)
  changeInstantRequestOld(channel: OtpChannel): Promise<OtpRequestResponse>;
  changeInstantVerifyOld(channel: OtpChannel, code: string): Promise<ChangeOldVerifiedResponse>;
  changeInstantRequestNew(channel: OtpChannel, value: string, changeToken: string): Promise<OtpRequestResponse>;
  changeInstantVerifyNew(channel: OtpChannel, value: string, code: string, changeToken: string): Promise<AuthResponse>;
  changeDelayedInitiate(channel: OtpChannel, value: string): Promise<DelayedChangeInitiatedResponse>;
  changeDelayedStatus(channel: OtpChannel): Promise<DelayedChangeStatus>;
  changeDelayedCancel(channel: OtpChannel, changeRequestId: string): Promise<StatusResponse>;

  // SSO (auth-sa.md §18)
  ssoLookup(domain: string): Promise<SsoLookupResponse>;

  // Audit log (auth-sa.md §16)
  auditLog(page?: number): Promise<AuditPage>;
}

/**
 * Build the auth API bound to an injected {@link StapelClient} (per-module
 * override from `StapelProvider`, the fork-resolution seam of §7.2). All
 * mutations carry the CSRF header.
 */
export function createAuthApi(client: StapelClient): AuthApi {
  return {
    client,

    capabilities: () => client.get("/capabilities/"),
    me: () => client.get("/me/"),
    logout: () => client.post("/logout/", undefined, mutating()),

    otpRequest: (channel, value, captchaToken) =>
      client.post(
        `/${channel}/request/`,
        captchaToken === undefined
          ? { [channel]: value }
          : { [channel]: value, captcha_token: captchaToken },
        mutating()
      ),
    otpVerify: (channel, value, code) =>
      client.post(`/${channel}/verify/`, { [channel]: value, code }, mutating()),

    passwordLogin: (login, password) =>
      client.post("/password/login/", { login, password }, mutating()),
    passwordMethods: () => client.get("/password/methods/"),
    passwordChange: (oldPassword, newPassword) =>
      client.post(
        "/password/change/",
        { old_password: oldPassword, new_password: newPassword },
        mutating()
      ),
    passwordChangeOtpRequest: (method) =>
      client.post("/password/change/otp/request/", { method }, mutating()),
    passwordChangeOtpVerify: (method, code, newPassword) =>
      client.post(
        "/password/change/otp/verify/",
        { method, code, new_password: newPassword },
        mutating()
      ),
    passwordResetRequest: (channel, value) =>
      client.post(
        `/password/reset/${channel}/request/`,
        { [channel]: value },
        mutating()
      ),
    passwordResetVerify: (channel, value, code, newPassword) =>
      client.post(
        `/password/reset/${channel}/verify/`,
        { [channel]: value, code, new_password: newPassword },
        mutating()
      ),

    anonymous: (deviceId) =>
      client.post(
        "/anonymous/",
        deviceId === undefined ? {} : { device_id: deviceId },
        mutating()
      ),

    oauthLogin: (provider, accessToken) =>
      client.post(
        "/oauth/login/",
        { provider, access_token: accessToken },
        mutating()
      ),

    oauthLinks: () =>
      client
        .get<{ links: readonly LinkedOAuthAccount[] }>("/oauth/links/")
        .then((r) => r.links),
    oauthLink: (provider, accessToken) =>
      client
        .post<{ links: readonly LinkedOAuthAccount[] }>(
          "/oauth/links/",
          { provider, access_token: accessToken },
          mutating()
        )
        .then((r) => r.links),
    oauthUnlink: (provider) => client.delete(`/oauth/links/${provider}/`, mutating()),

    totpChallengeVerify: (challengeToken, proof) =>
      client.post(
        "/totp/challenge/verify/",
        { challenge_token: challengeToken, ...proof },
        mutating()
      ),
    totpSetup: () => client.post("/totp/setup/", undefined, mutating()),
    totpSetupConfirm: (code) =>
      client.post("/totp/setup/confirm/", { code }, mutating()),
    totpDisable: (request) => client.post("/totp/disable/", request, mutating()),
    totpDisableOtpRequest: () =>
      client.post("/totp/disable-otp/request/", undefined, mutating()),

    verificationGet: (challengeId) =>
      client.get(`/verification/${challengeId}/`),
    verificationInitiate: (challengeId, factor) =>
      client.post(`/verification/${challengeId}/initiate/`, { factor }, mutating()),
    verificationComplete: (challengeId, body) =>
      client.post(`/verification/${challengeId}/complete/`, body, mutating()),

    securityStatus: () => client.get("/security/status/"),

    sessions: () => client.get("/sessions/"),
    confirmSession: (id) =>
      client.post(`/sessions/${id}/confirm/`, undefined, mutating()),
    revokeSession: (id) => client.delete(`/sessions/${id}/`, mutating()),
    revokeOtherSessions: () => client.delete("/sessions/", mutating()),

    tokenRefresh: (refresh) =>
      refresh === undefined
        ? client.get("/token/refresh/")
        : client.post("/token/refresh/", { refresh }, mutating()),

    qrGenerate: (type, redirectUrl, allowUnauthenticatedScanner) =>
      client.post(
        "/qr/generate/",
        allowUnauthenticatedScanner === undefined
          ? { type, redirect_url: redirectUrl }
          : {
              type,
              redirect_url: redirectUrl,
              allow_unauthenticated_scanner: allowUnauthenticatedScanner,
            },
        mutating()
      ),
    qrStatus: (key) => client.get(`/qr/${key}/status/`),
    qrConfirm: (key) => client.post(`/qr/${key}/confirm/`, undefined, mutating()),
    qrReject: (key) => client.post(`/qr/${key}/reject/`, undefined, mutating()),

    magicRequest: (email, redirectUrl) =>
      client.post(
        "/magic/request/",
        redirectUrl === undefined ? { email } : { email, redirect_url: redirectUrl },
        mutating()
      ),

    passkeys: () =>
      client
        .get<{ passkeys: readonly Passkey[] }>("/passkey/")
        .then((r) => r.passkeys),
    passkeyRegisterBegin: () =>
      client.post("/passkey/register/begin/", undefined, mutating()),
    passkeyRegisterComplete: (credential, deviceName) =>
      client.post(
        "/passkey/register/complete/",
        deviceName === undefined
          ? { credential }
          : { credential, device_name: deviceName },
        mutating()
      ),
    passkeyAuthenticateBegin: (email) =>
      client.post(
        "/passkey/authenticate/begin/",
        email === undefined ? {} : { email },
        mutating()
      ),
    passkeyAuthenticateComplete: (sessionKey, credential) =>
      client.post(
        "/passkey/authenticate/complete/",
        { session_key: sessionKey, credential },
        mutating()
      ),
    passkeyRemove: (id) => client.delete(`/passkey/${id}/`, mutating()),

    changeInstantRequestOld: (channel) =>
      client.post(`/${channel}/change/instant/request-old/`, undefined, mutating()),
    changeInstantVerifyOld: (channel, code) =>
      client.post(`/${channel}/change/instant/verify-old/`, { code }, mutating()),
    changeInstantRequestNew: (channel, value, changeToken) =>
      client.post(
        `/${channel}/change/instant/request-new/`,
        { [channel]: value, change_token: changeToken },
        mutating()
      ),
    changeInstantVerifyNew: (channel, value, code, changeToken) =>
      client.post(
        `/${channel}/change/instant/verify-new/`,
        { [channel]: value, code, change_token: changeToken },
        mutating()
      ),
    changeDelayedInitiate: (channel, value) =>
      client.post(
        `/${channel}/change/delayed/initiate/`,
        { [channel]: value },
        mutating()
      ),
    changeDelayedStatus: (channel) =>
      client.get(`/${channel}/change/delayed/status/`),
    changeDelayedCancel: (channel, changeRequestId) =>
      client.post(
        `/${channel}/change/delayed/cancel/`,
        { change_request_id: changeRequestId },
        mutating()
      ),

    ssoLookup: (domain) => client.get("/sso/lookup/", { query: { domain } }),

    auditLog: (page) =>
      client.get("/security/audit/", {
        query: page === undefined ? {} : { page },
      }),
  };
}
