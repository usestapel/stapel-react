/**
 * How wide a list of things a person READS is allowed to get.
 *
 * The visual pass' M-5 inverted between audits: the old failure was a
 * phone-shaped card marooned in a desktop corner, and the fix over-corrected
 * into full-bleed rows with no measure at all — a document list on a 1900px
 * window put the file's name at x=460 and its actions at x=1890, with roughly
 * 1400px of dead gap in every row. A line of text has a comfortable measure
 * whatever the window does, so the panes cap at one and stay left-aligned
 * inside their container; the container still fills whatever box it is in.
 *
 * A named constant rather than a literal in three style objects: a host that
 * wants wider rows changes it in one place, and the number is a genuine
 * one-off (a measure is not on the spacing scale).
 */
export const READING_MEASURE = 880;

/**
 * The two bar widths the breadcrumb skeleton draws while the folder read is
 * in flight — a root crumb and one child, roughly the length real folder
 * names run to. One-off geometry (a skeleton's shape is not on the spacing
 * scale), so it is named here rather than guessed at the call site.
 */
export const CRUMB_SKELETON_WIDTHS: readonly [number, number] = [96, 72];

/**
 * How wide a per-row blocked REASON is allowed to grow before it wraps.
 *
 * `GatedControl`'s stacked wrapper is `flex-direction: column` with
 * `flex-wrap: wrap`, and a column that wraps inside a height-constrained row
 * (an antd `List.Item` action slot) spills into a SECOND column — which is how
 * "This is the document's current version." ended up beside its own button,
 * squeezing the revision's title into three wrapped lines. The wrapper is
 * pinned to one column and the sentence is given a measure of its own.
 */
export const ROW_REASON_MEASURE = 200;
