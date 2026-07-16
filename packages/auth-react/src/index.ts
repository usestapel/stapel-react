/**
 * `@stapel/auth-react` — the headless React flow pair for stapel-auth
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createAuthApi } from "./api/authApi.js";
export type { AuthApi } from "./api/authApi.js";
export {
  authUrls,
  validRedirectUrl,
  safeNextPath,
  safeScanRedirect,
} from "./api/urls.js";
export type { AuthUrls } from "./api/urls.js";
export { isTotpChallenge } from "./api/types.js";
export type {
  AuthStatus,
  StapelUser,
  AuthTokens,
  AuthResponse,
  TOTPChallengeResponse,
  LoginResponse,
  OtpRequestResponse,
  StatusResponse,
  OtpChannel,
  OAuthProviderInfo,
  RegistrationCapabilities,
  LoginCapabilities,
  ChannelPlacement,
  ChannelInteraction,
  ChannelPlanEntry,
  Capabilities,
  PasswordChangeMethod,
  PasswordMethodEntry,
  PasswordMethods,
  SecurityStatus,
  SessionDeviceType,
  AuthSession as AuthSessionRecord,
  TotpSetupResponse,
  TotpSetupConfirmResponse,
  TotpDisableRequest,
  VerificationFactorId,
  VerificationEnvelope,
  VerificationInitiateResponse,
  VerificationCompleteResponse,
  QrType,
  QrGenerateResponse,
  QrStatusValue,
  QrStatusResponse,
  Passkey,
  PasskeyRegisterBeginResponse,
  PasskeyAuthenticateBeginResponse,
  ChangeOldVerifiedResponse,
  DelayedChangeInitiatedResponse,
  DelayedChangeStatus,
  SsoLookupResponse,
  AuditEvent,
  AuditPage,
  RefreshResponse,
} from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive now lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported here for one minor
// so existing `@stapel/auth-react` imports keep resolving.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";

export { createOtpFlow } from "./flows/otpFlow.js";
export type { OtpFlow, OtpFlowDeps, OtpState } from "./flows/otpFlow.js";
export { createPasswordLoginFlow } from "./flows/passwordLoginFlow.js";
export type {
  PasswordLoginFlow,
  PasswordLoginFlowDeps,
  PasswordLoginState,
  TotpProof,
} from "./flows/passwordLoginFlow.js";
export { createPasswordChangeFlow } from "./flows/passwordChangeFlow.js";
export type {
  PasswordChangeFlow,
  PasswordChangeFlowDeps,
  PasswordChangeState,
} from "./flows/passwordChangeFlow.js";
export { createPasswordResetFlow } from "./flows/passwordResetFlow.js";
export type {
  PasswordResetFlow,
  PasswordResetFlowDeps,
  PasswordResetState,
} from "./flows/passwordResetFlow.js";
export { createVerificationController } from "./flows/verificationFlow.js";
export type {
  VerificationController,
  VerificationControllerDeps,
  VerificationState,
} from "./flows/verificationFlow.js";
export { createTotpSetupFlow } from "./flows/totpSetupFlow.js";
export type {
  TotpSetupFlow,
  TotpSetupFlowDeps,
  TotpSetupState,
} from "./flows/totpSetupFlow.js";
export { createOAuthFlow } from "./flows/oauthFlow.js";
export type { OAuthFlow, OAuthFlowDeps, OAuthState } from "./flows/oauthFlow.js";
export { createQrLoginFlow } from "./flows/qrLoginFlow.js";
export type {
  QrLoginFlow,
  QrLoginFlowDeps,
  QrLoginState,
} from "./flows/qrLoginFlow.js";
export {
  createPasskeyRegistrationFlow,
  createPasskeyLoginFlow,
} from "./flows/passkeyFlow.js";
export type {
  PasskeyRegistrationFlow,
  PasskeyRegistrationFlowDeps,
  PasskeyRegisterState,
  PasskeyLoginFlow,
  PasskeyLoginFlowDeps,
  PasskeyLoginState,
} from "./flows/passkeyFlow.js";
export { createMagicLinkFlow } from "./flows/magicLinkFlow.js";
export type {
  MagicLinkFlow,
  MagicLinkFlowDeps,
  MagicLinkState,
} from "./flows/magicLinkFlow.js";
export { createAnonymousFlow } from "./flows/anonymousFlow.js";
export type {
  AnonymousFlow,
  AnonymousFlowDeps,
  AnonymousState,
} from "./flows/anonymousFlow.js";
export { createSsoFlow } from "./flows/ssoFlow.js";
export type { SsoFlow, SsoFlowDeps, SsoState } from "./flows/ssoFlow.js";
export { createAuthenticatorChangeFlow } from "./flows/authenticatorChangeFlow.js";
export type {
  AuthenticatorChangeFlow,
  AuthenticatorChangeFlowDeps,
  AuthenticatorChangeState,
} from "./flows/authenticatorChangeFlow.js";

// ── model (runtime wiring, session, query hooks) ─────────────────────────────
export { createAuthRuntime } from "./model/runtime.js";
export type { AuthRuntime, CreateAuthRuntimeOptions } from "./model/runtime.js";
export { createAuthSession } from "./model/session.js";
export type {
  AuthSession,
  AuthSessionState,
  AuthSessionOptions,
  TeardownReason,
} from "./model/session.js";
export {
  AuthRuntimeContext,
  useAuthRuntime,
  useAuthApi,
  useAuthSession,
  useVerification,
  useAuthAnalytics,
  useAuthSessionState,
} from "./model/context.js";
export { authQueryKeys } from "./model/queryKeys.js";
export {
  useCapabilities,
  useMe,
  useSecurityStatus,
  usePasswordMethods,
  useSessions,
  usePasskeys,
  useAuditLog,
  useDelayedChangeStatus,
  useSsoLookup,
} from "./model/queries.js";
export {
  useLogout,
  useRevokeSession,
  useRevokeOtherSessions,
  useConfirmSession,
  useRemovePasskey,
  useDisableTotp,
  useCancelDelayedChange,
} from "./model/mutations.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { AuthProvider } from "./headless/AuthProvider.js";
export { PasswordlessLogin } from "./headless/PasswordlessLogin.js";
export type { PasswordlessLoginBag } from "./headless/PasswordlessLogin.js";
export { PasswordLogin } from "./headless/PasswordLogin.js";
export type { PasswordLoginBag } from "./headless/PasswordLogin.js";
export { PasswordReset } from "./headless/PasswordReset.js";
export type { PasswordResetBag } from "./headless/PasswordReset.js";
export { PasswordChange } from "./headless/PasswordChange.js";
export type { PasswordChangeBag } from "./headless/PasswordChange.js";
export { VerificationChallenge } from "./headless/VerificationChallenge.js";
export type { VerificationChallengeBag } from "./headless/VerificationChallenge.js";
export { TotpSetup } from "./headless/TotpSetup.js";
export type { TotpSetupBag } from "./headless/TotpSetup.js";
export { QrLogin } from "./headless/QrLogin.js";
export type { QrLoginBag } from "./headless/QrLogin.js";
export { PasskeyRegistration, PasskeyLogin } from "./headless/Passkey.js";
export type {
  WebauthnBinding,
  PasskeyRegistrationBag,
  PasskeyLoginBag,
} from "./headless/Passkey.js";
export {
  MagicLink,
  AnonymousSession,
  SsoDiscovery,
  AuthenticatorChange,
} from "./headless/misc.js";
export type {
  MagicLinkBag,
  AnonymousBag,
  SsoDiscoveryBag,
  AuthenticatorChangeBag,
} from "./headless/misc.js";
export {
  usePhoneCountryDefault,
  DEFAULT_DIAL_CODES,
} from "./headless/usePhoneCountryDefault.js";
export type {
  UsePhoneCountryDefaultOptions,
  PhoneCountryDefault,
} from "./headless/usePhoneCountryDefault.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  AUTH_I18N_KEYS,
  authI18nBundleEn,
  registerAuthI18n,
} from "./i18n/keys.js";
export type { AuthI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  AUTH_ERRORS,
  AUTH_ERROR_CODES,
  authErrorBundleEn,
  explainAuthError,
} from "./i18n/errorsMap.js";
export type {
  AuthErrorCode,
  AuthErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
