/**
 * The one prop every skin component in this package shares.
 *
 * `mode` is OPTIONAL and has no default here on purpose: the shared
 * `SkinTheme` (`@stapel/tokens-antd/skin`) follows the host's theme when
 * nobody overrides it, and a `mode = "light"` default in a pair is how a dark
 * host ends up with one white rectangle in the middle of its app.
 */
export interface ThemeModeProp {
  readonly mode?: "light" | "dark";
}
