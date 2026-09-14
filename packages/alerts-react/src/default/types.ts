/**
 * The props every skin component in this package shares.
 *
 * `mode` is OPTIONAL and has no default here on purpose: the shared
 * `SkinTheme` (`@stapel/tokens-antd/skin`) follows the host's theme when
 * nobody overrides it, and a `mode = "light"` default in a pair is how a dark
 * host ends up with one white rectangle in the middle of its app.
 */
export interface ThemeModeProp {
  readonly mode?: "light" | "dark";
}

/**
 * How a screen in this pair reaches one issue.
 *
 * This package owns no router. A host that has one passes `issueHref` and the
 * rows become real links — middle-clickable, copyable, and the thing somebody
 * pastes into a chat beside `alerts:<id>`. A host without one passes
 * `onOpenIssue` and gets a button. Neither given, the row still renders and
 * simply offers no way in, which is honest: a dead control would be worse.
 */
export interface IssueNavigationProps {
  /** `(issueId) => href` for the host's route to the issue screen. */
  readonly issueHref?: (issueId: string) => string;
  /** Called with the issue id when a row is activated. */
  readonly onOpenIssue?: (issueId: string) => void;
}
