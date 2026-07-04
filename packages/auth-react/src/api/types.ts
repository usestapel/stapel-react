/**
 * Wire types for the stapel-auth HTTP contract (auth-sa.md §1–18).
 *
 * These are hand-authored here because the auth backend does not yet publish
 * an `openapi.json` artifact to this monorepo. When it does, this file is the
 * codegen target (frontend-standard §2/§3): the shapes below are transcribed
 * verbatim from auth-sa.md's documented request/response bodies so a future
 * `regen` produces a compatible surface.
 */

/** Result status of any flow that ends in a session (auth-sa.md §"AuthResponse"). */
export type AuthStatus = "LOGGED_IN" | "REGISTERED" | "MERGED" | "MODIFIED";

/** The authenticated principal. Backend adds fields freely; kept open. */
export interface StapelUser {
  readonly id: string;
  readonly username?: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly is_anonymous?: boolean;
  readonly [extra: string]: unknown;
}

/** Access/refresh JWT pair returned in the body (also set as cookies). */
export interface AuthTokens {
  readonly access: string;
  readonly refresh: string;
}

/** Returned by every flow that results in a session. */
export interface AuthResponse {
  readonly status: AuthStatus;
  readonly user: StapelUser;
  readonly tokens: AuthTokens;
}

/** Returned instead of `AuthResponse` when the account has TOTP enabled. */
export interface TOTPChallengeResponse {
  readonly status: "TOTP_REQUIRED";
  readonly challenge_token: string;
  readonly expires_in: number;
}

/**
 * The `oneOf` login union (discriminator: `status`). Narrow with
 * `if (r.status === "TOTP_REQUIRED")`.
 */
export type LoginResponse = AuthResponse | TOTPChallengeResponse;

/** Narrowing helper for the login union. */
export function isTotpChallenge(r: LoginResponse): r is TOTPChallengeResponse {
  return r.status === "TOTP_REQUIRED";
}

/** `{ message, target }` — target is the masked destination to display. */
export interface OtpRequestResponse {
  readonly message: string;
  readonly target: string;
}

/** Simple status envelopes returned by several mutations. */
export interface StatusResponse {
  readonly status: string;
}

// ── Capabilities (auth-sa.md §"Which login methods to render") ──────────────

export interface OAuthProviderInfo {
  readonly id: string;
  readonly name: string;
}

export interface RegistrationCapabilities {
  readonly phone: boolean;
  readonly email: boolean;
  readonly password: boolean;
  readonly oauth: readonly OAuthProviderInfo[];
  readonly sso: boolean;
  readonly anonymous: boolean;
}

export interface LoginCapabilities {
  readonly phone: boolean;
  readonly email: boolean;
  readonly password: boolean;
  readonly oauth: readonly OAuthProviderInfo[];
  readonly sso: boolean;
  readonly qr: boolean;
  readonly passkey: boolean;
  readonly magic_link: boolean;
}

export interface Capabilities {
  readonly registration: RegistrationCapabilities;
  readonly login: LoginCapabilities;
}

// ── Password change methods (auth-sa.md §4) ─────────────────────────────────

export type PasswordChangeMethod = "password" | "email" | "phone";

export interface PasswordMethodEntry {
  readonly method: PasswordChangeMethod;
  readonly target?: string;
}

export interface PasswordMethods {
  readonly has_password: boolean;
  readonly methods: readonly PasswordMethodEntry[];
}

// ── Security status (auth-sa.md §10) ────────────────────────────────────────

export interface SecurityStatus {
  readonly password: { readonly is_set: boolean };
  readonly totp: {
    readonly is_enabled: boolean;
    readonly backup_codes_remaining: number;
  };
  readonly email: { readonly value: string | null; readonly is_verified: boolean };
  readonly phone: { readonly value: string | null; readonly is_verified: boolean };
  readonly oauth: { readonly connected_providers: readonly string[] };
  readonly sessions: { readonly active_count: number };
  readonly passkeys: { readonly count: number };
}

// ── Sessions (auth-sa.md §12) ───────────────────────────────────────────────

export type SessionDeviceType =
  | "phone"
  | "tablet"
  | "desktop"
  | "api"
  | "unknown";

export interface AuthSession {
  readonly id: string;
  readonly device_type: SessionDeviceType;
  readonly device_name: string;
  readonly device_details: string;
  readonly ip_address: string;
  readonly created_at: string;
  readonly last_used_at: string;
  readonly is_current: boolean;
  readonly is_suspicious: boolean;
}

// ── TOTP (auth-sa.md §11) ───────────────────────────────────────────────────

export interface TotpSetupResponse {
  readonly secret: string;
  readonly qr_uri: string;
  readonly expires_in: number;
}

export interface TotpSetupConfirmResponse {
  readonly backup_codes: readonly string[];
}

/** `oneOf` discriminated by `method` (auth-sa.md §"Disable TOTP"). */
export type TotpDisableRequest =
  | { readonly method: "totp"; readonly code: string }
  | { readonly method: "backup"; readonly backup_code: string }
  | { readonly method: "otp"; readonly otp_code: string };

// ── Verification / step-up (auth-sa.md §11 "verification challenges") ────────

export type VerificationFactorId =
  | "otp_email"
  | "otp_phone"
  | "totp"
  | "passkey";

/** The `verification` object inside the 403 envelope. */
export interface VerificationEnvelope {
  readonly challenge_id: string;
  readonly scope: string;
  readonly factors: readonly VerificationFactorId[];
  readonly expires_at: number;
}

export interface VerificationInitiateResponse {
  readonly factor: VerificationFactorId;
  /** For otp_* — `{ target }`; for passkey — `{ session_key, options }`. */
  readonly data: Record<string, unknown>;
}

export interface VerificationCompleteResponse {
  readonly verified: boolean;
  readonly verification_token: string;
}

// ── QR (auth-sa.md §8) ──────────────────────────────────────────────────────

export type QrType = "session_share" | "login_request";

export interface QrGenerateResponse {
  readonly key: string;
  readonly type: QrType;
  readonly expires_in: number;
  readonly scan_url: string;
}

export type QrStatusValue = "pending" | "fulfilled" | "expired" | "rejected";

export interface QrStatusResponse {
  readonly status: QrStatusValue;
  /** Present only on `login_request` fulfilment. */
  readonly access_token?: string;
  readonly refresh_token?: string;
}

// ── Passkeys (auth-sa.md §17) ───────────────────────────────────────────────

export interface Passkey {
  readonly id: string;
  readonly device_name: string;
  readonly aaguid: string;
  readonly transports: readonly string[];
  readonly created_at: string;
  readonly last_used_at: string | null;
}

export interface PasskeyRegisterBeginResponse {
  /** PublicKeyCredentialCreationOptions (JSON form). */
  readonly options: Record<string, unknown>;
}

export interface PasskeyAuthenticateBeginResponse {
  readonly session_key: string;
  /** PublicKeyCredentialRequestOptions (JSON form). */
  readonly options: Record<string, unknown>;
}

// ── Authenticator change (auth-sa.md §9) ────────────────────────────────────

export interface ChangeOldVerifiedResponse {
  readonly status: "OLD_VERIFIED";
  readonly change_token: string;
  readonly expires_at: string;
}

export interface DelayedChangeInitiatedResponse {
  readonly status: "PENDING";
  readonly change_request_id: string;
  readonly scheduled_at: string;
  readonly can_cancel_until: string;
}

export type DelayedChangeStatus =
  | { readonly has_pending_change: false }
  | {
      readonly has_pending_change?: true;
      readonly change_request_id: string;
      readonly scheduled_at: string;
      readonly can_cancel_until: string;
    };

// ── SSO (auth-sa.md §18) ────────────────────────────────────────────────────

export interface SsoLookupResponse {
  readonly sso_required: boolean;
  readonly org_slug: string | null;
  readonly protocol?: "saml" | "oidc";
}

// ── Audit log (auth-sa.md §16) ──────────────────────────────────────────────

export interface AuditEvent {
  readonly id: string;
  readonly event_type: string;
  readonly ip_address: string;
  readonly user_agent: string;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

export interface AuditPage {
  readonly results: readonly AuditEvent[];
  readonly count: number;
  readonly next: number | null;
}

/** `{ access, refresh }` from POST/GET /token/refresh/. */
export interface RefreshResponse {
  readonly access: string;
  readonly refresh: string;
}

/** Which identifier channel an OTP flow uses. */
export type OtpChannel = "email" | "phone";
