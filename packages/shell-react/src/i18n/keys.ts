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
  /** The bottom dock's accessible name (`<NavDock/>`). A dock is a `<nav>`
   * landmark and a page may hold more than one, so it has to be named — a
   * screen reader's landmark list otherwise offers two identical
   * "navigation"s and no way to tell the drawer from the dock. */
  dockLabel: "shell.dock.label",
  /** Folded into a nav destination's accessible name when its badge carries a
   * count: "Chat, 3 unread". The number is on the badge for the eye; this is
   * the same fact for a screen reader, said in words rather than left as a
   * digit glued to the label. Deliberately NOT a plural family — the counted
   * noun is the destination's own name, which the shell does not own and
   * cannot decline.
   *
   * Named for the dock because that is where it started; it is now read by
   * every surface that renders a nav badge (the dock, the `Sider`, the nav
   * sheet, the storefront's top-bar menu). One count, one sentence — a second
   * key per surface would be four translations of one fact. */
  dockUnread: "shell.dock.unread",
  /** `<PublicShell/>`'s default `accountSlot`. The public chrome renders a
   * sign-in CTA when the host supplies no account slot at all, so this key is
   * reachable on any storefront — a hidden entry point teaches nothing
   * (private-space canon §6.3). */
  publicSignIn: "shell.public.sign_in",
  /** The phone header's home affordance — the brand mark, or the house glyph
   * where a brand has no logo. Its accessible name, because the control is a
   * picture: without it a screen reader reads a link with no text. The dock
   * has no home tab on a deployment that does not declare one, and history's
   * back arrow is not a route home, so this control is the guarantee that `/`
   * is one tap from every screen. */
  publicHome: "shell.public.home",
  /** `<SiteLegalFooter/>`'s three labels. The SENTENCES are the deployment's
   * (a company line, an address, a support mailbox — all of them come off the
   * wire in `brand.legal`); what the shell owns is the WORD on each link, and
   * a storefront whose privacy link reads "privacy_url" is a storefront with
   * a broken footer. Deliberately not per-brand: two brands on one build read
   * the same three nouns in the same locale. */
  legalPrivacy: "shell.legal.privacy",
  legalTerms: "shell.legal.terms",
  legalSupport: "shell.legal.support",
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
  "shell.dock.label": "Main sections",
  "shell.dock.unread": "{count} unread",
  "shell.public.sign_in": "Sign in",
  "shell.public.home": "Home",
  "shell.legal.privacy": "Privacy",
  "shell.legal.terms": "Terms",
  "shell.legal.support": "Support",
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
