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
 */
export const WORKSPACES_I18N_KEYS = {
  unknownError: "workspaces.error.unknown",
  // Workspace list (WorkspaceList headless)
  listLoading: "workspaces.list.loading",
  listEmpty: "workspaces.list.empty",
  listCreate: "workspaces.list.create",
  listCreating: "workspaces.list.creating",
  // Members (Members headless)
  membersLoading: "workspaces.members.loading",
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
  save: "workspaces.settings.save",
  saving: "workspaces.settings.saving",
  dangerZoneTitle: "workspaces.settings.danger_zone.title",
  deleteWorkspace: "workspaces.settings.danger_zone.delete",
  deleteWorkspaceConfirm: "workspaces.settings.danger_zone.delete_confirm",
  // Members manager (default skin — MembersManager)
  membersTitle: "workspaces.members.title",
  membersSubtitle: "workspaces.members.subtitle",
  membersInviteDialogTitle: "workspaces.members.invite_dialog.title",
  membersInviteEmailsLabel: "workspaces.members.invite_dialog.emails_label",
  membersInviteEmailsPlaceholder: "workspaces.members.invite_dialog.emails_placeholder",
  membersInviteRoleLabel: "workspaces.members.invite_dialog.role_label",
  membersRemoveConfirm: "workspaces.members.remove_confirm",
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
  // Invite accept flow (org-program §B4 — InviteAcceptFlow headless +
  // InviteAcceptPage default skin), one key per flow screen.
  inviteLoading: "workspaces.invite.loading",
  inviteAcceptTitle: "workspaces.invite.acceptTitle",
  inviteRoleLine: "workspaces.invite.roleLine",
  inviteEmailLine: "workspaces.invite.emailLine",
  inviteJoinCta: "workspaces.invite.joinCta",
  inviteDeclineCta: "workspaces.invite.declineCta",
  inviteAccepted: "workspaces.invite.accepted",
  inviteDeclined: "workspaces.invite.declined",
  inviteUnavailableExpired: "workspaces.invite.unavailable.expired",
  inviteUnavailableRevoked: "workspaces.invite.unavailable.revoked",
  inviteUnavailableAccepted: "workspaces.invite.unavailable.accepted",
  inviteUnavailableDeclined: "workspaces.invite.unavailable.declined",
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
  "workspaces.list.loading": "Loading workspaces…",
  "workspaces.list.empty": "No workspaces yet.",
  "workspaces.list.create": "Create workspace",
  "workspaces.list.creating": "Creating…",
  "workspaces.members.loading": "Loading members…",
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
  "workspaces.settings.save": "Save changes",
  "workspaces.settings.saving": "Saving…",
  "workspaces.settings.danger_zone.title": "Danger zone",
  "workspaces.settings.danger_zone.delete": "Delete workspace",
  "workspaces.settings.danger_zone.delete_confirm": "Delete this workspace? This can't be undone.",
  "workspaces.members.title": "Members",
  "workspaces.members.subtitle": "Manage who has access to this workspace.",
  "workspaces.members.invite_dialog.title": "Invite members",
  "workspaces.members.invite_dialog.emails_label": "Emails",
  "workspaces.members.invite_dialog.emails_placeholder": "Type an email and press Enter",
  "workspaces.members.invite_dialog.role_label": "Role",
  "workspaces.members.remove_confirm": "Remove this member?",
  "workspaces.members.role.owner": "Owner",
  "workspaces.members.role.admin": "Admin",
  "workspaces.members.role.member": "Member",
  "workspaces.members.role.viewer": "Viewer",

  // Role registry labels (builtin four; clients merge their own roles)
  "workspaces.role.owner": "Owner",
  "workspaces.role.admin": "Admin",
  "workspaces.role.member": "Member",
  "workspaces.role.viewer": "Viewer",

  // Invite accept flow (org-program §B4)
  "workspaces.invite.loading": "Loading invitation…",
  "workspaces.invite.acceptTitle": "Join {workspace}",
  "workspaces.invite.roleLine": "You've been invited as {role}.",
  "workspaces.invite.emailLine": "Invitation for {email}",
  "workspaces.invite.joinCta": "Join workspace",
  "workspaces.invite.declineCta": "Decline",
  "workspaces.invite.accepted": "You've joined {workspace}.",
  "workspaces.invite.declined": "Invitation declined.",
  "workspaces.invite.unavailable.expired": "This invitation has expired. Ask for a new one.",
  "workspaces.invite.unavailable.revoked": "This invitation was revoked.",
  "workspaces.invite.unavailable.accepted": "This invitation has already been used.",
  "workspaces.invite.unavailable.declined": "This invitation was declined.",
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
