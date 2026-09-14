/**
 * `@stapel/alerts-react/default` — the pair's default AntD skin (§54: a pair
 * ships a FEATURE, not only a bag). A separate entry point, so a host that
 * brings its own visuals never pulls `antd` or the token bridge into its
 * bundle; importing this subpath is the opt-in.
 *
 * ```tsx
 * import { IssuesFeed } from "@stapel/alerts-react/default";
 * // under the pair's <AlertsProvider> + core's <I18nProvider>:
 * <IssuesFeed issueHref={(id) => `/admin/alerts/${id}`} />
 * ```
 *
 * The two screens are `IssuesFeed` and `IssueDetail` — the two the nav
 * manifest routes to. Everything under them is exported as well, because a
 * host that builds its own operations layout should be able to mount the
 * filter bar or the fix dialog beside its own chrome rather than
 * re-implementing either.
 */
export { IssuesFeed } from "./IssuesFeed.js";
export type { IssuesFeedProps } from "./IssuesFeed.js";
export { IssueDetail } from "./IssueDetail.js";
export type { IssueDetailProps } from "./IssueDetail.js";
export { IssueFilterBar, sinceFor } from "./IssueFilterBar.js";
export type { IssueFilterBarProps, SincePreset } from "./IssueFilterBar.js";
export { FixIssueDialog } from "./FixIssueDialog.js";
export type { FixIssueDialogProps } from "./FixIssueDialog.js";
export { MuteIssueDialog, mutedUntilFor } from "./MuteIssueDialog.js";
export type { MuteIssueDialogProps, MuteWindow } from "./MuteIssueDialog.js";
export {
  levelKey,
  levelFamily,
  kindKey,
  statusKey,
  statusFamily,
} from "./labels.js";
export { TRACE_BLOCK_STYLE, DIALOG_ACTION_BAR_STYLE } from "./layout.js";
export type { ThemeModeProp, IssueNavigationProps } from "./types.js";
