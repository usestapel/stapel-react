/**
 * Wire types for the stapel-auth HTTP contract — **derived from the generated
 * OpenAPI surface**, not hand-maintained (frontend-standard §2/§3).
 *
 * The single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-auth's OWN `docs/schema.json` — the §17-native
 * per-module contract, not the unified monolith). This module is a thin
 * *adapter* over that surface: it re-exports the generated schemas under the names the pair uses
 * and applies four small, documented corrections where drf-spectacular +
 * openapi-typescript under-describe the runtime contract:
 *
 *  1. **Enum-discriminant repair.** openapi-typescript flattens an enum-valued
 *     property to the *schema name* (`status: "AuthResponse"`), while the real
 *     runtime values live in the sibling `*StatusEnum`. We re-attach the enum so
 *     discriminated unions (the login `oneOf`) narrow correctly.
 *  2. **Array element typing.** A few `unknown[]` payloads (verification
 *     `factors`, TOTP `backup_codes`) carry a known element type at runtime.
 *  3. **Present-but-optional.** `VerificationInitiate` always returns `data`;
 *     the generator marks it optional.
 *  4. **Untyped-string literal repair.** `AuthMethodInfo.placement`/
 *     `.interaction` are plain `string` in the generated surface — the
 *     backend declares them without an OpenAPI `enum` (prose-only in the
 *     description), so openapi-typescript can't narrow them. `ChannelPlacement`/
 *     `ChannelInteraction` re-declare the concrete literal unions stapel-auth's
 *     `AuthMethodInfo` docstring specifies (`"main"|"overflow"|"bottom"`,
 *     `"inline"|"modal"|"redirect"`).
 *
 * Everything the generated surface already describes cleanly is a *direct*
 * alias — no parallel definitions. Only genuinely un-generated shapes remain
 * hand-authored, each flagged with WHY the codegen does not cover it.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
type Schemas = components["schemas"];

// ── Identity & session ───────────────────────────────────────────────────────

/** Result status of any flow that ends in a session. */
export type AuthStatus = Schemas["AuthResponseStatusEnum"];

/** The authenticated principal. */
export type StapelUser = Schemas["User"];

/** Access/refresh JWT pair returned in the body (also set as cookies). */
export type AuthTokens = Schemas["TokenPairResponse"];

/**
 * Returned by every flow that results in a session.
 *
 * ADAPTER (1): the generated `AuthResponse.status` is the flattened literal
 * `"AuthResponse"`; the real values are in `AuthResponseStatusEnum`.
 */
export type AuthResponse = Omit<Schemas["AuthResponse"], "status"> & {
  readonly status: AuthStatus;
};

/**
 * Returned instead of `AuthResponse` when the account has TOTP enabled.
 *
 * ADAPTER (1): re-attach the `"TOTP_REQUIRED"` discriminant so the login union
 * narrows on it.
 */
export type TOTPChallengeResponse = Omit<
  Schemas["TOTPChallengeResponse"],
  "status"
> & {
  readonly status: Schemas["TOTPChallengeResponseStatusEnum"];
};

/**
 * The `oneOf` login union (discriminator: `status`). Narrow with
 * {@link isTotpChallenge}.
 */
export type LoginResponse = AuthResponse | TOTPChallengeResponse;

/** Narrowing helper for the login union. */
export function isTotpChallenge(r: LoginResponse): r is TOTPChallengeResponse {
  return r.status === "TOTP_REQUIRED";
}

/** `{ message, target }` — target is the masked destination to display. */
export type OtpRequestResponse = Schemas["OtpSentResponse"];

/** Simple `{ status }` envelope returned by several mutations. */
export type StatusResponse = Schemas["SimpleStatusResponse"];

/**
 * `POST /password/change/otp/verify/`'s response (stapel-auth ≥0.7.0):
 * ordinarily a bare `StatusResponse` (status=password_changed — no session
 * change). If the caller was an anonymous guest session, a successful
 * contact OTP verification there is itself an identity anchor (the same one
 * email_verify/phone_verify promote on) — the account is promoted and this
 * instead returns a full `AuthResponse` (status=REGISTERED, fresh tokens),
 * since promoting invalidated the session that request itself was using.
 * Narrow with {@link isAuthResponse}.
 */
export type PasswordOtpChangeResponse = AuthResponse | StatusResponse;

/** Narrowing helper for {@link PasswordOtpChangeResponse} — only a real
 * `AuthResponse` carries `user`, which is what `session.adopt()` needs. */
export function isAuthResponse(r: PasswordOtpChangeResponse): r is AuthResponse {
  return "user" in r;
}

/** `{ access, refresh }` from POST/GET /token/refresh/. */
export type RefreshResponse = Schemas["TokenPairResponse"];

/** Which identifier channel an OTP flow uses. */
export type OtpChannel = "email" | "phone";

// ── Capabilities ─────────────────────────────────────────────────────────────
// GENERATED as of stapel-auth 0.6.0: `GET /auth/api/v1/capabilities/` now
// carries a real response serializer (`AuthCapabilities`) — the endpoint used
// to be `@extend_schema`-annotated with no body, which is why these were
// hand-transcribed before. `login`/`registration` keep the same shape pairs
// have always read; `methods`/`otp` are new (see `AuthMethodInfo`/`OtpMeta`
// below and `../default/channels.ts`'s `computeZones`, which is what actually
// consumes `methods`).

export type OAuthProviderInfo = Schemas["OAuthProviderInfo"];
export type RegistrationCapabilities = Schemas["RegistrationCapabilities"];
export type LoginCapabilities = Schemas["LoginCapabilities"];
export type MFACapabilities = Schemas["MFACapabilities"];

/**
 * Where a sign-in method's control renders in the default skin, and how it is
 * triggered (stapel-auth ≥0.6.0). `"main"` sits inline as a tab, `"overflow"`
 * sits behind the "More ways to sign in" three-dot menu, `"bottom"` sits in
 * the icon row beneath the primary form (alongside social buttons).
 */
export type ChannelPlacement = "main" | "overflow" | "bottom";

/**
 * `"inline"` renders the method's panel directly where it's placed (a `main`
 * tab's body). `"modal"` opens the panel in a dialog when the method is picked
 * from `overflow`/`bottom`. `"redirect"` performs the action immediately on
 * pick with no dialog — stapel-auth always sends this for oauth/sso.
 */
export type ChannelInteraction = "inline" | "modal" | "redirect";

/**
 * One method's display descriptor (stapel-auth ≥0.6.0 — every field is
 * server-derived: `placement` from `AUTH_<METHOD>_PLACEMENT`, `order` and
 * `interaction` computed so the frontend never has to guess). `id` matches a
 * `ChannelId` (`../default/channels.ts`) for every method the default skin
 * knows how to render. Correction (4): `placement`/`interaction` re-typed from
 * the generated surface's plain `string`.
 *
 * ADAPTER (5, stapel-auth ≥0.7.0): `can_login`/`can_register` are dataclass
 * fields with a Python default (`False`), which drf-spectacular marks
 * `?:` (optional) even though the backend always serializes both — re-typed
 * required here so callers don't have to `?? false` everywhere. `can_login`
 * mirrors `enabled` (kept for back-compat); `can_register` is `false` for
 * passkey/qr/magic_link (THE IDENTITY MODEL: no registration axis for those).
 */
export type AuthMethodInfo = Omit<
  Schemas["AuthMethodInfo"],
  "placement" | "interaction" | "can_login" | "can_register"
> & {
  readonly placement: ChannelPlacement;
  readonly interaction: ChannelInteraction;
  readonly can_login: boolean;
  readonly can_register: boolean;
};

/**
 * Server-authoritative OTP parameters (stapel-auth ≥0.6.0) — read these
 * instead of guessing a fixed digit count; a guard test on the backend keeps
 * them from silently drifting off the actual DB/serializer field widths.
 */
export type OtpMeta = Schemas["OtpMeta"];

/**
 * `methods`/`otp` are REQUIRED on this (0.6.0+) generated shape — this
 * backend version always sends them. Alpha-canon (owner directive): there is
 * no supported older backend — every real deployment is kept upgraded to the
 * latest stapel-auth — so `computeZones` (`../default/channels.ts`) treats a
 * missing/empty `methods[]` as a configuration error rather than a signal to
 * fall back to a fixed placement table. `methods` is re-typed to correction
 * (4)'s `AuthMethodInfo`, not the generated one.
 */
export type Capabilities = Omit<Schemas["AuthCapabilities"], "methods"> & {
  readonly methods: readonly AuthMethodInfo[];
};

/**
 * `POST /password/register/` request body (auth-sa.md §5; gated by
 * `RegistrationCapabilities.password` / `AUTH_PASSWORD_REGISTRATION`).
 * `password` is the only required field — email/phone/username are each
 * optional, but see `PasswordRegisterPanel`'s doc: calling this WITHOUT
 * email or phone on an anonymous session only sets a password on the guest
 * account (portable-anon — THE IDENTITY MODEL), it does not promote it.
 */
export type PasswordRegisterRequest = Schemas["PasswordRegister"];

// ── Password change / reset methods ──────────────────────────────────────────

export type PasswordChangeMethod = Schemas["PasswordMethodMethodEnum"];
export type PasswordMethodEntry = Schemas["PasswordMethod"];
export type PasswordMethods = Schemas["PasswordMethodsResponse"];

// ── Security status ──────────────────────────────────────────────────────────

export type SecurityStatus = Schemas["SecurityStatusResponse"];

// ── OAuth account links (security settings, requires auth) ──────────────────
// GENERATED as of stapel-auth 0.6.0: `/oauth/links/` (list/link) and
// `/oauth/links/{provider}/` (unlink) now ship in the pinned contract
// (contract-pins.json). Was hand-transcribed against the sibling's
// work-in-progress while this was being built, before it was committed/
// released/pinned — see git history for that interim version.

/** One OAuth provider account connected to the current user. `primary` marks
 * the account the user originally registered/logged in with — immutable
 * through this endpoint; a secondary link is added via `oauthLink`/removed
 * via `oauthUnlink`. */
export type LinkedOAuthAccount = Schemas["LinkedOAuthAccountDTO"];

// ── Sessions ─────────────────────────────────────────────────────────────────

/**
 * NOT GENERATED as an enum: `SessionResponse.device_type` is a bare string in
 * the schema. This convenience union documents the icon-rendering categories
 * (auth-sa.md §12); it is assignable from the generated `string` field.
 */
export type SessionDeviceType =
  | "phone"
  | "tablet"
  | "desktop"
  | "api"
  | "unknown";

export type AuthSession = Schemas["SessionResponse"];

// ── TOTP ─────────────────────────────────────────────────────────────────────

export type TotpSetupResponse = Schemas["TOTPSetupResponse"];

/**
 * Optional replace-proof body for `POST /totp/setup/` (stapel-auth ≥0.9.0):
 * both fields are optional because first-time enrollment (no active device
 * yet) needs neither, but if an active device already exists, one of `code`/
 * `backup_code` must prove it — omitting both raises 400
 * `totp_proof_required` (see `TotpSetupState`'s `"proofRequired"` step in
 * `../flows/totpSetupFlow.js`). Lost the device entirely (neither proof
 * available)? That's the delayed-removal flow below, not this request body.
 */
export type TotpSetupRequest = Schemas["TOTPSetupRequest"];

/**
 * ADAPTER (2): the generated `backup_codes` is `unknown[]`; the endpoint
 * returns a list of string codes.
 */
export type TotpSetupConfirmResponse = Omit<
  Schemas["TOTPSetupConfirmResponse"],
  "backup_codes"
> & {
  readonly backup_codes: readonly string[];
};

/** `oneOf` discriminated by `method` (totp / backup / otp). */
export type TotpDisableRequest = Schemas["TOTPDisableRequest"];

// ── Verification / step-up ───────────────────────────────────────────────────

/**
 * NOT GENERATED as an enum: the challenge `factors` field is `unknown[]` in the
 * schema. The interchangeable factor ids are a closed set (auth-sa.md §11 /
 * flows-and-verification.md §2).
 */
export type VerificationFactorId =
  | "otp_email"
  | "otp_phone"
  | "totp"
  | "passkey";

/**
 * The `verification` object inside the 403 envelope.
 *
 * ADAPTER (2): type `factors` down to the known factor-id set.
 */
export type VerificationEnvelope = Omit<
  Schemas["VerificationChallengeInfoResponse"],
  "factors"
> & {
  readonly factors: readonly VerificationFactorId[];
};

/**
 * ADAPTER (3): `initiate` always returns `data` (masked target for OTP, or
 * `{ session_key, options }` for passkey); the generator marks it optional.
 */
export type VerificationInitiateResponse = Omit<
  Schemas["VerificationInitiateResponse"],
  "data"
> & {
  readonly data: Record<string, unknown>;
};

export type VerificationCompleteResponse =
  Schemas["VerificationCompleteResponse"];

// ── QR ───────────────────────────────────────────────────────────────────────

export type QrType = Schemas["QRGenerateTypeEnum"];
export type QrGenerateResponse = Schemas["QRGenerateResponse"];
export type QrStatusValue = Schemas["QRStatusResponseStatusEnum"];
export type QrStatusResponse = Schemas["QRStatusResponse"];

// ── Passkeys ─────────────────────────────────────────────────────────────────

export type Passkey = Schemas["PasskeyItem"];

// NOT GENERATED: the WebAuthn `begin` endpoints return opaque
// PublicKeyCredential*Options JSON with no named response serializer in the
// schema. Kept as thin `Record` carriers (the ceremony is host/injected — see
// MODULE.md "Thin-WebAuthn").
export interface PasskeyRegisterBeginResponse {
  /** PublicKeyCredentialCreationOptions (JSON form). */
  readonly options: Record<string, unknown>;
}

export interface PasskeyAuthenticateBeginResponse {
  readonly session_key: string;
  /** PublicKeyCredentialRequestOptions (JSON form). */
  readonly options: Record<string, unknown>;
}

// ── Authenticator change ─────────────────────────────────────────────────────

export type ChangeOldVerifiedResponse = Schemas["InstantVerifyOldResponse"];
export type DelayedChangeInitiatedResponse = Schemas["DelayedInitiateResponse"];
export type DelayedChangeStatus = Schemas["DelayedStatusResponse"];

/**
 * TOTP's delayed-removal ("lost device") flow (stapel-auth ≥0.9.0,
 * `/totp/change/delayed/*`) is server-side the SAME `AuthenticatorChangeRequest`
 * machine as email/phone delayed change — same cooldown, same day-1/7/13
 * notifications, same cancel window — and reuses these exact response
 * dataclasses; `new_value_masked` is always the literal `"authenticator app"`.
 * The only difference is what applies at the end (a TOTP disable, not a
 * contact swap), which is invisible to these response shapes. No separate
 * alias needed — `DelayedChangeInitiatedResponse`/`DelayedChangeStatus` cover
 * both.
 */

// ── SSO ──────────────────────────────────────────────────────────────────────

export type SsoLookupResponse = Schemas["SSODomainLookupResponse"];

// ── Audit log ────────────────────────────────────────────────────────────────

export type AuditEvent = Schemas["AuditLogEntry"];
export type AuditPage = Schemas["AuditLogPage"];
