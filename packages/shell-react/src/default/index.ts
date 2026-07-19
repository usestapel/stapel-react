/**
 * `@stapel/shell-react/default` — the antd-skinned `<AppShell/>`. A separate
 * entry point (same convention as `auth-react`/`profiles-react`'s
 * `/default`) so a consumer who renders their own chrome around
 * `resolveNav`'s output never pulls `antd`/`react-router` into their bundle.
 *
 * ```tsx
 * import { resolveNav } from "@stapel/shell-react";
 * import { AppShell } from "@stapel/shell-react/default";
 * const nav = resolveNav(installedManifests, overridesFile);
 * <Route element={<AppShell nav={nav} mode="light" />}>...child routes...</Route>
 * ```
 */
export { AppShell } from "./AppShell.js";
export type { AppShellProps } from "./AppShell.js";
