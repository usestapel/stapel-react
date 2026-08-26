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
  /**
   * Shown on the code step when `capabilities.login.{email,phone}_mock` says
   * this channel's delivery is mocked: nothing was actually sent, so a user
   * waiting for an email or an SMS would wait forever. The hint says that and
   * nothing more — the mock code itself is a credential and is never rendered.
   */
  otpMockDelivery: "auth.otp.mock_delivery",
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
  /** No `navigator.credentials` here at all (old browser, insecure context). */
  passkeyUnsupported: "auth.passkey.unsupported",
  /**
   * The five browser-side passkey outcomes, each with its own sentence
   * (`flows/errors.ts`, `toPasskeyFlowError`). They used to be one:
   * `navigator.credentials` rejects with a DOMException, which is not a
   * StapelApiError, so every one of them folded into `auth.error.unknown` —
   * "Something went wrong. Please try again." — including the case where
   * trying again is precisely what cannot work.
   *
   * `declined` covers dismissal AND "this device has no passkey for us",
   * because WebAuthn deliberately refuses to distinguish them: reporting the
   * difference would make the prompt an oracle for whether an account exists
   * on the device. The copy therefore says both, out loud.
   */
  passkeyDeclined: "auth.passkey.declined",
  passkeyTimeout: "auth.passkey.timeout",
  passkeyInsecure: "auth.passkey.insecure",
  passkeyAlreadyOnDevice: "auth.passkey.already_on_device",
  passkeyFailed: "auth.passkey.failed",
  unknownError: "auth.error.unknown",

  // Default-skin UI keys (§54 AuthPanel). Rendered by @stapel/auth-react/default;
  // the headless layer never uses them. Kept here so the manifest i18n scan
  // (gen:manifest) registers them and `stapel/i18n-key-exists` recognises them.
  uiLoginTitle: "auth.ui.login_title",
  uiOr: "auth.ui.or",
  uiMoreMethods: "auth.ui.more_methods",
  uiContinueAsGuest: "auth.ui.continue_as_guest",
  uiContinueAsGuestPending: "auth.ui.continue_as_guest_pending",
  uiContinueAsGuestHint: "auth.ui.continue_as_guest_hint",
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
  uiSsoDomainPlaceholder: "auth.ui.sso_domain_placeholder",
  uiSsoContinue: "auth.ui.sso_continue",
  uiChannelEmail: "auth.ui.channel_email",
  uiChannelPhone: "auth.ui.channel_phone",
  uiChannelPassword: "auth.ui.channel_password",
  uiChannelPasskey: "auth.ui.channel_passkey",
  uiChannelOauth: "auth.ui.channel_oauth",
  uiChannelSso: "auth.ui.channel_sso",
  uiChannelQr: "auth.ui.channel_qr",
  uiChannelMagicLink: "auth.ui.channel_magic_link",
  /** Re-run a read that failed — `ErrorAlert`'s action button. */
  uiRetry: "auth.ui.retry",
  /** The dialog/sheet dismissal — `SkinDialog`'s `dismissLabel`, which is the
   * accessible name of the sheet's grab handle and of the modal's close
   * button. The token bridge owns no i18n, so the caller supplies the copy. */
  uiClose: "auth.ui.close",
  /** Title of the sheet that appears ONLY when a passkey sign-in did not
   * happen — the system prompt is the primary UI, this is the fallback. */
  uiPasskeyFailedTitle: "auth.ui.passkey_failed_title",
  /** The way out of that sheet: the other sign-in methods are behind it. */
  uiPasskeyPickAnother: "auth.ui.passkey_pick_another",

  // Registration surface (§68 promote/orphan fix follow-up): a channel-
  // filtered `AuthPanel mode="register"` — same zone machinery as the login
  // panel, but only `can_register===true` channels, and the password channel
  // renders a SET-password form (`PasswordRegisterPanel`), not the login one.
  uiRegisterTitle: "auth.ui.register_title",
  uiRegisterConfirmLabel: "auth.ui.register_confirm_label",
  uiRegisterMismatch: "auth.ui.register_mismatch",
  uiRegisterSubmit: "auth.ui.register_submit",

  // Per-method capability labels (SecuritySettings widgets) — THE IDENTITY
  // MODEL: a method can be login-only, registration-only, both, or — for
  // password specifically, on an anonymous account — neither (it only makes
  // the guest session portable to another device, see `secMethodCapPortableAnon`).
  secMethodCapLogin: "auth.sec.method_cap.login",
  secMethodCapRegister: "auth.sec.method_cap.register",
  secMethodCapBoth: "auth.sec.method_cap.both",
  secMethodCapPortableAnon: "auth.sec.method_cap.portable_anon",

  // Security-profile default-skin components (owner directive point 5):
  // SessionsList, TotpManager, PasskeysManager, PasswordChangePanel, OAuthLinks.
  secSessionsTitle: "auth.sec.sessions.title",
  secSessionsSubtitle: "auth.sec.sessions.subtitle",
  secSessionsSignOut: "auth.sec.sessions.sign_out",
  secSessionsSignOutAll: "auth.sec.sessions.sign_out_all",
  secSessionsConfirmMe: "auth.sec.sessions.confirm_me",
  secSessionsSignOutConfirmTitle: "auth.sec.sessions.sign_out_confirm_title",
  secSessionsSignOutAllConfirmTitle: "auth.sec.sessions.sign_out_all_confirm_title",
  secSessionsEmpty: "auth.sec.sessions.empty",
  secSessionsLastUsed: "auth.sec.sessions.last_used",

  secTotpTitle: "auth.sec.totp.title",
  secTotpEnabled: "auth.sec.totp.enabled",
  secTotpDisabled: "auth.sec.totp.disabled",
  secTotpBackupRemaining: "auth.sec.totp.backup_remaining",
  secTotpSetUp: "auth.sec.totp.set_up",
  secTotpDisable: "auth.sec.totp.disable",
  secTotpSetupTitle: "auth.sec.totp.setup_title",
  secTotpScanHint: "auth.sec.totp.scan_hint",
  secTotpSecretLabel: "auth.sec.totp.secret_label",
  secTotpConfirmLabel: "auth.sec.totp.confirm_label",
  secTotpConfirmCta: "auth.sec.totp.confirm_cta",
  secTotpBackupCodesTitle: "auth.sec.totp.backup_codes_title",
  secTotpBackupCodesHint: "auth.sec.totp.backup_codes_hint",
  secTotpBackupCodesAck: "auth.sec.totp.backup_codes_ack",
  secTotpDisableTitle: "auth.sec.totp.disable_title",
  secTotpDisableCodeLabel: "auth.sec.totp.disable_code_label",
  secTotpDisableBackupLabel: "auth.sec.totp.disable_backup_label",
  secTotpUseBackupToggle: "auth.sec.totp.use_backup_toggle",

  // TOTP replace (instant, proof-gated) + delayed removal ("lost device") —
  // stapel-auth ≥0.9.0. Mirrors `secChange*`'s instant/delayed split, just
  // scoped to a single factor with no channel/new-value axis.
  secTotpReplace: "auth.sec.totp.replace",
  secTotpReplaceTitle: "auth.sec.totp.replace_title",
  secTotpReplaceHint: "auth.sec.totp.replace_hint",
  secTotpReplaceContinueCta: "auth.sec.totp.replace_continue_cta",
  secTotpLostCta: "auth.sec.totp.lost_cta",
  secTotpDelayedHint: "auth.sec.totp.delayed_hint",
  secTotpDelayedCta: "auth.sec.totp.delayed_cta",
  secTotpPendingMessage: "auth.sec.totp.pending_message",
  secTotpPendingNote: "auth.sec.totp.pending_note",
  secTotpNoContactTitle: "auth.sec.totp.no_contact_title",
  secTotpNoContactHint: "auth.sec.totp.no_contact_hint",

  secPasskeysTitle: "auth.sec.passkeys.title",
  secPasskeysAdd: "auth.sec.passkeys.add",
  secPasskeysRemove: "auth.sec.passkeys.remove",
  secPasskeysEmpty: "auth.sec.passkeys.empty",
  secPasskeysAwaitingCeremony: "auth.sec.passkeys.awaiting_ceremony",
  secPasskeysRemoveConfirmTitle: "auth.sec.passkeys.remove_confirm_title",
  secPasskeysAddedSuccess: "auth.sec.passkeys.added_success",
  /**
   * The credential-management row (owner report 2026-08-24). It used to end in
   * a green `auth.ui.submit` button — the SIGN-IN button's copy in every
   * locale — offered to someone who is, necessarily, already signed in. These
   * are what a row about a stored credential actually says: what it is, when
   * it was added, when it was last used, and the actions that exist.
   */
  secPasskeysDone: "auth.sec.passkeys.done",
  secPasskeysAddedOn: "auth.sec.passkeys.added_on",
  secPasskeysLastUsed: "auth.sec.passkeys.last_used",
  secPasskeysNeverUsed: "auth.sec.passkeys.never_used",
  secPasskeysAddAnother: "auth.sec.passkeys.add_another",
  /** What the credential lives in, read from `transports[]`. */
  secPasskeysKindDevice: "auth.sec.passkeys.kind_device",
  secPasskeysKindSecurityKey: "auth.sec.passkeys.kind_security_key",
  secPasskeysKindPhone: "auth.sec.passkeys.kind_phone",
  secPasskeysKindUnknown: "auth.sec.passkeys.kind_unknown",
  /** Why "Add" is not available here (no WebAuthn in this browser). */
  secPasskeysAddUnsupported: "auth.sec.passkeys.add_unsupported",

  secPasswordTitle: "auth.sec.password.title",
  secPasswordOldLabel: "auth.sec.password.old_label",
  secPasswordNewLabel: "auth.sec.password.new_label",
  secPasswordConfirmLabel: "auth.sec.password.confirm_label",
  secPasswordMismatch: "auth.sec.password.mismatch",
  secPasswordChangeCta: "auth.sec.password.change_cta",
  secPasswordViaOtpHint: "auth.sec.password.via_otp_hint",
  secPasswordSuccess: "auth.sec.password.success",
  /** The account genuinely has no way to change its password from here — the
   * only sentence allowed on a SUCCESSFUL, empty `usePasswordMethods()`. */
  secPasswordNoMethods: "auth.sec.password.no_methods",

  secOauthTitle: "auth.sec.oauth.title",
  secOauthLinked: "auth.sec.oauth.linked",
  secOauthLink: "auth.sec.oauth.link",
  secOauthUnlink: "auth.sec.oauth.unlink",
  secOauthUnlinkLabel: "auth.sec.oauth.unlink_label",
  secOauthUnlinkConfirmTitle: "auth.sec.oauth.unlink_confirm_title",
  secOauthEmpty: "auth.sec.oauth.empty",
  secOauthUnlinkUnavailable: "auth.sec.oauth.unlink_unavailable",
  secOauthLinkUnavailable: "auth.sec.oauth.link_unavailable",

  // Authenticator (email/phone) change — `AuthenticatorChangePanel` (the
  // shared, channel-parametrized implementation behind `EmailChangePanel`/
  // `PhoneChangePanel`), built on the EXISTING `<AuthenticatorChange>`
  // headless flow (instant) + `useDelayedChangeStatus`/`useCancelDelayedChange`/
  // `useInitiateDelayedChange` (delayed). `{channel}` params carry the
  // already-translated channel word (`uiChannelEmail`/`uiChannelPhone`) so one
  // key bundle serves both panels.
  secChangeCurrentValue: "auth.sec.change.current_value",
  secChangeCta: "auth.sec.change.cta",
  secChangeInstantHint: "auth.sec.change.instant_hint",
  secChangeNoAccessCta: "auth.sec.change.no_access_cta",
  secChangeOldCodeHint: "auth.sec.change.old_code_hint",
  secChangeNewValueLabel: "auth.sec.change.new_value_label",
  secChangeRequestNewCta: "auth.sec.change.request_new_cta",
  secChangeNewCodeHint: "auth.sec.change.new_code_hint",
  secChangeConfirmCta: "auth.sec.change.confirm_cta",
  secChangeSuccess: "auth.sec.change.success",
  secChangeRetry: "auth.sec.change.retry",
  secChangeDelayedFormHint: "auth.sec.change.delayed_form_hint",
  secChangeDelayedSubmitCta: "auth.sec.change.delayed_submit_cta",
  secChangeDelayedStarted: "auth.sec.change.delayed_started",
  secChangePendingMessage: "auth.sec.change.pending_message",
  secChangePendingNote: "auth.sec.change.pending_note",
  secChangePendingCancel: "auth.sec.change.pending_cancel",
  secChangeCancelConfirmTitle: "auth.sec.change.cancel_confirm_title",

  // Security audit log — `AuditLogPanel` (`AuditLogViewSet`, auth-sa.md §16).
  secAuditTitle: "auth.sec.audit.title",
  secAuditEmpty: "auth.sec.audit.empty",
  secAuditIp: "auth.sec.audit.ip",
  secAuditLoadMore: "auth.sec.audit.load_more",

  // `SecuritySettings` page chrome + its grouped section headings.
  secPageTitle: "auth.sec.page.title",
  secPageSubtitle: "auth.sec.page.subtitle",
  secGroupContact: "auth.sec.group.contact",
  secGroupPassword: "auth.sec.group.password",
  secGroupTwoFactor: "auth.sec.group.two_factor",
  secGroupDevices: "auth.sec.group.devices",
  secGroupConnected: "auth.sec.group.connected",
  secGroupAudit: "auth.sec.group.audit",

  // QR device-handoff (session_share) — auth-sa.md §8, owner directive point 5
  // + the "call it from anywhere, not just settings" follow-up: title/subtitle
  // are component props with these as English defaults, so a host embedding
  // it on e.g. a meeting-room page can override the copy without a fork.
  secQrTitle: "auth.sec.qr.title",
  secQrSubtitle: "auth.sec.qr.subtitle",
  secQrShowCta: "auth.sec.qr.show_cta",
  secQrCancel: "auth.sec.qr.cancel",
  secQrExpiresIn: "auth.sec.qr.expires_in",
  secQrExpiring: "auth.sec.qr.expiring",
  secQrFulfilled: "auth.sec.qr.fulfilled",
  secQrRejected: "auth.sec.qr.rejected",
  secQrRetry: "auth.sec.qr.retry",
  secQrRegenerating: "auth.sec.qr.regenerating",

  // QR `login_request` confirmation (`<QrConfirmPanel/>`, nav `auth.qr_confirm`)
  // — the screen stapel-auth's `/qr/{key}/scan/` redirects a signed-in scanner
  // to. The copy addresses the person holding the PHONE about the OTHER
  // device: they are approving a sign-in they cannot see.
  qrConfirmTitle: "auth.qr.confirm.title",
  qrConfirmSubtitle: "auth.qr.confirm.subtitle",
  qrConfirmApprove: "auth.qr.confirm.approve",
  qrConfirmDecline: "auth.qr.confirm.decline",
  qrConfirmApproved: "auth.qr.confirm.approved",
  qrConfirmDeclined: "auth.qr.confirm.declined",
  qrConfirmNoKey: "auth.qr.confirm.no_key",
  qrErrorSessionNotAdopted: "auth.qr.error.session_not_adopted",

  // First-login enforcement (org-program §C2, stapel-auth ≥0.12.0) — the
  // FIRST_LOGIN_REQUIRED intermediates: forced password change
  // (`ForcedPasswordChange` headless / `ForcedPasswordChangeCard` skin) and
  // MFA enrollment (`MfaEnrollGate` headless / `MfaEnrollPanel` skin).
  forcedChangeTitle: "auth.forcedChange.title",
  forcedChangeHint: "auth.forcedChange.hint",
  forcedChangeNewLabel: "auth.forcedChange.new_label",
  forcedChangeConfirmLabel: "auth.forcedChange.confirm_label",
  forcedChangeMismatch: "auth.forcedChange.mismatch",
  forcedChangeSubmit: "auth.forcedChange.submit",
  forcedChangeSuccess: "auth.forcedChange.success",

  mfaEnrollTitle: "auth.mfaEnroll.title",
  mfaEnrollHint: "auth.mfaEnroll.hint",
  mfaEnrollPreparing: "auth.mfaEnroll.preparing",
  mfaEnrollMethodTotp: "auth.mfaEnroll.method_totp",
  mfaEnrollMethodPasskey: "auth.mfaEnroll.method_passkey",
  mfaEnrollBackupCodesAck: "auth.mfaEnroll.backup_codes_ack",
  mfaEnrollSuccess: "auth.mfaEnroll.success",
  mfaEnrollRestartHint: "auth.mfaEnroll.restart_hint",
  mfaEnrollNoTokens: "auth.mfaEnroll.error.no_tokens",

  // Nav-manifest labels (`../nav/manifest.ts`) — read by a shell (e.g.
  // `@stapel/shell-react`'s `AppShell`) via `t(entry.labelKey)`, never by
  // this pair's own components directly.
  navLogin: "auth.nav.login",
  navSecurity: "auth.nav.security",
  navQrConfirm: "auth.nav.qr_confirm",

  // Sign-in surface: the way between the two variants. The register screen
  // used to be a dead end (no route back to sign-in) and the sign-in screen
  // never offered registration at all — a host had to wire two routes to get
  // the pair of doors every account system has.
  uiSwitchToRegister: "auth.ui.switch_to_register",
  uiSwitchToLogin: "auth.ui.switch_to_login",

  // Step-up verification preferences (auth-sa.md §11). The CHALLENGE existed
  // and the SETTING did not, so nobody could choose when to be asked.
  secGroupVerification: "auth.sec.group.verification",
  secVerifyTitle: "auth.sec.verify.title",
  secVerifySubtitle: "auth.sec.verify.subtitle",
  secVerifyScopeSettings: "auth.sec.verify.scope.settings",
  secVerifyScopeSettingsHint: "auth.sec.verify.scope.settings_hint",
  secVerifyScopeOther: "auth.sec.verify.scope.other",
  secVerifyToggleLabel: "auth.sec.verify.toggle_label",
  secVerifyOn: "auth.sec.verify.on",
  secVerifyOff: "auth.sec.verify.off",
  secVerifyDisableNote: "auth.sec.verify.disable_note",
  secVerifyEmpty: "auth.sec.verify.empty",
  secVerifyEmptyHint: "auth.sec.verify.empty_hint",
  // A scope with no preference row is UNDECIDED, not off — the client is
  // never told the endpoint's own level, so the row says so instead of
  // drawing a confident switch.
  secVerifyDefault: "auth.sec.verify.default",

  // Empty-state hints + in-body calls to action (visual pass C7: an empty
  // state whose only action sat 380px away in a card header).
  secPasswordNoMethodsHint: "auth.sec.password.no_methods_hint",
  secPasskeysEmptyHint: "auth.sec.passkeys.empty_hint",
  // Rename lands the moment `PATCH /passkey/{id}/` does — see
  // `PASSKEY_RENAME_SUPPORTED` in src/api/authApi.ts.
  secPasskeysRename: "auth.sec.passkeys.rename",
  secPasskeysRenameLabel: "auth.sec.passkeys.rename_label",
  secPasskeysRenameField: "auth.sec.passkeys.rename_field",
  secPasskeysRenameSave: "auth.sec.passkeys.rename_save",
  secPasskeysRemoveLabel: "auth.sec.passkeys.remove_label",
  // A 404 from rename/remove is "this row is stale", never "you may not" —
  // the backend scopes both routes by an ownership LOOKUP, so a stranger's id
  // and a deleted id are indistinguishable by design.
  secPasskeysGone: "auth.sec.passkeys.gone",
  secSessionsEmptyHint: "auth.sec.sessions.empty_hint",
  secOauthEmptyHint: "auth.sec.oauth.empty_hint",
  secAuditEmptyHint: "auth.sec.audit.empty_hint",
  secAuditSuspiciousLabel: "auth.sec.audit.suspicious_label",

  // ── Operator console (`@stapel/auth-react/default/admin`) ─────────────────
  // Five staff-only screens over the admin half of the contract: SSO
  // organizations + their identity-provider config, service keys, staff role
  // assignments, direct account creation, and the global audit log. They live
  // behind their own subpath so a consumer shipping only the end-user surface
  // never pulls them into a bundle.
  adminSsoTitle: "auth.admin.sso.title",
  adminSsoSubtitle: "auth.admin.sso.subtitle",
  adminSsoEmpty: "auth.admin.sso.empty",
  adminSsoEmptyHint: "auth.admin.sso.empty_hint",
  adminSsoAdd: "auth.admin.sso.add",
  adminSsoNameLabel: "auth.admin.sso.name_label",
  adminSsoSlugLabel: "auth.admin.sso.slug_label",
  adminSsoSlugHint: "auth.admin.sso.slug_hint",
  adminSsoDomainLabel: "auth.admin.sso.domain_label",
  adminSsoDomainHint: "auth.admin.sso.domain_hint",
  adminSsoEnforcedLabel: "auth.admin.sso.enforced_label",
  adminSsoEnforcedOn: "auth.admin.sso.enforced_on",
  adminSsoEnforcedOff: "auth.admin.sso.enforced_off",
  adminSsoCreatedOn: "auth.admin.sso.created_on",
  adminSsoSave: "auth.admin.sso.save",
  adminSsoCancel: "auth.admin.sso.cancel",
  adminSsoEdit: "auth.admin.sso.edit",
  adminSsoEditLabel: "auth.admin.sso.edit_label",
  adminSsoDelete: "auth.admin.sso.delete",
  adminSsoDeleteLabel: "auth.admin.sso.delete_label",
  adminSsoDeleteConfirmTitle: "auth.admin.sso.delete_confirm_title",
  adminSsoDeleteConfirmBody: "auth.admin.sso.delete_confirm_body",
  adminSsoConfigTitle: "auth.admin.sso.config_title",
  adminSsoConfigure: "auth.admin.sso.configure",
  adminSsoProtocolLabel: "auth.admin.sso.protocol_label",
  adminSsoProtocolSaml: "auth.admin.sso.protocol_saml",
  adminSsoProtocolOidc: "auth.admin.sso.protocol_oidc",
  adminSsoActiveLabel: "auth.admin.sso.active_label",
  adminSsoSamlEntityId: "auth.admin.sso.saml_entity_id",
  adminSsoSamlSsoUrl: "auth.admin.sso.saml_sso_url",
  adminSsoSamlSloUrl: "auth.admin.sso.saml_slo_url",
  adminSsoSamlCert: "auth.admin.sso.saml_cert",
  adminSsoSamlNameId: "auth.admin.sso.saml_name_id",
  adminSsoAttrEmail: "auth.admin.sso.attr_email",
  adminSsoAttrFirstName: "auth.admin.sso.attr_first_name",
  adminSsoAttrLastName: "auth.admin.sso.attr_last_name",
  adminSsoOidcClientId: "auth.admin.sso.oidc_client_id",
  adminSsoOidcClientSecret: "auth.admin.sso.oidc_client_secret",
  adminSsoOidcDiscovery: "auth.admin.sso.oidc_discovery",
  adminSsoOidcScopes: "auth.admin.sso.oidc_scopes",
  adminSsoConfigNew: "auth.admin.sso.config_new",
  adminKeysTitle: "auth.admin.keys.title",
  adminKeysSubtitle: "auth.admin.keys.subtitle",
  adminKeysEmpty: "auth.admin.keys.empty",
  adminKeysEmptyHint: "auth.admin.keys.empty_hint",
  adminKeysIssue: "auth.admin.keys.issue",
  adminKeysNameLabel: "auth.admin.keys.name_label",
  adminKeysDescriptionLabel: "auth.admin.keys.description_label",
  adminKeysEndpointsLabel: "auth.admin.keys.endpoints_label",
  adminKeysEndpointsHint: "auth.admin.keys.endpoints_hint",
  adminKeysEndpointsAll: "auth.admin.keys.endpoints_all",
  adminKeysEndpointsCount: "auth.admin.keys.endpoints_count",
  adminKeysCreatedOn: "auth.admin.keys.created_on",
  adminKeysLastUsed: "auth.admin.keys.last_used",
  adminKeysNeverUsed: "auth.admin.keys.never_used",
  adminKeysActive: "auth.admin.keys.active",
  adminKeysInactive: "auth.admin.keys.inactive",
  adminKeysDisable: "auth.admin.keys.disable",
  adminKeysEnable: "auth.admin.keys.enable",
  adminKeysDelete: "auth.admin.keys.delete",
  adminKeysDeleteLabel: "auth.admin.keys.delete_label",
  adminKeysDeleteConfirmTitle: "auth.admin.keys.delete_confirm_title",
  adminKeysDeleteConfirmBody: "auth.admin.keys.delete_confirm_body",
  adminKeysSecretTitle: "auth.admin.keys.secret_title",
  adminKeysSecretHint: "auth.admin.keys.secret_hint",
  adminKeysSecretCopy: "auth.admin.keys.secret_copy",
  adminKeysSecretCopied: "auth.admin.keys.secret_copied",
  adminKeysSecretDone: "auth.admin.keys.secret_done",
  adminKeysCancel: "auth.admin.keys.cancel",
  adminRolesTitle: "auth.admin.roles.title",
  adminRolesSubtitle: "auth.admin.roles.subtitle",
  adminRolesEmpty: "auth.admin.roles.empty",
  adminRolesEmptyHint: "auth.admin.roles.empty_hint",
  adminRolesAssign: "auth.admin.roles.assign",
  adminRolesUserLabel: "auth.admin.roles.user_label",
  adminRolesUserHint: "auth.admin.roles.user_hint",
  adminRolesRoleLabel: "auth.admin.roles.role_label",
  adminRolesRoleHint: "auth.admin.roles.role_hint",
  adminRolesFilterLabel: "auth.admin.roles.filter_label",
  adminRolesFilterClear: "auth.admin.roles.filter_clear",
  adminRolesAssignedBy: "auth.admin.roles.assigned_by",
  adminRolesAssignedBySystem: "auth.admin.roles.assigned_by_system",
  adminRolesAssignedOn: "auth.admin.roles.assigned_on",
  adminRolesUserRow: "auth.admin.roles.user_row",
  adminRolesRemove: "auth.admin.roles.remove",
  adminRolesRemoveLabel: "auth.admin.roles.remove_label",
  adminRolesRemoveConfirmTitle: "auth.admin.roles.remove_confirm_title",
  adminRolesRemoveConfirmBody: "auth.admin.roles.remove_confirm_body",
  adminRolesCancel: "auth.admin.roles.cancel",
  adminUsersTitle: "auth.admin.users.title",
  adminUsersSubtitle: "auth.admin.users.subtitle",
  adminUsersEmailLabel: "auth.admin.users.email_label",
  adminUsersPhoneLabel: "auth.admin.users.phone_label",
  adminUsersUsernameLabel: "auth.admin.users.username_label",
  adminUsersDisplayNameLabel: "auth.admin.users.display_name_label",
  adminUsersPasswordLabel: "auth.admin.users.password_label",
  adminUsersPasswordHint: "auth.admin.users.password_hint",
  adminUsersSendWelcome: "auth.admin.users.send_welcome",
  adminUsersSendWelcomeHint: "auth.admin.users.send_welcome_hint",
  adminUsersMarkVerified: "auth.admin.users.mark_verified",
  adminUsersMarkVerifiedHint: "auth.admin.users.mark_verified_hint",
  adminUsersSubmit: "auth.admin.users.submit",
  adminUsersNeedsContact: "auth.admin.users.needs_contact",
  adminUsersCreated: "auth.admin.users.created",
  adminUsersCreatedId: "auth.admin.users.created_id",
  adminUsersAnother: "auth.admin.users.another",
  adminAuditTitle: "auth.admin.audit.title",
  adminAuditSubtitle: "auth.admin.audit.subtitle",
  adminAuditEmpty: "auth.admin.audit.empty",
  adminAuditEmptyHint: "auth.admin.audit.empty_hint",
  adminAuditFilterEvent: "auth.admin.audit.filter_event",
  adminAuditFilterUser: "auth.admin.audit.filter_user",
  adminAuditFilterFrom: "auth.admin.audit.filter_from",
  adminAuditFilterTo: "auth.admin.audit.filter_to",
  adminAuditApply: "auth.admin.audit.apply",
  adminAuditClear: "auth.admin.audit.clear",
  adminAuditActor: "auth.admin.audit.actor",
  adminAuditCount: "auth.admin.audit.count",

  // Nav-manifest labels for the operator console (under `admin.root`).
  navAdminSso: "auth.nav.admin_sso",
  navAdminServiceKeys: "auth.nav.admin_service_keys",
  navAdminStaffRoles: "auth.nav.admin_staff_roles",
  navAdminUsers: "auth.nav.admin_users",
  navAdminAudit: "auth.nav.admin_audit",
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
  "auth.otp.mock_delivery":
    "Test mode: no code was actually sent. Use the code this environment is configured with.",
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
  "auth.passkey.unsupported":
    "This browser can't use passkeys. Try another browser or device, or pick a different method.",
  "auth.passkey.declined":
    "No passkey was used. Either the prompt was dismissed, or this device has no passkey for us yet — sign in another way, then add one in Security settings.",
  "auth.passkey.timeout":
    "The passkey prompt timed out before it was answered. Try again.",
  "auth.passkey.insecure":
    "Passkeys need a secure connection to this site. Open it over https and try again.",
  "auth.passkey.already_on_device":
    "This device already has a passkey for your account. Use it to sign in instead of adding another.",
  "auth.passkey.failed":
    "Your device could not complete the passkey check. Try again, or pick a different method.",
  "auth.error.unknown": "Something went wrong. Please try again.",

  // Default-skin UI (§54 AuthPanel)
  "auth.ui.login_title": "Sign in",
  "auth.ui.or": "or",
  "auth.ui.more_methods": "More ways to sign in",
  "auth.ui.continue_as_guest": "Continue as guest",
  "auth.ui.continue_as_guest_pending": "Continuing…",
  "auth.ui.continue_as_guest_hint": "You can sign in later — your data will be kept.",
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
  "auth.ui.sso_domain_placeholder": "acme.com",
  "auth.ui.sso_continue": "Continue with SSO",
  "auth.ui.channel_email": "Email",
  "auth.ui.channel_phone": "Phone",
  "auth.ui.channel_password": "Password",
  "auth.ui.channel_passkey": "Passkey",
  "auth.ui.channel_oauth": "Social",
  "auth.ui.channel_sso": "SSO",
  "auth.ui.channel_qr": "QR code",
  // Owner directive: "Magic link" reads as a gimmick — call it what it
  // is, a link sent to your email.
  "auth.ui.channel_magic_link": "Email link",
  "auth.ui.retry": "Try again",
  "auth.ui.close": "Close",
  "auth.ui.passkey_failed_title": "Couldn't sign in with a passkey",
  "auth.ui.passkey_pick_another": "Use another method",

  // Registration surface
  "auth.ui.register_title": "Create account",
  "auth.ui.register_confirm_label": "Confirm password",
  "auth.ui.register_mismatch": "Passwords don't match.",
  "auth.ui.register_submit": "Create account",

  // Per-method capability labels
  "auth.sec.method_cap.login": "For sign-in",
  "auth.sec.method_cap.register": "For registration",
  "auth.sec.method_cap.both": "Sign-in and registration",
  "auth.sec.method_cap.portable_anon":
    "Sign in to your guest account from another device",

  // Security-profile default-skin components (owner directive point 5)
  "auth.sec.sessions.title": "Active sessions",
  "auth.sec.sessions.subtitle":
    "Where you're currently signed in. Signing out revokes that device immediately.",
  "auth.sec.sessions.sign_out": "Sign out",
  "auth.sec.sessions.sign_out_all": "Sign out everyone else",
  "auth.sec.sessions.confirm_me": "This was me",
  "auth.sec.sessions.sign_out_confirm_title": "Sign out this device?",
  "auth.sec.sessions.sign_out_all_confirm_title": "Sign out all other devices?",
  "auth.sec.sessions.empty": "No active sessions.",
  "auth.sec.sessions.last_used": "Last used {when}",

  "auth.sec.totp.title": "Two-factor authentication",
  "auth.sec.totp.enabled": "Enabled",
  "auth.sec.totp.disabled": "Not set up",
  "auth.sec.totp.backup_remaining": "{n} backup codes left",
  "auth.sec.totp.set_up": "Set up",
  "auth.sec.totp.disable": "Disable",
  "auth.sec.totp.setup_title": "Set up two-factor authentication",
  "auth.sec.totp.scan_hint":
    "Scan this with your authenticator app, or enter the code manually.",
  "auth.sec.totp.secret_label": "Manual entry code",
  "auth.sec.totp.confirm_label": "Enter the 6-digit code",
  "auth.sec.totp.confirm_cta": "Confirm",
  "auth.sec.totp.backup_codes_title": "Save your backup codes",
  "auth.sec.totp.backup_codes_hint":
    "Each code works once, if you ever lose access to your authenticator. This is the only time they're shown.",
  "auth.sec.totp.backup_codes_ack": "I've saved these codes",
  "auth.sec.totp.disable_title": "Disable two-factor authentication",
  "auth.sec.totp.disable_code_label": "Authenticator code",
  "auth.sec.totp.disable_backup_label": "Backup code",
  "auth.sec.totp.use_backup_toggle": "Use a backup code instead",

  "auth.sec.totp.replace": "Replace",
  "auth.sec.totp.replace_title": "Replace authenticator app",
  "auth.sec.totp.replace_hint":
    "Confirm your current authenticator code or a backup code, then set up the new device.",
  "auth.sec.totp.replace_continue_cta": "Continue",
  "auth.sec.totp.lost_cta": "Lost your authenticator?",
  "auth.sec.totp.delayed_hint":
    "We'll remove two-factor authentication after a 14-day wait and notify your verified email or phone. You can cancel any time before then.",
  "auth.sec.totp.delayed_cta": "Request removal",
  "auth.sec.totp.pending_message":
    "Your authenticator app will be removed on {date} (in {days} days).",
  "auth.sec.totp.pending_note":
    "We've notified your verified email or phone about this request.",
  "auth.sec.totp.no_contact_title": "No recovery contact on file",
  "auth.sec.totp.no_contact_hint":
    "We can't schedule this without a verified email or phone on your account. Contact support for help.",

  "auth.sec.passkeys.title": "Passkeys",
  "auth.sec.passkeys.add": "Add a passkey",
  "auth.sec.passkeys.remove": "Remove",
  "auth.sec.passkeys.empty": "No passkeys yet.",
  "auth.sec.passkeys.awaiting_ceremony":
    "Follow your browser or device's prompt to finish adding this passkey.",
  "auth.sec.passkeys.remove_confirm_title": "Remove this passkey?",
  "auth.sec.passkeys.added_success": "Passkey added.",
  "auth.sec.passkeys.done": "Done",
  "auth.sec.passkeys.added_on": "Added {date}",
  "auth.sec.passkeys.last_used": "Last used {date}",
  "auth.sec.passkeys.never_used": "Not used yet",
  "auth.sec.passkeys.add_another": "Add another",
  "auth.sec.passkeys.kind_device": "Built into a device",
  "auth.sec.passkeys.kind_security_key": "Security key",
  "auth.sec.passkeys.kind_phone": "A phone or tablet nearby",
  "auth.sec.passkeys.kind_unknown": "Passkey",
  "auth.sec.passkeys.add_unsupported":
    "This browser can't create passkeys. Open this page in another browser to add one.",

  "auth.sec.password.title": "Change password",
  "auth.sec.password.old_label": "Current password",
  "auth.sec.password.new_label": "New password",
  "auth.sec.password.confirm_label": "Confirm new password",
  "auth.sec.password.mismatch": "Passwords don't match.",
  "auth.sec.password.change_cta": "Change password",
  "auth.sec.password.via_otp_hint": "We'll send a code to {target}",
  "auth.sec.password.success": "Password changed.",
  "auth.sec.password.no_methods":
    "This account has no way to change its password here.",

  "auth.sec.oauth.title": "Connected accounts",
  "auth.sec.oauth.linked": "Connected",
  "auth.sec.oauth.link": "Connect",
  "auth.sec.oauth.unlink": "Disconnect",
  "auth.sec.oauth.unlink_confirm_title": "Disconnect this account?",
  "auth.sec.oauth.empty": "No providers configured.",
  "auth.sec.oauth.unlink_unavailable":
    "Disconnecting isn't available right now.",
  "auth.sec.oauth.link_unavailable":
    "Connecting a new account isn't available right now.",

  "auth.sec.change.current_value": "Current {channel}: {value}",
  "auth.sec.change.cta": "Change {channel}",
  "auth.sec.change.instant_hint":
    "We'll send a code to your current {channel} to verify it's you, then a code to the new one.",
  "auth.sec.change.no_access_cta": "No access to your old {channel}?",
  "auth.sec.change.old_code_hint": "Enter the code sent to {target}",
  "auth.sec.change.new_value_label": "New {channel}",
  "auth.sec.change.request_new_cta": "Send code to new {channel}",
  "auth.sec.change.new_code_hint": "Enter the code sent to {target}",
  "auth.sec.change.confirm_cta": "Confirm",
  "auth.sec.change.success": "Your {channel} has been changed.",
  "auth.sec.change.retry": "Try again",
  "auth.sec.change.delayed_form_hint":
    "We'll notify your OLD {channel} and wait 14 days before applying the change — no code from the old {channel} required. Enter your new {channel} below.",
  "auth.sec.change.delayed_submit_cta": "Start 14-day change",
  "auth.sec.change.delayed_started": "Change requested. See the pending change below.",
  "auth.sec.change.pending_message": "Changing to {value} on {date} (in {days} days).",
  "auth.sec.change.pending_note": "Your old {channel} has been notified of this change.",
  "auth.sec.change.pending_cancel": "Cancel",
  "auth.sec.change.cancel_confirm_title": "Cancel this pending change?",

  "auth.sec.audit.title": "Security log",
  "auth.sec.audit.empty": "No recent activity.",
  "auth.sec.audit.ip": "IP {ip}",
  "auth.sec.audit.load_more": "Load more",

  "auth.sec.page.title": "Security",
  "auth.sec.page.subtitle":
    "Manage your sign-in methods, connected devices, and account activity.",
  "auth.sec.group.contact": "Contact details",
  "auth.sec.group.password": "Password",
  "auth.sec.group.two_factor": "Two-factor authentication",
  "auth.sec.group.devices": "Devices & sessions",
  "auth.sec.group.connected": "Connected accounts",
  "auth.sec.group.audit": "Security log",

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

  "auth.sec.qr.title": "Sign in on another device",
  "auth.sec.qr.subtitle":
    "Scan this code with the camera on a device that isn't signed in — it'll be signed in with this account.",
  "auth.sec.qr.show_cta": "Show QR code",
  "auth.sec.qr.cancel": "Cancel",
  "auth.sec.qr.expires_in": "Expires in {time}",
  "auth.sec.qr.expiring": "Expiring…",
  "auth.sec.qr.fulfilled": "That device is now signed in.",
  "auth.sec.qr.rejected": "Sign-in was declined on the other device.",
  "auth.sec.qr.retry": "Try again",
  "auth.sec.qr.regenerating": "That code expired — getting you a new one…",

  // QR login_request confirmation
  "auth.qr.confirm.title": "Sign in on the other device?",
  "auth.qr.confirm.subtitle":
    "You scanned a sign-in code. Approving signs that device in as you. If you didn't just scan it, decline.",
  "auth.qr.confirm.approve": "Yes, sign me in there",
  "auth.qr.confirm.decline": "No, that wasn't me",
  "auth.qr.confirm.approved":
    "That device is now signed in. You can put this one down.",
  "auth.qr.confirm.declined": "Sign-in declined. Nothing was shared.",
  "auth.qr.confirm.no_key":
    "This link has no sign-in code in it. Scan the QR code again.",
  "auth.qr.error.session_not_adopted":
    "The other device approved the sign-in, but this one couldn't take the session. Try the code again.",

  // First-login enforcement (org-program §C2)
  "auth.forcedChange.title": "Set your own password",
  "auth.forcedChange.hint":
    "Your organization issued a temporary password. Choose your own to continue — you'll use it from now on.",
  "auth.forcedChange.new_label": "New password",
  "auth.forcedChange.confirm_label": "Repeat new password",
  "auth.forcedChange.mismatch": "Passwords don't match",
  "auth.forcedChange.submit": "Set password and continue",
  "auth.forcedChange.success": "Password set — you're signed in.",

  "auth.mfaEnroll.title": "Set up two-factor authentication",
  "auth.mfaEnroll.hint":
    "Your organization requires a second factor. Add one now to finish signing in.",
  "auth.mfaEnroll.preparing": "Preparing enrollment…",
  "auth.mfaEnroll.method_totp": "Authenticator app",
  "auth.mfaEnroll.method_passkey": "Passkey",
  "auth.mfaEnroll.backup_codes_ack": "I saved my backup codes — finish",
  "auth.mfaEnroll.success": "Two-factor enabled — you're signed in.",
  "auth.mfaEnroll.restart_hint": "This step expired. Sign in again to retry.",
  "auth.mfaEnroll.error.no_tokens":
    "Enrollment finished but the session couldn't be completed. Sign in again.",

  // Nav-manifest labels
  "auth.nav.login": "Sign in",
  "auth.nav.security": "Security",
  "auth.nav.qr_confirm": "Confirm sign-in",

  // Sign-in surface — the door between the two variants.
  "auth.ui.switch_to_register": "New here? Create an account",
  "auth.ui.switch_to_login": "Already have an account? Sign in",

  // Step-up verification preferences
  "auth.sec.group.verification": "Extra verification",
  "auth.sec.verify.title": "When to ask for extra verification",
  "auth.sec.verify.subtitle":
    "Some actions can ask you to prove it's you a second time, even while you're signed in. Choose which ones.",
  "auth.sec.verify.scope.settings": "Changing security settings",
  "auth.sec.verify.scope.settings_hint":
    "Passwords, passkeys, two-factor and this page itself.",
  "auth.sec.verify.scope.other": "{scope}",
  "auth.sec.verify.toggle_label": "Extra verification for: {scope}",
  "auth.sec.verify.on": "Ask me",
  "auth.sec.verify.off": "Don't ask",
  "auth.sec.verify.disable_note":
    "Switching this off asks you to confirm it's you first.",
  "auth.sec.verify.empty": "Nothing to choose from here",
  "auth.sec.verify.empty_hint":
    "This app hasn't published any actions you can decide about. Everything follows its built-in defaults.",
  "auth.sec.verify.default": "Follows this app's default",

  // Empty states
  "auth.sec.password.no_methods_hint":
    "Add a verified email or phone number and this deployment can offer you a way to change it.",
  "auth.sec.passkeys.empty_hint":
    "A passkey signs you in with your face, fingerprint or device PIN — no password to remember or leak.",
  "auth.sec.passkeys.rename": "Rename",
  "auth.sec.passkeys.rename_label": "Rename {name}",
  "auth.sec.passkeys.rename_field": "What should this passkey be called?",
  "auth.sec.passkeys.rename_save": "Save the name",
  "auth.sec.passkeys.remove_label": "Remove {name}",
  "auth.sec.passkeys.gone":
    "That passkey is no longer on your account. The list has been refreshed.",
  "auth.sec.sessions.empty_hint":
    "Sessions appear here as you sign in on other browsers and devices.",
  "auth.sec.oauth.unlink_label": "Disconnect {name}",
  "auth.sec.oauth.empty_hint":
    "Connect an account to sign in with one tap next time.",
  "auth.sec.audit.empty_hint":
    "Sign-ins, password changes and device activity show up here.",
  "auth.sec.audit.suspicious_label": "Unrecognized activity",

  // ── Operator console ─────────────────────────────────────────────────────
  "auth.admin.sso.title": "Enterprise SSO",
  "auth.admin.sso.subtitle":
    "Organizations whose people sign in through their own identity provider.",
  "auth.admin.sso.empty": "No organizations yet",
  "auth.admin.sso.empty_hint":
    "Add one to route a company's email domain to its own identity provider.",
  "auth.admin.sso.add": "Add an organization",
  "auth.admin.sso.name_label": "Organization name",
  "auth.admin.sso.slug_label": "Short id",
  "auth.admin.sso.slug_hint": "Appears in the sign-in URL. Letters, digits and dashes.",
  "auth.admin.sso.domain_label": "Email domain",
  "auth.admin.sso.domain_hint": "Everyone with an address on this domain is routed here.",
  "auth.admin.sso.enforced_label": "Require SSO for this domain",
  "auth.admin.sso.enforced_on": "SSO required",
  "auth.admin.sso.enforced_off": "SSO optional",
  "auth.admin.sso.created_on": "Added {date}",
  "auth.admin.sso.save": "Save",
  "auth.admin.sso.cancel": "Cancel",
  "auth.admin.sso.edit": "Edit",
  "auth.admin.sso.edit_label": "Edit {name}",
  "auth.admin.sso.delete": "Remove",
  "auth.admin.sso.delete_label": "Remove {name}",
  "auth.admin.sso.delete_confirm_title": "Remove {name}?",
  "auth.admin.sso.delete_confirm_body":
    "Everyone on this domain loses their SSO route and has to sign in another way.",
  "auth.admin.sso.config_title": "Identity provider",
  "auth.admin.sso.configure": "Identity provider",
  "auth.admin.sso.protocol_label": "Protocol",
  "auth.admin.sso.protocol_saml": "SAML 2.0",
  "auth.admin.sso.protocol_oidc": "OpenID Connect",
  "auth.admin.sso.active_label": "Connection live",
  "auth.admin.sso.saml_entity_id": "Entity ID (issuer)",
  "auth.admin.sso.saml_sso_url": "Sign-in URL",
  "auth.admin.sso.saml_slo_url": "Sign-out URL",
  "auth.admin.sso.saml_cert": "Signing certificate",
  "auth.admin.sso.saml_name_id": "Name ID format",
  "auth.admin.sso.attr_email": "Email attribute",
  "auth.admin.sso.attr_first_name": "First-name attribute",
  "auth.admin.sso.attr_last_name": "Last-name attribute",
  "auth.admin.sso.oidc_client_id": "Client ID",
  "auth.admin.sso.oidc_client_secret": "Client secret",
  "auth.admin.sso.oidc_discovery": "Discovery URL",
  "auth.admin.sso.oidc_scopes": "Scopes",
  "auth.admin.sso.config_new":
    "Saving replaces this organization's whole identity-provider connection. The current values can't be shown — the API has no read for them.",
  "auth.admin.keys.title": "Service keys",
  "auth.admin.keys.subtitle":
    "Credentials for machines: scripts, integrations and other services calling this API.",
  "auth.admin.keys.empty": "No service keys yet",
  "auth.admin.keys.empty_hint":
    "Issue one so a script can call the API without a person's session.",
  "auth.admin.keys.issue": "Issue a key",
  "auth.admin.keys.name_label": "Name",
  "auth.admin.keys.description_label": "What is it for?",
  "auth.admin.keys.endpoints_label": "Allowed endpoints",
  "auth.admin.keys.endpoints_hint":
    "One path per line. Leave empty to allow every endpoint this key's permissions reach.",
  "auth.admin.keys.endpoints_all": "Every endpoint",
  "auth.admin.keys.endpoints_count": "{count} endpoints",
  "auth.admin.keys.created_on": "Issued {date}",
  "auth.admin.keys.last_used": "Last used {date}",
  "auth.admin.keys.never_used": "Never used",
  "auth.admin.keys.active": "Active",
  "auth.admin.keys.inactive": "Switched off",
  "auth.admin.keys.disable": "Switch off",
  "auth.admin.keys.enable": "Switch on",
  "auth.admin.keys.delete": "Delete",
  "auth.admin.keys.delete_label": "Delete {name}",
  "auth.admin.keys.delete_confirm_title": "Delete {name}?",
  "auth.admin.keys.delete_confirm_body":
    "Anything still using this key stops working immediately. Switch it off instead if you want to test that first.",
  "auth.admin.keys.secret_title": "Copy this key now",
  "auth.admin.keys.secret_hint":
    "This is the only time it is shown. Store it where the caller will read it from.",
  "auth.admin.keys.secret_copy": "Copy",
  "auth.admin.keys.secret_copied": "Copied",
  "auth.admin.keys.secret_done": "I've stored it",
  "auth.admin.keys.cancel": "Cancel",
  "auth.admin.roles.title": "Staff roles",
  "auth.admin.roles.subtitle": "Who has elevated access, and who gave it to them.",
  "auth.admin.roles.empty": "Nobody has a staff role",
  "auth.admin.roles.empty_hint":
    "Assign one to let a colleague reach the operator screens.",
  "auth.admin.roles.assign": "Assign a role",
  "auth.admin.roles.user_label": "User id",
  "auth.admin.roles.user_hint": "The account's UUID, copied from its profile.",
  "auth.admin.roles.role_label": "Role",
  "auth.admin.roles.role_hint": "The role name as this deployment spells it.",
  "auth.admin.roles.filter_label": "Show one account only",
  "auth.admin.roles.filter_clear": "Show everyone",
  "auth.admin.roles.assigned_by": "Assigned by {who}",
  "auth.admin.roles.assigned_by_system": "Assigned by the system",
  "auth.admin.roles.assigned_on": "on {date}",
  "auth.admin.roles.user_row": "Account {id}",
  "auth.admin.roles.remove": "Remove",
  "auth.admin.roles.remove_label": "Remove the {role} role from account {id}",
  "auth.admin.roles.remove_confirm_title": "Remove the {role} role?",
  "auth.admin.roles.remove_confirm_body":
    "This account loses the operator screens that role unlocks, on its next request.",
  "auth.admin.roles.cancel": "Cancel",
  "auth.admin.users.title": "Create an account",
  "auth.admin.users.subtitle":
    "Provision an account directly — no sign-up, no code to enter.",
  "auth.admin.users.email_label": "Email",
  "auth.admin.users.phone_label": "Phone",
  "auth.admin.users.username_label": "Username",
  "auth.admin.users.display_name_label": "Display name",
  "auth.admin.users.password_label": "Temporary password",
  "auth.admin.users.password_hint":
    "Leave empty to create the account without one — they'll sign in with a code.",
  "auth.admin.users.send_welcome": "Send a welcome message",
  "auth.admin.users.send_welcome_hint":
    "Emails or texts the person to say the account exists.",
  "auth.admin.users.mark_verified": "Treat the contact details as verified",
  "auth.admin.users.mark_verified_hint":
    "Switch off to make them confirm the address themselves first.",
  "auth.admin.users.submit": "Create the account",
  "auth.admin.users.needs_contact": "Give at least an email or a phone number.",
  "auth.admin.users.created": "Account created.",
  "auth.admin.users.created_id": "User id {id}",
  "auth.admin.users.another": "Create another",
  "auth.admin.audit.title": "Audit log",
  "auth.admin.audit.subtitle": "Every account's security activity, newest first.",
  "auth.admin.audit.empty": "Nothing matches",
  "auth.admin.audit.empty_hint": "Widen the dates, or clear the filters.",
  "auth.admin.audit.filter_event": "Event type",
  "auth.admin.audit.filter_user": "User id",
  "auth.admin.audit.filter_from": "From",
  "auth.admin.audit.filter_to": "To",
  "auth.admin.audit.apply": "Apply",
  "auth.admin.audit.clear": "Clear filters",
  "auth.admin.audit.actor": "Account {id}",
  "auth.admin.audit.count": "{count} events",
  "auth.nav.admin_sso": "Enterprise SSO",
  "auth.nav.admin_service_keys": "Service keys",
  "auth.nav.admin_staff_roles": "Staff roles",
  "auth.nav.admin_users": "Create account",
  "auth.nav.admin_audit": "Audit log",
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
