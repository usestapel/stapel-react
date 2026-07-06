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
};

/**
 * Register workspaces-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerWorkspacesI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, workspacesI18nBundleEn);
}
