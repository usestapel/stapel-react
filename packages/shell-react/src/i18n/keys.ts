import type { I18nDictionary, I18nEngine } from "@stapel/core";

/**
 * `@stapel/shell-react`'s own translation KEYS (frontend-standard §4.2):
 * `<AppShell/>` never renders literal strings — a host resolves these via
 * core's i18n engine (`useT`). Menu-item copy itself is NOT owned here — it
 * comes from each installed pair's OWN `labelKey` (`auth.nav.login`,
 * `profiles.nav.settings`, …), already registered by that pair's own
 * `registerXI18n`. This module only owns the shell's OWN chrome strings
 * (today: the phone/tablet hamburger trigger's accessible name).
 */
export const SHELL_I18N_KEYS = {
  navOpenMenu: "shell.nav.open_menu",
  /** The nav sheet's own close control. A drawer that can only be dismissed
   * by pressing the scrim behind it has no visible way out on a phone, where
   * the scrim is a sliver — so the sheet carries a labelled close button and
   * this is its accessible name. */
  navCloseMenu: "shell.nav.close_menu",
  /** Label of the synthetic admin section (`resolveNav`'s
   * {@link ADMIN_ROOT_ENTRY}). Owned here, not by a module, because no module
   * owns "the admin section" — and it is the same key the generated container
   * declares for its own admin root, so a scaffolded host and a hand-wired
   * one read one string. */
  navAdmin: "shell.nav.admin",
  /** The reason beside the admin section for a person without the staff
   * capability. It is a REASON, not a hidden entry: the section stays listed
   * so that asking for access is possible at all. */
  navAdminStaffOnly: "shell.nav.admin_staff_only",
  /** `<PublicShell/>`'s default `accountSlot`. The public chrome renders a
   * sign-in CTA when the host supplies no account slot at all, so this key is
   * reachable on any storefront — a hidden entry point teaches nothing
   * (private-space canon §6.3). */
  publicSignIn: "shell.public.sign_in",
  // `<ThemeModeControl/>` takes its copy as a PROP rather than calling
  // `useT()`, because core's `useT` throws outside an `<I18nProvider>` and
  // the control has to render in hosts that translate elsewhere. These keys
  // are here for the hosts that do use the engine.
  themeGroup: "shell.theme.group",
  themeLight: "shell.theme.light",
  themeDark: "shell.theme.dark",
  themeSystem: "shell.theme.system",
} as const;

export type ShellI18nKey = (typeof SHELL_I18N_KEYS)[keyof typeof SHELL_I18N_KEYS];

export const shellI18nBundleEn: I18nDictionary = {
  "shell.nav.open_menu": "Open menu",
  "shell.nav.close_menu": "Close menu",
  "shell.nav.admin": "Admin",
  "shell.nav.admin_staff_only": "For the people who operate this product",
  "shell.public.sign_in": "Sign in",
  "shell.theme.group": "Appearance",
  "shell.theme.light": "Light",
  "shell.theme.dark": "Dark",
  "shell.theme.system": "Match system",
};

/** Register the pair's `en` floor into a core i18n engine (call once at
 * startup, before any locale override — same convention every
 * `@stapel/<module>-react` pair follows). */
export function registerShellI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, shellI18nBundleEn);
}
