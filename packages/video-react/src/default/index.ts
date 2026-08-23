/**
 * `@stapel/video-react/default` — the antd skin over the headless pair.
 *
 * A separate entry point (the convention every pair's `/default` follows) so a
 * host rendering its own usage screen never pulls `antd` into its bundle. The
 * main entry has no visual opinion at all and no import path from it reaches
 * this directory — size-limit and the bundle-purity test are the teeth on
 * that.
 *
 * ```tsx
 * import { createVideoRuntime, VideoProvider } from "@stapel/video-react";
 * import { ScopeUsagePane } from "@stapel/video-react/default";
 * ```
 *
 * `<ScopeUsagePane>` is the wired screen (the nav manifest's `admin.usage`
 * points at it); `<ScopeUsageTable>` is the same table with the data handed
 * in, for a host that owns its own month state.
 */
export { ScopeUsagePane } from "./ScopeUsagePane.js";
export type { ScopeUsagePaneProps } from "./ScopeUsagePane.js";
export { ScopeUsageTable } from "./ScopeUsageTable.js";
export type { ScopeUsageTableProps } from "./ScopeUsageTable.js";
export { VideoSkinTheme } from "./theme.js";
export type { VideoSkinThemeProps } from "./theme.js";
export { ErrorAlert } from "./ErrorAlert.js";
export type { ThemeModeProp } from "./types.js";
