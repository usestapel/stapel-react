/**
 * `@stapel/shell-react` — the scripted-fullstack navigation shell (Ф1
 * lib-side core). The root export is `resolveNav`: pure, no React, no antd,
 * no react-router — safe to run at scaffold codegen time (Node, no DOM) as
 * well as at runtime inside the shipped app. The rendered chrome
 * (`<AppShell/>`, antd + react-router) lives behind the `/default` subpath
 * so a host that renders its own chrome around `resolveNav`'s output never
 * pulls those in.
 */
export { resolveNav } from "./headless/resolveNav.js";
export type {
  ResolvedNavEntry,
  NavOverrideEntry,
  NavOverridesFile,
} from "./headless/resolveNav.js";

// The shell's OWN chrome i18n (menu-item copy comes from each installed
// pair's own labelKey/registerXI18n — see src/i18n/keys.ts's module doc).
export { SHELL_I18N_KEYS, registerShellI18n } from "./i18n/keys.js";
export type { ShellI18nKey } from "./i18n/keys.js";
