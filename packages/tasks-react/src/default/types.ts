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
 * Element-width geometry, in `rem`/`ch` rather than pixels.
 *
 * A kanban column is sized by what it has to hold — a title of a few words and
 * a date — not by a number somebody typed once at 1280px. These are the only
 * widths in the skin, they are named for what they measure, and they are
 * relative units so a host that scales its type scales the board with it.
 */
export const COLUMN_WIDTH = "18rem";
export const BOARD_MIN_HEIGHT = "20rem";
export const SHEET_WIDTH = 720;
export const CREATE_SHEET_WIDTH = 560;
