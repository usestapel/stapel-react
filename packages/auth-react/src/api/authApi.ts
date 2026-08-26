import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type { paths } from "./generated/schema.js";
import type {
  AdminAuditQuery,
  AdminUserCreateRequest,
  AdminUserCreateResponse,
  AuthResponse,
  AuditPage,
  AuthSession,
  Capabilities,
  ChangeOldVerifiedResponse,
  DelayedChangeInitiatedResponse,
  DelayedChangeStatus,
  LinkedOAuthAccount,
  LoginResponse,
  MfaEnrollSessionResponse,
  OtpChannel,
  OtpRequestResponse,
  Passkey,
  PasskeyRegistered,
  PasskeyAuthenticateBeginResponse,
  PasskeyRegisterBeginResponse,
  PasswordMethods,
  PasswordOtpChangeResponse,
  PasswordRegisterRequest,
  QrGenerateResponse,
  QrStatusResponse,
  QrType,
  RefreshResponse,
  SecurityStatus,
  ServiceKey,
  ServiceKeyPatch,
  ServiceKeyWrite,
  SsoLookupResponse,
  SsoOrg,
  SsoOrgConfig,
  SsoOrgConfigPatch,
  SsoOrgPatch,
  SsoOrgWrite,
  StaffRoleAssignRequest,
  StaffRoleAssignment,
  StapelUser,
  StatusResponse,
  TotpDisableRequest,
  TotpSetupConfirmResponse,
  TotpSetupRequest,
  TotpSetupResponse,
  VerificationCompleteResponse,
  VerificationEnvelope,
  VerificationFactorId,
  VerificationInitiateResponse,
  VerificationPreferenceRow,
  VerificationPreferences,
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

/**
 * Does the PINNED contract carry `PATCH /passkey/{id}/` — the rename route?
 *
 * A passkey row has to answer "what can I do to it". stapel-auth 0.28.0 made
 * `device_name` writable after enrolment, so the honest answer now includes
 * rename; before it, the row was remove-only and the skin rendered no rename
 * affordance rather than a control that could not do its job.
 *
 * The type below is the tripwire, and it is live in BOTH directions.
 * `paths[…]["patch"]` is `undefined` while the operation is absent (the
 * generator writes `patch?: never`) and an operation object once it lands, so
 * a regen against a backend that dropped the route again stops accepting
 * `true` and fails the build HERE, at the one line that has to change, rather
 * than shipping a control that answers 405.
 */
type PasskeyRenameInContract =
  undefined extends paths["/auth/api/v1/passkey/{id}/"]["patch"] ? false : true;

const PASSKEY_RENAME_IN_CONTRACT: PasskeyRenameInContract = true;

/**
 * Whether this build's contract supports renaming a passkey. Typed `boolean`
 * (not the literal) on purpose: the skin BRANCHES on it, and a literal type
 * would narrow the branch away and take the rename UI out of type-checking
 * altogether — the code would rot unseen if the flag ever flipped back.
 */
export const PASSKEY_RENAME_SUPPORTED: boolean = PASSKEY_RENAME_IN_CONTRACT;

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
  passwordChangeOtpVerify(method: OtpChannel, code: string, newPassword: string): Promise<PasswordOtpChangeResponse>;
  passwordResetRequest(channel: OtpChannel, value: string): Promise<OtpRequestResponse>;
  passwordResetVerify(channel: OtpChannel, value: string, code: string, newPassword: string): Promise<AuthResponse>;
  passwordRegister(request: PasswordRegisterRequest): Promise<AuthResponse>;

  // Anonymous (auth-sa.md §6)
  anonymous(deviceId?: string): Promise<AuthResponse>;

  // Login grant (stapel-auth ≥0.11.0, org-program §B3) — consume a single-use
  // grant token minted service-side (e.g. the workspaces invitation claim
  // flow hands one out via its `InvitationClaimResponse.grant_token`) for a
  // full JWT session. When the grant was minted with `create_if_missing` and
  // no account exists yet, the verified account materializes here
  // (status=REGISTERED). The caller adopts the result through the runtime
  // session (`session.adopt`) exactly like any other login.
  exchangeLoginGrant(grantToken: string): Promise<AuthResponse>;

  // First-login enforcement (stapel-auth ≥0.12.0, org-program §C2) — the
  // password login's FIRST_LOGIN_REQUIRED intermediates.
  /**
   * Complete a forced first-login password change (requires=password_change).
   * Returns a full `AuthResponse` — or, when the account ALSO has the
   * mfa_enroll policy, the next `FirstLoginChallengeResponse`
   * (requires=mfa_enroll) instead of a session. A rejected password does NOT
   * consume the challenge; an invalid/expired token is 400
   * `first_login_challenge_invalid`.
   */
  completeForcedPasswordChange(request: {
    challengeToken: string;
    newPassword: string;
  }): Promise<LoginResponse>;
  /**
   * Exchange the first-login challenge_token (requires=mfa_enroll) for a
   * limited enroll-only session (access token only — no refresh). Single-use.
   */
  mfaEnrollExchange(challengeToken: string): Promise<MfaEnrollSessionResponse>;

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
  /**
   * Start TOTP enrollment. `proof` is REQUIRED when an active device already
   * exists (a replace) — `code` or `backup_code` proving the current device —
   * otherwise 400 `totp_proof_required` (stapel-auth ≥0.9.0). Omit entirely
   * for first-time enrollment.
   */
  totpSetup(proof?: TotpSetupRequest): Promise<TotpSetupResponse>;
  totpSetupConfirm(code: string): Promise<TotpSetupConfirmResponse>;
  totpDisable(request: TotpDisableRequest): Promise<StatusResponse>;
  totpDisableOtpRequest(): Promise<OtpRequestResponse>;

  // TOTP delayed removal ("lost device", stapel-auth ≥0.9.0) — mirrors the
  // email/phone delayed-change endpoints (see `changeDelayed*` below), just
  // scoped to a single factor with no `channel`/new-value axis: the only
  // outcome is a scheduled disable. `no_verified_contact` if the account has
  // no verified email/phone to notify.
  totpChangeDelayedInitiate(deviceId?: string): Promise<DelayedChangeInitiatedResponse>;
  totpChangeDelayedStatus(): Promise<DelayedChangeStatus>;
  totpChangeDelayedCancel(changeRequestId: string): Promise<StatusResponse>;

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
  /**
   * Verify the WebAuthn attestation and store the credential. From a limited
   * enroll-only session (first-login mfa_enroll policy, stapel-auth ≥0.12.0)
   * the response additionally carries the full-session `tokens` pair.
   */
  passkeyRegisterComplete(credential: unknown, deviceName?: string): Promise<PasskeyRegistered>;
  passkeyAuthenticateBegin(email?: string): Promise<PasskeyAuthenticateBeginResponse>;
  passkeyAuthenticateComplete(sessionKey: string, credential: unknown): Promise<AuthResponse>;
  passkeyRemove(id: string): Promise<void>;
  /**
   * Rename a stored credential (stapel-auth >= 0.28.0). Ownership is a lookup
   * predicate on the backend, so another account's id answers 404 exactly as
   * an unknown one does. Guarded by {@link PASSKEY_RENAME_SUPPORTED} so the
   * skin never offers the control against an older contract.
   */
  passkeyRename(id: string, deviceName: string): Promise<Passkey>;

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

  // Step-up verification preferences (auth-sa.md §11)
  verificationPreferences(): Promise<VerificationPreferences>;
  /**
   * Upsert one scope's preference. Turning a scope ON never needs proof;
   * turning it OFF is itself step-up protected and answers the 403
   * verification envelope, which the caller feeds to `VerificationChallenge`.
   */
  setVerificationPreference(
    scope: string,
    enabled: boolean
  ): Promise<VerificationPreferenceRow>;

  // ── Operator console (staff only) ──────────────────────────────────────────
  //
  // Every method below answers 403 for a non-staff caller. The skins that use
  // them live behind the `@stapel/auth-react/default/admin` subpath and are
  // mounted under the shell's `admin.root` container, so an ordinary user
  // never reaches a screen that can only refuse them.

  // Enterprise SSO organizations (auth-sa.md §18)
  ssoOrgs(): Promise<readonly SsoOrg[]>;
  ssoOrg(slug: string): Promise<SsoOrg>;
  createSsoOrg(body: SsoOrgWrite): Promise<SsoOrg>;
  updateSsoOrg(slug: string, body: SsoOrgPatch): Promise<SsoOrg>;
  deleteSsoOrg(slug: string): Promise<void>;
  /** Replace an org's IdP connection wholesale (`PUT`). */
  putSsoOrgConfig(slug: string, body: SsoOrgConfig): Promise<SsoOrgConfig>;
  /** Change part of an org's IdP connection (`PATCH`). */
  patchSsoOrgConfig(slug: string, body: SsoOrgConfigPatch): Promise<SsoOrgConfig>;

  // Service API keys (machine credentials)
  serviceKeys(): Promise<readonly ServiceKey[]>;
  serviceKey(id: number): Promise<ServiceKey>;
  /** The ONLY response that carries the full secret — see {@link ServiceKey}. */
  createServiceKey(body: ServiceKeyWrite): Promise<ServiceKey>;
  replaceServiceKey(id: number, body: ServiceKeyWrite): Promise<ServiceKey>;
  updateServiceKey(id: number, body: ServiceKeyPatch): Promise<ServiceKey>;
  deleteServiceKey(id: number): Promise<void>;

  // Staff roles
  staffRoles(userId?: string): Promise<readonly StaffRoleAssignment[]>;
  assignStaffRole(body: StaffRoleAssignRequest): Promise<StaffRoleAssignment>;
  removeStaffRole(assignmentId: string): Promise<void>;

  // Operator-provisioned accounts
  createAdminUser(body: AdminUserCreateRequest): Promise<AdminUserCreateResponse>;

  // The global audit stream (every user), as opposed to `auditLog`'s own.
  adminAudit(query?: AdminAuditQuery): Promise<AuditPage>;
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
    passwordRegister: (request) =>
      client.post("/password/register/", request, mutating()),

    anonymous: (deviceId) =>
      client.post(
        "/anonymous/",
        deviceId === undefined ? {} : { device_id: deviceId },
        mutating()
      ),

    exchangeLoginGrant: (grantToken) =>
      client.post("/grant/exchange/", { grant_token: grantToken }, mutating()),

    completeForcedPasswordChange: ({ challengeToken, newPassword }) =>
      client.post(
        "/password/forced-change/",
        { challenge_token: challengeToken, new_password: newPassword },
        mutating()
      ),
    mfaEnrollExchange: (challengeToken) =>
      client.post(
        "/mfa/enroll/exchange/",
        { challenge_token: challengeToken },
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
    totpSetup: (proof) => client.post("/totp/setup/", proof, mutating()),
    totpSetupConfirm: (code) =>
      client.post("/totp/setup/confirm/", { code }, mutating()),
    totpDisable: (request) => client.post("/totp/disable/", request, mutating()),
    totpDisableOtpRequest: () =>
      client.post("/totp/disable-otp/request/", undefined, mutating()),

    totpChangeDelayedInitiate: (deviceId) =>
      client.post(
        "/totp/change/delayed/initiate/",
        deviceId === undefined ? {} : { device_id: deviceId },
        mutating()
      ),
    totpChangeDelayedStatus: () => client.get("/totp/change/delayed/status/"),
    totpChangeDelayedCancel: (changeRequestId) =>
      client.post(
        "/totp/change/delayed/cancel/",
        { change_request_id: changeRequestId },
        mutating()
      ),

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
    passkeyRename: (id, deviceName) =>
      client.patch(`/passkey/${id}/`, { device_name: deviceName }, mutating()),

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

    verificationPreferences: () => client.get("/verification/preferences/"),
    setVerificationPreference: (scope, enabled) =>
      client.put("/verification/preferences/", { scope, enabled }, mutating()),

    ssoOrgs: () => client.get("/sso/orgs/"),
    ssoOrg: (slug) => client.get(`/sso/orgs/${encodeURIComponent(slug)}/`),
    createSsoOrg: (body) => client.post("/sso/orgs/", body, mutating()),
    updateSsoOrg: (slug, body) =>
      client.patch(`/sso/orgs/${encodeURIComponent(slug)}/`, body, mutating()),
    deleteSsoOrg: (slug) =>
      client.delete(`/sso/orgs/${encodeURIComponent(slug)}/`, mutating()),
    putSsoOrgConfig: (slug, body) =>
      client.put(`/sso/orgs/${encodeURIComponent(slug)}/config/`, body, mutating()),
    patchSsoOrgConfig: (slug, body) =>
      client.patch(`/sso/orgs/${encodeURIComponent(slug)}/config/`, body, mutating()),

    // No trailing slash: the router registers `/service-keys` exactly.
    serviceKeys: () => client.get("/service-keys"),
    serviceKey: (id) => client.get(`/service-keys/${id}`),
    createServiceKey: (body) => client.post("/service-keys", body, mutating()),
    replaceServiceKey: (id, body) =>
      client.put(`/service-keys/${id}`, body, mutating()),
    updateServiceKey: (id, body) =>
      client.patch(`/service-keys/${id}`, body, mutating()),
    deleteServiceKey: (id) => client.delete(`/service-keys/${id}`, mutating()),

    staffRoles: (userId) =>
      client.get("/staff-roles/", {
        query: userId === undefined ? {} : { user_id: userId },
      }),
    assignStaffRole: (body) => client.post("/staff-roles/", body, mutating()),
    removeStaffRole: (assignmentId) =>
      client.delete(`/staff-roles/${encodeURIComponent(assignmentId)}/`, mutating()),

    createAdminUser: (body) => client.post("/admin-users/", body, mutating()),

    adminAudit: (query) => client.get("/admin/audit/", { query: { ...query } }),
  };
}
