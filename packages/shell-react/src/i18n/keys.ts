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
