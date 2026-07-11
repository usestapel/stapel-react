import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { authErrorBundleEn } from "./generated/errors.gen.js";

/**
 * auth-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's
 * i18n engine (`useT`). Backend error codes (auth-sa.md "Error reference")
 * flow through the SAME contour: a `StapelApiError.code` like
 * `error.400.code_expired` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes and auth-react's UI keys.
 * Point core's `loadLocale` at stapel-translate to override per locale.
 */
export const AUTH_I18N_KEYS = {
  // Flow UI keys (auth-react-owned)
  otpEnterCode: "auth.otp.enter_code",
  otpResend: "auth.otp.resend",
  otpSentTo: "auth.otp.sent_to",
  passwordLabel: "auth.password.label",
  totpEnterCode: "auth.totp.enter_code",
  totpUseBackup: "auth.totp.use_backup",
  verificationChoose: "auth.verification.choose_factor",
  verificationSuccess: "auth.verification.success",
  sessionThisDevice: "auth.session.this_device",
  sessionSuspicious: "auth.session.suspicious",
  passkeyNoCredentials: "auth.passkey.no_credentials",
  unknownError: "auth.error.unknown",

  // Default-skin UI keys (§54 AuthPanel). Rendered by @stapel/auth-react/default;
  // the headless layer never uses them. Kept here so the manifest i18n scan
  // (gen:manifest) registers them and `stapel/i18n-key-exists` recognises them.
  uiLoginTitle: "auth.ui.login_title",
  uiOr: "auth.ui.or",
  uiMoreMethods: "auth.ui.more_methods",
  uiResendIn: "auth.ui.resend_in",
  uiEmailLabel: "auth.ui.email_label",
  uiEmailPlaceholder: "auth.ui.email_placeholder",
  uiPhoneLabel: "auth.ui.phone_label",
  uiPhonePlaceholder: "auth.ui.phone_placeholder",
  uiSendCode: "auth.ui.send_code",
  uiContinue: "auth.ui.continue",
  uiSubmit: "auth.ui.submit",
  uiPasswordPlaceholder: "auth.ui.password_placeholder",
  uiQrHint: "auth.ui.qr_hint",
  uiPasskeyCta: "auth.ui.passkey_cta",
  uiMagicLinkCta: "auth.ui.magic_link_cta",
  uiMagicLinkSentTitle: "auth.ui.magic_link_sent_title",
  uiMagicLinkSentBody: "auth.ui.magic_link_sent_body",
  uiSsoDomainLabel: "auth.ui.sso_domain_label",
  uiSsoContinue: "auth.ui.sso_continue",
  uiChannelEmail: "auth.ui.channel_email",
  uiChannelPhone: "auth.ui.channel_phone",
  uiChannelPassword: "auth.ui.channel_password",
  uiChannelPasskey: "auth.ui.channel_passkey",
  uiChannelOauth: "auth.ui.channel_oauth",
  uiChannelSso: "auth.ui.channel_sso",
  uiChannelQr: "auth.ui.channel_qr",
  uiChannelMagicLink: "auth.ui.channel_magic_link",
} as const;

export type AuthI18nKey =
  (typeof AUTH_I18N_KEYS)[keyof typeof AUTH_I18N_KEYS];

/**
 * English fallback bundle for auth-react UI keys + backend auth error codes.
 *
 * The generated `authErrorBundleEn` (from stapel-auth's error registry, `pnpm
 * gen:errors`) is spread FIRST so every backend `error.*` key has a fallback —
 * a `StapelApiError.code` never renders as a raw key (this closes the 43
 * uncovered keys the pair review flagged). The hand-polished copy below then
 * OVERRIDES the generated backend English for the keys users see most, and adds
 * the auth-react-owned UI keys. A `gen:errors:check` drift gate + the
 * `errorsBundle` test keep new backend keys from slipping through silently.
 */
export const authI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...authErrorBundleEn,

  // auth-react UI
  "auth.otp.enter_code": "Enter the code we sent you",
  "auth.otp.resend": "Resend code",
  "auth.otp.sent_to": "Code sent to {target}",
  "auth.password.label": "Password",
  "auth.totp.enter_code": "Enter your 6-digit code",
  "auth.totp.use_backup": "Use a backup code",
  "auth.verification.choose_factor": "Verify it's you",
  "auth.verification.success": "Verified",
  "auth.session.this_device": "This device",
  "auth.session.suspicious": "Unrecognized sign-in",
  "auth.passkey.no_credentials":
    "Couldn't sign in with a passkey on this device. Add one in Security settings after signing in another way, or pick a different sign-in method below.",
  "auth.error.unknown": "Something went wrong. Please try again.",

  // Default-skin UI (§54 AuthPanel)
  "auth.ui.login_title": "Sign in",
  "auth.ui.or": "or",
  "auth.ui.more_methods": "More ways to sign in",
  "auth.ui.resend_in": "Resend in {s}s",
  "auth.ui.email_label": "Email",
  "auth.ui.email_placeholder": "you@example.com",
  "auth.ui.phone_label": "Phone",
  "auth.ui.phone_placeholder": "+1 555 000 0000",
  "auth.ui.send_code": "Send code",
  "auth.ui.continue": "Continue",
  "auth.ui.submit": "Sign in",
  "auth.ui.password_placeholder": "Your password",
  "auth.ui.qr_hint": "Scan this code with your phone to sign in.",
  "auth.ui.passkey_cta": "Use a passkey",
  "auth.ui.magic_link_cta": "Email me a sign-in link",
  "auth.ui.magic_link_sent_title": "Check your email",
  "auth.ui.magic_link_sent_body": "We sent you a sign-in link. Open it on this device.",
  "auth.ui.sso_domain_label": "Work email domain",
  "auth.ui.sso_continue": "Continue with SSO",
  "auth.ui.channel_email": "Email",
  "auth.ui.channel_phone": "Phone",
  "auth.ui.channel_password": "Password",
  "auth.ui.channel_passkey": "Passkey",
  "auth.ui.channel_oauth": "Social",
  "auth.ui.channel_sso": "SSO",
  "auth.ui.channel_qr": "QR code",
  "auth.ui.channel_magic_link": "Magic link",

  // Backend error codes (auth-sa.md "Error reference")
  "error.401.invalid_credentials": "Incorrect email or password.",
  "error.401.account_disabled": "This account has been disabled.",
  "error.401.refresh_revoked": "Your session ended. Please sign in again.",
  "error.400.code_expired": "That code has expired. Request a new one.",
  "error.400.invalid_code": "That code is incorrect.",
  "error.400.invalid_code_attempts":
    "That code is incorrect. {attempts_remaining} attempts left.",
  "error.422.blocked": "Too many attempts. Try again in {retry_after_minutes} min.",
  "error.429.rate_limit": "Please wait before requesting another code.",
  "error.400.no_verified_contact": "No verified contact for this method.",
  "error.400.wrong_password": "Your current password is incorrect.",
  "error.400.no_password": "This account has no password set.",
  "error.404.user_for_reset": "No account found for that email or phone.",
  "error.403.mock_otp_admin": "Admin accounts can't use codes in this environment.",
  "error.400.code_required": "A code is required.",
  "error.400.totp_not_pending": "Start two-factor setup first.",
  "error.423.account_locked":
    "Account locked. Try again in {retry_after_minutes} min.",
  "error.429.magic_link_rate": "Too many login-link requests. Try again later.",
  "error.400.passkey_invalid": "Passkey verification failed.",
  "error.400.passkey_challenge_expired": "Passkey request expired. Try again.",
  "error.409.passkey_already_registered": "This passkey is already registered.",
  "error.400.last_auth_method": "You can't remove your last sign-in method.",
  "error.400.invalid_redirect_url": "Invalid redirect.",
  "error.400.magic_link_invalid": "This login link is invalid or has expired.",
  "error.400.captcha_required": "Please complete the captcha.",
  "error.400.captcha_invalid": "Captcha verification failed.",
  "error.403.verification_required": "Additional verification required.",
  "error.404.verification_challenge_not_found":
    "This verification expired. Please retry the action.",
  "error.400.verification_invalid_factor": "That verification option isn't available.",
  "error.400.verification_failed": "Verification failed. Try again.",
  "error.423.verification_locked": "Too many attempts. Retry the action later.",
  "error.404.sso_org_not_found": "Organization not found.",
  "error.400.sso_not_configured": "SSO isn't configured for this organization.",
  "error.403.sso_required": "This account must sign in with SSO.",
};

/**
 * Register auth-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`); a later
 * `loadLocale` from stapel-translate can layer localized overrides.
 *
 * MERGE-PRIORITY CONVENTION (pair checklist rule; i18n-shipping.md §3 — every
 * `@stapel/*-react` pair follows it, wave-2 sweeps copy it verbatim):
 * registration order IS override priority, later wins per key. Within a locale,
 * layers register bottom-up:
 *
 *   1. generated en floor  (`<pair>ErrorBundleEn` — coverage by construction),
 *   2. the pair's polish / UI copy (this bundle spreads 1 then overrides),
 *   3. the pair's locale bundle from the `./i18n/<locale>` subpath
 *      (e.g. `registerAuthI18nRu` — registers the en floor UNDER the locale
 *      texts so a missing key degrades to English, never to a raw key),
 *   4. the HOST's own bundle — always registered LAST, so a host overrides any
 *      pair text without a fork (the frontend twin of the backend's later-wins
 *      catalog merge).
 *
 * Dynamic overrides (stapel-translate `loadLocale`) layer on top at runtime.
 */
export function registerAuthI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, authI18nBundleEn);
}
