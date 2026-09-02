/**
 * The geometry this skin owns, named once.
 *
 * Every value here is a genuine one-off — a measure, a thumbnail box, a grid
 * minimum — none of which is on the spacing/type/radius scale, which is
 * exactly why they are constants and not literals in five style objects
 * (`stapel/no-raw-dimensions` reports a number picked by eye; a named measure
 * is a decision taken once, in a place a host can change).
 */

/**
 * How wide the drive is allowed to get.
 *
 * The product is phone-first and single-column BY DESIGN (spec §4): there is
 * no second desktop layout to build, because a file list that grows to 1900px
 * puts the name at one end of the row and the actions at the other with a
 * thousand pixels of nothing between them. So the desktop degradation is this
 * one number — the column stays a column, centred, at a comfortable measure —
 * and the two-pane experience remains `@stapel/docs-react`'s `FileManager`,
 * which was built for it.
 */
export const DRIVE_MEASURE = 720;

/** The leading square of a list row: a thumbnail, or the mime glyph. */
export const ROW_THUMBNAIL = 40;

/** The thumbnail box of a grid tile. */
export const TILE_THUMBNAIL = 96;

/** Narrowest a grid tile may get before the grid drops a column. */
export const TILE_MIN_WIDTH = 148;

/** Height of one upload row's progress bar area, so the tray does not jump
 * between "queued" (no bar) and "uploading" (bar). */
export const UPLOAD_ROW_BAR_HEIGHT = 20;

/**
 * The two bar widths the breadcrumb skeleton draws while the trail is
 * unknown — a root crumb and one child, roughly the length real folder names
 * run to. One-off geometry (a skeleton's shape is not on the spacing scale).
 */
export const CRUMB_SKELETON_WIDTHS: readonly [number, number] = [96, 72];

/**
 * Tallest the lightbox's media area grows before it scrolls (an image) or
 * letterboxes (a video). A viewport-relative measure, not a pixel count:
 * the panel is a bottom sheet on a phone and a modal on desktop, and the
 * media should fill what the dialog was given without pushing the controls
 * off screen.
 */
export const LIGHTBOX_MEDIA_HEIGHT = "70dvh";

/** Horizontal travel that counts as a swipe between siblings — under it a
 * touch is a tap (the zoom toggle). */
export const LIGHTBOX_SWIPE_THRESHOLD = 48;

/** Tallest an inline archive-member preview grows inside the sheet. */
export const ARCHIVE_PREVIEW_HEIGHT = "40dvh";
