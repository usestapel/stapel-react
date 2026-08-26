import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { workspacesErrorBundleEn } from "./generated/errors.gen.js";

/**
 * workspaces-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. Add UI keys under the `workspaces.` namespace as you build flows.
 *
 * COUNTS ARE PLURAL FAMILIES. A key named `*.count` is rendered with core's
 * `useTPlural()`, which looks up `<key>.<CLDR category>` for the reader's
 * language and falls back to the flat key. Every family therefore ships three
 * spellings here — the flat fallback, `.one` and `.other` — and a language with
 * more categories (Russian's `few`/`many`) adds them in its own bundle. This is
 * what "1 workspace(s)" was standing in for.
 */
export const WORKSPACES_I18N_KEYS = {
  unknownError: "workspaces.error.unknown",
  // Retry affordance beside a stated failure — an error a person cannot act
  // on is only half the message.
  retry: "workspaces.retry",
  /**
   * The accessible name of a dialog's dismissal — the modal's close button and
   * the bottom sheet's grab handle (`SkinDialog`'s required `dismissLabel`).
   * Surface-neutral on purpose: the same dialog is a sheet on a phone and a
   * modal on a tablet, and the word for "get me out of here" is the same one.
   */
  dialogClose: "workspaces.dialog.close",
  cancel: "workspaces.cancel",
  // Anchor pagination (members / invitations / audit share one pager).
  pagerPrev: "workspaces.pager.prev",
  pagerNext: "workspaces.pager.next",
  pagerPosition: "workspaces.pager.position",
  // Workspace list (WorkspaceList headless + WorkspacesPage skin)
  listLoading: "workspaces.list.loading",
  listEmpty: "workspaces.list.empty",
  /**
   * "We could not load your workspaces" — the sentence whose ABSENCE was the
   * 2026-08-09 incident. Deliberately about US failing to load, never about
   * the person having none, and never a 404's "no longer available" (which
   * asserts the thing does not exist — tracker #211).
   */
  listLoadFailed: "workspaces.list.load_failed",
  listCreate: "workspaces.list.create",
  listCreating: "workspaces.list.creating",
  // Members (Members headless)
  membersLoading: "workspaces.members.loading",
  membersEmpty: "workspaces.members.empty",
  membersLoadFailed: "workspaces.members.load_failed",
  rolesLoadFailed: "workspaces.roles.load_failed",
  rolesEmpty: "workspaces.roles.empty",
  membersInvite: "workspaces.members.invite",
  membersInviting: "workspaces.members.inviting",
  membersUpdateRole: "workspaces.members.update_role",
  membersRemove: "workspaces.members.remove",
  // Accept invitation (AcceptInvitation headless)
  acceptAccept: "workspaces.accept.accept",
  acceptAccepting: "workspaces.accept.accepting",
  acceptAccepted: "workspaces.accept.accepted",
  // Workspace settings (default skin — WorkspaceSettings)
  settingsTitle: "workspaces.settings.title",
  settingsSubtitle: "workspaces.settings.subtitle",
  fieldName: "workspaces.settings.field.name",
  fieldSlug: "workspaces.settings.field.slug",
  fieldType: "workspaces.settings.field.type",
  typePersonal: "workspaces.settings.type.personal",
  typeWork: "workspaces.settings.type.work",
  save: "workspaces.settings.save",
  // Why a settings control is switched off (core's `useActionGate`).
  /** The caller's ROLE does not carry `workspace.update`. Not "you are not
   * the owner": a deployment role can hold the capability without being one,
   * and the server answers on the capability, so the screen says the same. */
  blockedCannotManage: "workspaces.settings.blocked.cannot_manage",
  blockedNameRequired: "workspaces.settings.blocked.name_required",
  blockedUnchanged: "workspaces.settings.blocked.unchanged",
  saving: "workspaces.settings.saving",
  dangerZoneTitle: "workspaces.settings.danger_zone.title",
  deleteWorkspace: "workspaces.settings.danger_zone.delete",
  deleteWorkspaceConfirm: "workspaces.settings.danger_zone.delete_confirm",
  deleteWorkspaceConfirmBody: "workspaces.settings.danger_zone.delete_confirm_body",
  /** The refusal a workspace carries no CODE for — the belt under
   * `delete_blocked_reason`, which is normally an `error.409.*` key the
   * generated bundle already translates. */
  deleteBlockedFallback: "workspaces.settings.danger_zone.blocked",
  // Security card (WorkspaceSettings — the require_mfa policy, org-program §C3)
  securityTitle: "workspaces.settings.security.title",
  securitySubtitle: "workspaces.settings.security.subtitle",
  securityRequireMfa: "workspaces.settings.security.require_mfa",
  securityRequireMfaHint: "workspaces.settings.security.require_mfa_hint",
  securityPoliciesLabel: "workspaces.settings.security.policies_label",
  securityPoliciesHint: "workspaces.settings.security.policies_hint",
  securityPolicyPasswordChange: "workspaces.settings.security.policy.password_change",
  securityPolicyMfaEnroll: "workspaces.settings.security.policy.mfa_enroll",
  securitySave: "workspaces.settings.security.save",
  securitySaving: "workspaces.settings.security.saving",
  securityBlockedCapability: "workspaces.settings.security.blocked.capability",
  securityStepUpNotice: "workspaces.settings.security.step_up_notice",
  // What the policy has actually ACHIEVED (MFAEnforcementStatus) — the
  // difference between "somebody asked for MFA" and "MFA holds".
  mfaStatusTitle: "workspaces.settings.security.mfa.status_title",
  mfaStateLabel: "workspaces.settings.security.mfa.state_label",
  mfaStatePending: "workspaces.settings.security.mfa.state.pending",
  mfaStateEnforcing: "workspaces.settings.security.mfa.state.enforcing",
  mfaStateEnforced: "workspaces.settings.security.mfa.state.enforced",
  mfaStateFailed: "workspaces.settings.security.mfa.state.failed",
  mfaStateOther: "workspaces.settings.security.mfa.state.other",
  mfaCheckedCount: "workspaces.settings.security.mfa.checked_count",
  mfaNoncompliantCount: "workspaces.settings.security.mfa.noncompliant_count",
  mfaUnverifiedCount: "workspaces.settings.security.mfa.unverified_count",
  mfaAttemptsCount: "workspaces.settings.security.mfa.attempts_count",
  mfaLastAttempt: "workspaces.settings.security.mfa.last_attempt",
  mfaCompletedAt: "workspaces.settings.security.mfa.completed_at",
  mfaLastError: "workspaces.settings.security.mfa.last_error",
  mfaUnverifiedHint: "workspaces.settings.security.mfa.unverified_hint",
  mfaOffNotice: "workspaces.settings.security.mfa.off",
  /** The policy IS on and the sweep has not reported yet — a different
   * fact from "not required here", and the one the screen used to get
   * wrong by deriving the sentence from the absence of a status. */
  mfaNoStatusYet: "workspaces.settings.security.mfa.no_status_yet",
  // Members manager (default skin — MembersManager)
  membersTitle: "workspaces.members.title",
  membersSubtitle: "workspaces.members.subtitle",
  membersCount: "workspaces.members.count",
  membersJoined: "workspaces.members.joined",
  membersLastSeen: "workspaces.members.last_seen",
  membersLastSeenNever: "workspaces.members.last_seen_never",
  membersSearchPlaceholder: "workspaces.members.search_placeholder",
  membersRolePickerLabel: "workspaces.members.role_picker_label",
  membersBlockedReadOnly: "workspaces.members.blocked.read_only",
  // The MFA evidence per member (`MemberResponse.mfa_compliant`): true /
  // false / null, and null is a state of its own — nobody has asked yet.
  membersMfaLabel: "workspaces.members.mfa_label",
  membersMfaCompliant: "workspaces.members.mfa.compliant",
  membersMfaNoncompliant: "workspaces.members.mfa.noncompliant",
  membersMfaUnknown: "workspaces.members.mfa.unknown",
  membersSuspended: "workspaces.members.suspended",
  membersSuspendedNoMfa: "workspaces.members.suspended.no_mfa",
  membersProvisioned: "workspaces.members.provisioned",
  membersInviteDialogTitle: "workspaces.members.invite_dialog.title",
  membersInviteEmailsLabel: "workspaces.members.invite_dialog.emails_label",
  membersInviteEmailsPlaceholder: "workspaces.members.invite_dialog.emails_placeholder",
  membersInviteRoleLabel: "workspaces.members.invite_dialog.role_label",
  membersInviteNameLabel: "workspaces.members.invite_dialog.name_label",
  membersInviteNamePlaceholder: "workspaces.members.invite_dialog.name_placeholder",
  membersInviteSubmit: "workspaces.members.invite_dialog.submit",
  // Why the invite dialog's submit is switched off (core's `useActionGate`).
  membersInviteBlockedNoEmails: "workspaces.members.invite_dialog.blocked.no_emails",
  membersInviteBlockedBadEmail: "workspaces.members.invite_dialog.blocked.bad_email",
  membersRemoveConfirm: "workspaces.members.remove_confirm",
  membersRemoveConfirmBody: "workspaces.members.remove_confirm_body",
  /** Why a row's "Remove" is switched off: the backend's last-owner
   * protection would refuse it, so the control never offers it. */
  membersRemoveBlockedLastOwner: "workspaces.members.remove.blocked.last_owner",
  /** Why a row's "Remove" is switched off on the READER's own row. Answered
   * by the server (`MemberResponse.is_self`), never by comparing a session id
   * this pair does not have. */
  membersRemoveBlockedSelf: "workspaces.members.remove.blocked.self",
  /**
   * Reset a member's password on the organization's order. The endpoint is
   * declared `high`, so the confirm says a step-up is coming BEFORE the
   * click, and the one-shot credential is labelled as one — it is shown
   * exactly once and can never be fetched again.
   */
  membersResetPassword: "workspaces.members.reset_password",
  /** Why "Reset password" is switched off on the READER's own row: the server
   * answers a self-target with the same 404 it gives for a stranger, so an
   * ungated button here reads its own refusal as "this member is gone". */
  membersResetBlockedSelf: "workspaces.members.reset_password.blocked.self",
  membersResetDialogTitle: "workspaces.members.reset_password_dialog.title",
  membersResetDialogBody: "workspaces.members.reset_password_dialog.body",
  membersResetStepUp: "workspaces.members.reset_password_dialog.step_up",
  membersResetSubmit: "workspaces.members.reset_password_dialog.submit",
  membersResetDone: "workspaces.members.reset_password_dialog.done",
  membersResetGenerated: "workspaces.members.reset_password_dialog.generated",
  membersResetGeneratedHint:
    "workspaces.members.reset_password_dialog.generated_hint",
  membersResetNotNotified:
    "workspaces.members.reset_password_dialog.not_notified",
  membersRename: "workspaces.members.rename",
  membersRenameDialogTitle: "workspaces.members.rename_dialog.title",
  membersRenameLabel: "workspaces.members.rename_dialog.label",
  membersRenamePlaceholder: "workspaces.members.rename_dialog.placeholder",
  membersRenameHint: "workspaces.members.rename_dialog.hint",
  membersRenameSubmit: "workspaces.members.rename_dialog.submit",
  membersRenameBlockedUnchanged: "workspaces.members.rename_dialog.blocked.unchanged",
  roleOwner: "workspaces.members.role.owner",
  roleAdmin: "workspaces.members.role.admin",
  roleMember: "workspaces.members.role.member",
  roleViewer: "workspaces.members.role.viewer",
  // Role registry labels (org-program §A2) — the `workspaces.role.<key>`
  // namespace RoleSelect resolves labels in: the pair ships the builtin four;
  // a client bundle merges its own (`workspaces.role.secretary`, …) and
  // RoleSelect falls back to the RAW role key when a label is missing.
  roleLabelOwner: "workspaces.role.owner",
  roleLabelAdmin: "workspaces.role.admin",
  roleLabelMember: "workspaces.role.member",
  roleLabelViewer: "workspaces.role.viewer",
  roleRankCaption: "workspaces.role.rank_caption",
  // Workspaces page (default skin — WorkspacesPage over the WorkspaceList bag)
  pageTitle: "workspaces.page.title",
  pageSubtitle: "workspaces.page.subtitle",
  listCount: "workspaces.list.count",
  listMemberCount: "workspaces.list.member_count",
  listOwnerLine: "workspaces.list.owner_line",
  listYourRole: "workspaces.list.your_role",
  listOpen: "workspaces.list.open",
  listPreferredTag: "workspaces.list.preferred",
  listSetPreferred: "workspaces.list.set_preferred",
  listClearPreferred: "workspaces.list.clear_preferred",
  listEmptyHint: "workspaces.list.empty_hint",
  listGuestNotice: "workspaces.list.guest_notice",
  listInstanceClosed: "workspaces.list.instance_closed",
  listCreateDialogTitle: "workspaces.list.create_dialog.title",
  listCreateNameLabel: "workspaces.list.create_dialog.name_label",
  listCreateNamePlaceholder: "workspaces.list.create_dialog.name_placeholder",
  listCreateSubmit: "workspaces.list.create_dialog.submit",
  listCreateBlockedNoName: "workspaces.list.create_dialog.blocked.no_name",
  listCreateBlockedPolicy: "workspaces.list.blocked.create_policy",
  // Invitation administration (default skin — InvitationsPane, #109)
  invitationsTitle: "workspaces.invitations.title",
  invitationsSubtitle: "workspaces.invitations.subtitle",
  invitationsCount: "workspaces.invitations.count",
  invitationsEmpty: "workspaces.invitations.empty",
  invitationsExpiresLabel: "workspaces.invitations.expires_label",
  invitationsSentLabel: "workspaces.invitations.sent_label",
  invitationsSentNever: "workspaces.invitations.sent_never",
  invitationsSearchPlaceholder: "workspaces.invitations.search_placeholder",
  invitationsFilterLabel: "workspaces.invitations.filter_label",
  invitationsFilterPending: "workspaces.invitations.filter.pending",
  invitationsFilterNeverAccepted: "workspaces.invitations.filter.never_accepted",
  invitationsFilterAll: "workspaces.invitations.filter.all",
  invitationsStatusPending: "workspaces.invitations.status.pending",
  invitationsStatusAccepted: "workspaces.invitations.status.accepted",
  invitationsStatusDeclined: "workspaces.invitations.status.declined",
  invitationsStatusRevoked: "workspaces.invitations.status.revoked",
  invitationsStatusExpired: "workspaces.invitations.status.expired",
  invitationsResend: "workspaces.invitations.resend",
  invitationsResendConfirm: "workspaces.invitations.resend_confirm",
  invitationsResendConfirmBody: "workspaces.invitations.resend_confirm_body",
  invitationsRevoke: "workspaces.invitations.revoke",
  invitationsRevokeConfirm: "workspaces.invitations.revoke_confirm",
  invitationsRevokeConfirmBody: "workspaces.invitations.revoke_confirm_body",
  invitationsRename: "workspaces.invitations.rename",
  invitationsRenameDialogTitle: "workspaces.invitations.rename_dialog.title",
  invitationsBlockedTerminal: "workspaces.invitations.blocked.terminal",
  invitationsBlockedResendTerminal: "workspaces.invitations.blocked.resend_terminal",
  /** One sentence for the whole ROW — see `rowReasonKey` in InvitationsPane. */
  invitationsBlockedRowClosed: "workspaces.invitations.blocked.row_closed",
  invitationsBlockedRowResendOnly: "workspaces.invitations.blocked.row_resend_only",
  // Membership history (default skin — AuditTrailPane, GET /{ws}/audit)
  auditTitle: "workspaces.audit.title",
  auditSubtitle: "workspaces.audit.subtitle",
  auditEmpty: "workspaces.audit.empty",
  auditFilterLabel: "workspaces.audit.filter_label",
  auditFilterAll: "workspaces.audit.filter.all",
  auditActorUnknown: "workspaces.audit.actor_unknown",
  auditBy: "workspaces.audit.by",
  auditRoleLine: "workspaces.audit.role_line",
  // The CLOSED action vocabulary (`models.AuditAction`). A deployment on a
  // newer backend can send one this bundle has no label for — the pane falls
  // back to the raw action key, exactly as RoleSelect does for roles.
  auditActionInvitationCreated: "workspaces.audit.action.invitation_created",
  auditActionInvitationAccepted: "workspaces.audit.action.invitation_accepted",
  auditActionInvitationRevoked: "workspaces.audit.action.invitation_revoked",
  auditActionInvitationDeclined: "workspaces.audit.action.invitation_declined",
  auditActionAccountCreatedByInvitation:
    "workspaces.audit.action.account_created_by_invitation",
  auditActionMemberJoined: "workspaces.audit.action.member_joined",
  auditActionMemberProvisioned: "workspaces.audit.action.member_provisioned",
  auditActionMemberRemoved: "workspaces.audit.action.member_removed",
  auditActionMemberRoleChanged: "workspaces.audit.action.member_role_changed",
  auditActionMemberSuspended: "workspaces.audit.action.member_suspended",
  auditActionMemberUnsuspended: "workspaces.audit.action.member_unsuspended",
  auditActionDeleted: "workspaces.audit.action.deleted",
  // Invite accept flow (org-program §B4 — InviteAcceptFlow headless +
  // InviteAcceptPage default skin), one key per flow screen.
  inviteLoading: "workspaces.invite.loading",
  inviteAcceptTitle: "workspaces.invite.acceptTitle",
  inviteRoleLine: "workspaces.invite.roleLine",
  inviteEmailLine: "workspaces.invite.emailLine",
  inviteJoinCta: "workspaces.invite.joinCta",
  inviteDeclineCta: "workspaces.invite.declineCta",
  inviteDeclineConfirm: "workspaces.invite.declineConfirm",
  inviteDeclineConfirmBody: "workspaces.invite.declineConfirmBody",
  inviteAccepted: "workspaces.invite.accepted",
  inviteDeclined: "workspaces.invite.declined",
  inviteUnavailableExpired: "workspaces.invite.unavailable.expired",
  inviteUnavailableRevoked: "workspaces.invite.unavailable.revoked",
  inviteUnavailableAccepted: "workspaces.invite.unavailable.accepted",
  inviteUnavailableDeclined: "workspaces.invite.unavailable.declined",
  inviteUnavailableNextStep: "workspaces.invite.unavailable.next_step",
  inviteExitCta: "workspaces.invite.exitCta",
  inviteWrongAccount: "workspaces.invite.wrongAccount",
  inviteWrongAccountHint: "workspaces.invite.wrongAccountHint",
  inviteSwitchAccountCta: "workspaces.invite.switchAccountCta",
  inviteLoginTitle: "workspaces.invite.loginTitle",
  inviteNewUserHint: "workspaces.invite.newUserHint",
  inviteCreateAccountCta: "workspaces.invite.createAccountCta",
  inviteClaiming: "workspaces.invite.claiming",
  inviteExchanging: "workspaces.invite.exchanging",
  inviteExchangeFailed: "workspaces.invite.exchangeFailed",
  inviteRetryCta: "workspaces.invite.retryCta",
  inviteBasicDataTitle: "workspaces.invite.basicDataTitle",
  inviteBasicDataContinueCta: "workspaces.invite.basicDataContinueCta",
  inviteBlockedBusy: "workspaces.invite.blocked.busy",
  /**
   * A workspace-scoped screen mounted from the nav manifest, with no active
   * workspace to be about. The active workspace is runtime state (the
   * selection the container writes), not a route param, so "there is none
   * yet" is a state every such screen can reach — and it is drawn, never
   * blank. Two different sentences, because they are two different
   * situations: nothing is SELECTED vs the person belongs to nothing.
   */
  activeChooseTitle: "workspaces.active.choose.title",
  activeChooseHint: "workspaces.active.choose.hint",
  activeNoneTitle: "workspaces.active.none.title",
  activeNoneHint: "workspaces.active.none.hint",
  // Nav manifest labels (the scripted-fullstack nav contract)
  navWorkspaces: "workspaces.nav.workspaces",
  navSettings: "workspaces.nav.settings",
  navMembers: "workspaces.nav.members",
  navInvitations: "workspaces.nav.invitations",
  navAudit: "workspaces.nav.audit",
  navInvite: "workspaces.nav.invite",
} as const;

export type WorkspacesI18nKey =
  (typeof WORKSPACES_I18N_KEYS)[keyof typeof WORKSPACES_I18N_KEYS];

/**
 * English fallback bundle for workspaces-react UI keys + backend error codes.
 * The generated `workspacesErrorBundleEn` (from stapel-workspaces's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 */
export const workspacesI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...workspacesErrorBundleEn,

  // workspaces-react UI
  "workspaces.error.unknown": "Something went wrong. Please try again.",
  "workspaces.retry": "Try again",
  "workspaces.dialog.close": "Close",
  "workspaces.cancel": "Cancel",
  "workspaces.pager.prev": "Previous",
  "workspaces.pager.next": "Next",
  "workspaces.pager.position": "Page {page}",
  "workspaces.list.loading": "Loading workspaces…",
  "workspaces.list.empty": "No workspaces yet.",
  "workspaces.list.load_failed":
    "We could not load your workspaces. This is a problem on our side, not a sign that you have none.",
  "workspaces.list.create": "Create workspace",
  "workspaces.list.creating": "Creating…",
  "workspaces.members.loading": "Loading members…",
  "workspaces.members.empty": "No members yet.",
  "workspaces.members.load_failed": "We could not load the member list.",
  "workspaces.roles.load_failed":
    "We could not load the role list, so roles cannot be changed right now. This does not mean the workspace has no roles.",
  "workspaces.roles.empty":
    "This installation defines no roles, so there is nothing to choose from.",
  "workspaces.members.invite": "Invite",
  "workspaces.members.inviting": "Inviting…",
  "workspaces.members.update_role": "Change role",
  "workspaces.members.remove": "Remove",
  "workspaces.accept.accept": "Accept invitation",
  "workspaces.accept.accepting": "Accepting…",
  "workspaces.accept.accepted": "You've joined the workspace.",
  "workspaces.settings.title": "Workspace",
  "workspaces.settings.subtitle": "Name and general settings.",
  "workspaces.settings.field.name": "Workspace name",
  "workspaces.settings.field.slug": "URL slug",
  "workspaces.settings.field.type": "Type",
  "workspaces.settings.type.personal": "Personal",
  "workspaces.settings.type.work": "Work",
  "workspaces.settings.save": "Save changes",
  "workspaces.settings.blocked.cannot_manage":
    "Your role cannot change this workspace's settings.",
  "workspaces.settings.blocked.name_required": "Enter a workspace name.",
  "workspaces.settings.blocked.unchanged": "Nothing has changed yet.",
  "workspaces.settings.saving": "Saving…",
  "workspaces.settings.danger_zone.title": "Danger zone",
  "workspaces.settings.danger_zone.delete": "Delete workspace",
  "workspaces.settings.danger_zone.delete_confirm": "Delete this workspace? This can't be undone.",
  "workspaces.settings.danger_zone.delete_confirm_body":
    "Everyone loses access immediately. Other services keep what they hold for this workspace under their own retention rules.",
  "workspaces.settings.danger_zone.blocked": "This workspace cannot be deleted.",
  "workspaces.settings.security.title": "Security",
  "workspaces.settings.security.subtitle":
    "Rules everyone in this workspace has to meet.",
  "workspaces.settings.security.require_mfa": "Require two-factor authentication",
  "workspaces.settings.security.require_mfa_hint":
    "Members without a confirmed second factor are not admitted until they add one.",
  "workspaces.settings.security.policies_label":
    "First-login steps for accounts this workspace creates",
  "workspaces.settings.security.policies_hint":
    "Independent demands, not alternatives — an organization may ask for both.",
  "workspaces.settings.security.policy.password_change": "Change the password",
  "workspaces.settings.security.policy.mfa_enroll": "Set up two-factor authentication",
  "workspaces.settings.security.save": "Save security settings",
  "workspaces.settings.security.saving": "Saving…",
  "workspaces.settings.security.blocked.capability":
    "Your role cannot change security settings.",
  "workspaces.settings.security.step_up_notice":
    "You will be asked to confirm your identity before this is saved.",
  "workspaces.settings.security.mfa.status_title": "Enforcement",
  "workspaces.settings.security.mfa.state_label": "State",
  "workspaces.settings.security.mfa.state.pending": "Waiting for the first check",
  "workspaces.settings.security.mfa.state.enforcing": "Checking members",
  "workspaces.settings.security.mfa.state.enforced": "In force",
  "workspaces.settings.security.mfa.state.failed": "The last check failed",
  "workspaces.settings.security.mfa.state.other": "Unrecognized state ({state})",
  "workspaces.settings.security.mfa.checked_count": "{count} members checked",
  "workspaces.settings.security.mfa.checked_count.one": "{count} member checked",
  "workspaces.settings.security.mfa.checked_count.other": "{count} members checked",
  "workspaces.settings.security.mfa.noncompliant_count":
    "{count} suspended for having no second factor",
  "workspaces.settings.security.mfa.noncompliant_count.one":
    "{count} member suspended for having no second factor",
  "workspaces.settings.security.mfa.noncompliant_count.other":
    "{count} members suspended for having no second factor",
  "workspaces.settings.security.mfa.unverified_count": "{count} still unverified",
  "workspaces.settings.security.mfa.unverified_count.one": "{count} member still unverified",
  "workspaces.settings.security.mfa.unverified_count.other": "{count} members still unverified",
  "workspaces.settings.security.mfa.attempts_count": "{count} checks so far",
  "workspaces.settings.security.mfa.attempts_count.one": "{count} check so far",
  "workspaces.settings.security.mfa.attempts_count.other": "{count} checks so far",
  "workspaces.settings.security.mfa.last_attempt": "Last check {date}",
  "workspaces.settings.security.mfa.completed_at": "Fully covered since {date}",
  "workspaces.settings.security.mfa.last_error": "Last error: {error}",
  "workspaces.settings.security.mfa.unverified_hint":
    "Unverified members are not admitted while the policy is on. Ask them to add a second factor — the number to get to zero is above.",
  "workspaces.settings.security.mfa.off":
    "Two-factor authentication is not required in this workspace.",
  "workspaces.settings.security.mfa.no_status_yet":
    "Two-factor authentication is required here. No check has run yet, so nobody has been confirmed.",
  "workspaces.members.title": "Members",
  "workspaces.members.subtitle": "Manage who has access to this workspace.",
  "workspaces.members.count": "{count} members",
  "workspaces.members.count.one": "{count} member",
  "workspaces.members.count.other": "{count} members",
  "workspaces.members.joined": "Joined {date}",
  "workspaces.members.last_seen": "Last seen {date}",
  "workspaces.members.last_seen_never": "Has not opened this workspace yet",
  "workspaces.members.search_placeholder": "Search by name or email",
  "workspaces.members.role_picker_label": "Role of {member}",
  "workspaces.members.blocked.read_only":
    "You can see who is here, but not change it.",
  "workspaces.members.mfa_label": "Two-factor",
  "workspaces.members.mfa.compliant": "Confirmed",
  "workspaces.members.mfa.noncompliant": "Missing",
  "workspaces.members.mfa.unknown": "Not checked yet",
  "workspaces.members.suspended": "Suspended",
  "workspaces.members.suspended.no_mfa":
    "Suspended until a second factor is confirmed.",
  "workspaces.members.provisioned": "Created by an admin",
  "workspaces.members.invite_dialog.title": "Invite members",
  "workspaces.members.invite_dialog.emails_label": "Emails",
  "workspaces.members.invite_dialog.emails_placeholder": "Type an email and press Enter",
  "workspaces.members.invite_dialog.role_label": "Role",
  "workspaces.members.invite_dialog.name_label": "Name (optional)",
  "workspaces.members.invite_dialog.name_placeholder": "Shown until they set their own",
  "workspaces.members.invite_dialog.submit": "Send invitations",
  "workspaces.members.invite_dialog.blocked.no_emails":
    "Enter at least one email address.",
  "workspaces.members.invite_dialog.blocked.bad_email":
    "{email} is not an email address.",
  "workspaces.members.remove_confirm": "Remove this member?",
  "workspaces.members.remove_confirm_body":
    "{member} loses access to this workspace right away. You can invite them again later.",
  "workspaces.members.remove.blocked.last_owner":
    "This is the workspace's only owner. Give someone else the owner role first.",
  "workspaces.members.remove.blocked.self":
    "This is you. Ask another owner or admin to remove you from the workspace.",
  "workspaces.members.reset_password": "Reset password",
  "workspaces.members.reset_password.blocked.self":
    "This is you. Change your own password in your account settings — this acts on somebody else's account.",
  "workspaces.members.reset_password_dialog.title": "Reset the password of {member}?",
  "workspaces.members.reset_password_dialog.body":
    "Their current password stops working straight away, and they are told you did it. The letter never carries the new password.",
  "workspaces.members.reset_password_dialog.step_up":
    "You will be asked to confirm it is you before this goes through.",
  "workspaces.members.reset_password_dialog.submit": "Reset password",
  "workspaces.members.reset_password_dialog.done": "{member} has a new password.",
  "workspaces.members.reset_password_dialog.generated": "One-time password",
  "workspaces.members.reset_password_dialog.generated_hint":
    "Shown once and never again. Hand it over through a channel you trust; they set their own the first time they sign in.",
  "workspaces.members.reset_password_dialog.not_notified":
    "There was no channel to tell them on, so tell them yourself.",
  "workspaces.members.rename": "Rename",
  "workspaces.members.rename_dialog.title": "Correct the name",
  "workspaces.members.rename_dialog.label": "Display name",
  "workspaces.members.rename_dialog.placeholder": "Leave empty to clear the name",
  "workspaces.members.rename_dialog.hint":
    "This is the person's name across the product, not a note kept in this workspace.",
  "workspaces.members.rename_dialog.submit": "Save name",
  "workspaces.members.rename_dialog.blocked.unchanged": "Change the name first.",
  "workspaces.members.role.owner": "Owner",
  "workspaces.members.role.admin": "Admin",
  "workspaces.members.role.member": "Member",
  "workspaces.members.role.viewer": "Viewer",

  // Role registry labels (builtin four; clients merge their own roles)
  "workspaces.role.owner": "Owner",
  "workspaces.role.admin": "Admin",
  "workspaces.role.member": "Member",
  "workspaces.role.viewer": "Viewer",
  "workspaces.role.rank_caption": "Rank {rank}",

  // Workspaces page
  "workspaces.page.title": "Workspaces",
  "workspaces.page.subtitle": "Every workspace you belong to.",
  "workspaces.list.count": "{count} workspaces",
  "workspaces.list.count.one": "{count} workspace",
  "workspaces.list.count.other": "{count} workspaces",
  "workspaces.list.member_count": "{count} members",
  "workspaces.list.member_count.one": "{count} member",
  "workspaces.list.member_count.other": "{count} members",
  "workspaces.list.owner_line": "Owned by {owner}",
  "workspaces.list.your_role": "Your role",
  "workspaces.list.open": "Open",
  "workspaces.list.preferred": "Home",
  "workspaces.list.set_preferred": "Make home",
  "workspaces.list.clear_preferred": "Clear home",
  "workspaces.list.empty_hint":
    "Create one to invite people and keep your work together.",
  "workspaces.list.guest_notice":
    "You are here as a guest. Guests can open what they were sent, but do not belong to a workspace.",
  "workspaces.list.instance_closed":
    "Ask whoever runs this installation for an invitation.",
  "workspaces.list.create_dialog.title": "New workspace",
  "workspaces.list.create_dialog.name_label": "Name",
  "workspaces.list.create_dialog.name_placeholder": "e.g. Acme Engineering",
  "workspaces.list.create_dialog.submit": "Create workspace",
  "workspaces.list.create_dialog.blocked.no_name": "Enter a name.",
  "workspaces.list.blocked.create_policy":
    "This installation only lets its owner create workspaces.",

  // Invitation administration
  "workspaces.invitations.title": "Invitations",
  "workspaces.invitations.subtitle": "Who has been invited and has not joined yet.",
  "workspaces.invitations.count": "{count} invitations",
  "workspaces.invitations.count.one": "{count} invitation",
  "workspaces.invitations.count.other": "{count} invitations",
  "workspaces.invitations.empty": "Nobody is waiting on an invitation.",
  "workspaces.invitations.expires_label": "Expires",
  "workspaces.invitations.sent_label": "Last sent",
  "workspaces.invitations.sent_never": "No letter sent yet",
  "workspaces.invitations.search_placeholder": "Search by email",
  "workspaces.invitations.filter_label": "Show",
  "workspaces.invitations.filter.pending": "Waiting",
  "workspaces.invitations.filter.never_accepted": "Never accepted",
  "workspaces.invitations.filter.all": "All",
  "workspaces.invitations.status.pending": "Waiting",
  "workspaces.invitations.status.accepted": "Accepted",
  "workspaces.invitations.status.declined": "Declined",
  "workspaces.invitations.status.revoked": "Revoked",
  "workspaces.invitations.status.expired": "Expired",
  "workspaces.invitations.resend": "Resend",
  "workspaces.invitations.resend_confirm": "Send the invitation again?",
  "workspaces.invitations.resend_confirm_body":
    "A fresh link goes out to {email} and the earlier one stops working.",
  "workspaces.invitations.revoke": "Revoke",
  "workspaces.invitations.revoke_confirm": "Withdraw this invitation?",
  "workspaces.invitations.revoke_confirm_body":
    "The link to {email} stops working. Nobody is told; you can invite them again later.",
  "workspaces.invitations.rename": "Rename",
  "workspaces.invitations.rename_dialog.title": "Correct the invitee's name",
  "workspaces.invitations.blocked.terminal":
    "This invitation was already accepted, declined, revoked or expired.",
  "workspaces.invitations.blocked.resend_terminal":
    "Only a waiting or expired invitation can be sent again.",
  "workspaces.invitations.blocked.row_closed":
    "This invitation is closed — there is nothing left to do with it.",
  "workspaces.invitations.blocked.row_resend_only":
    "This invitation has run out. Sending it again is the only thing left to do.",

  // Membership history
  "workspaces.audit.title": "Membership history",
  "workspaces.audit.subtitle":
    "Who let this person in, who took them out, and when.",
  "workspaces.audit.empty": "Nothing has happened here yet.",
  "workspaces.audit.filter_label": "Event",
  "workspaces.audit.filter.all": "All events",
  "workspaces.audit.actor_unknown": "The system",
  "workspaces.audit.by": "by {actor}",
  "workspaces.audit.role_line": "Role: {role}",
  "workspaces.audit.action.invitation_created": "Invitation sent",
  "workspaces.audit.action.invitation_accepted": "Invitation accepted",
  "workspaces.audit.action.invitation_revoked": "Invitation revoked",
  "workspaces.audit.action.invitation_declined": "Invitation declined",
  "workspaces.audit.action.account_created_by_invitation":
    "Account created from an invitation",
  "workspaces.audit.action.member_joined": "Joined the workspace",
  "workspaces.audit.action.member_provisioned": "Added by an admin",
  "workspaces.audit.action.member_removed": "Removed from the workspace",
  "workspaces.audit.action.member_role_changed": "Role changed",
  "workspaces.audit.action.member_suspended": "Access suspended",
  "workspaces.audit.action.member_unsuspended": "Access restored",
  "workspaces.audit.action.deleted": "Workspace deleted",

  // Invite accept flow (org-program §B4)
  "workspaces.invite.loading": "Loading invitation…",
  "workspaces.invite.acceptTitle": "Join {workspace}",
  "workspaces.invite.roleLine": "You've been invited as {role}.",
  "workspaces.invite.emailLine": "Invitation for {email}",
  "workspaces.invite.joinCta": "Join workspace",
  "workspaces.invite.declineCta": "Decline",
  "workspaces.invite.declineConfirm": "Decline this invitation?",
  "workspaces.invite.declineConfirmBody":
    "The workspace is told you said no and the link stops working. Ask for a new invitation if you change your mind.",
  "workspaces.invite.accepted": "You've joined {workspace}.",
  "workspaces.invite.declined": "Invitation declined.",
  "workspaces.invite.unavailable.expired": "This invitation has expired. Ask for a new one.",
  "workspaces.invite.unavailable.revoked": "This invitation was revoked.",
  "workspaces.invite.unavailable.accepted": "This invitation has already been used.",
  "workspaces.invite.unavailable.declined": "This invitation was declined.",
  "workspaces.invite.unavailable.next_step":
    "Ask an administrator of {workspace} to send you a new invitation.",
  "workspaces.invite.exitCta": "Go to your workspaces",
  "workspaces.invite.wrongAccount": "This invitation is for a different account",
  "workspaces.invite.wrongAccountHint":
    "You're signed in as {email}, but the invitation was sent to {invited}. Switch accounts to continue.",
  "workspaces.invite.switchAccountCta": "Switch account",
  "workspaces.invite.loginTitle": "Sign in to accept the invitation",
  "workspaces.invite.newUserHint":
    "We'll create a verified account for {email} — no password or email confirmation needed.",
  "workspaces.invite.createAccountCta": "Create account and continue",
  "workspaces.invite.claiming": "Creating your account…",
  "workspaces.invite.exchanging": "Signing you in…",
  "workspaces.invite.exchangeFailed": "Couldn't finish signing you in.",
  "workspaces.invite.retryCta": "Try again",
  "workspaces.invite.basicDataTitle": "Set up your profile",
  "workspaces.invite.basicDataContinueCta": "Continue",
  "workspaces.invite.blocked.busy": "Finishing the step already under way…",

  // A workspace-scoped screen with no active workspace
  "workspaces.active.choose.title": "Choose a workspace",
  "workspaces.active.choose.hint":
    "This screen manages one workspace at a time. Pick one on the Workspaces page and come back.",
  "workspaces.active.none.title": "You are not in a workspace yet",
  "workspaces.active.none.hint":
    "Create one, or ask an owner to invite you — then there will be something to manage here.",

  // Nav manifest labels
  "workspaces.nav.workspaces": "Workspaces",
  "workspaces.nav.settings": "Workspace",
  "workspaces.nav.members": "Members",
  "workspaces.nav.invitations": "Invitations",
  "workspaces.nav.audit": "History",
  "workspaces.nav.invite": "Invitation",
};

/**
 * Register workspaces-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`); a later
 * `loadLocale` from stapel-translate can layer localized overrides.
 *
 * MERGE-PRIORITY CONVENTION (pair checklist rule; i18n-shipping.md §3 — every
 * `@stapel/*-react` pair follows it): registration order IS override
 * priority, later wins per key. Within a locale, layers register bottom-up:
 *
 *   1. generated en floor  (`WorkspacesErrorBundleEn` — coverage by construction),
 *   2. the pair's polish / UI copy (this bundle spreads 1 then overrides),
 *   3. the pair's locale bundle from the `./i18n/<locale>` subpath
 *      (e.g. `registerWorkspacesI18nRu` — registers the en floor UNDER the
 *      locale texts so a missing key degrades to English, never a raw key),
 *   4. the HOST's own bundle — always registered LAST, so a host overrides any
 *      pair text without a fork.
 *
 * Dynamic overrides (stapel-translate `loadLocale`) layer on top at runtime.
 */
export function registerWorkspacesI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, workspacesI18nBundleEn);
}
