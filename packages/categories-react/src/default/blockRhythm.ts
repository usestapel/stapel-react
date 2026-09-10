/**
 * ONE GAP BETWEEN BLOCKS, SAID ONCE — this pair's half of the storefront's
 * rhythm.
 *
 * A catalogue page is an assembly of BLOCKS: the breadcrumb, the heading, the
 * subcategory stage, the listings slot. Every gap between two of them used to
 * be `spacing[4]` written on whichever `<Flex>` happened to wrap them, plus
 * whatever outer margin the block itself carried. Sixteen pixels is what a
 * form's fields are spaced by, not what a page's sections are — the walked
 * storefront read as one undifferentiated column, and the owner's word for it
 * was that the blocks are stuck together.
 *
 * The gap is now ONE PAIR of custom properties, declared as a USAGE and not as
 * a definition — `var(--stapel-block-gap, 32px)`. That is the point of the
 * shape: a host, a container or a brand sets the property anywhere above the
 * page and every block on it moves together, while a host that sets nothing
 * gets the design system's own spacing step.
 *
 * The compact value is for a COARSE POINTER or a narrow window, in one query
 * with two arms: a phone has less height to spend on air, and a tablet held in
 * a hand is a phone for this purpose whatever its width reports.
 *
 * ── Why the same two names live in two packages ────────────────────────────
 *
 * `@stapel/search-react` declares exactly these two properties for the search
 * page. The NAMES are the contract, not the code: a storefront that assembles
 * a category page out of both pairs sets `--stapel-block-gap` once and both
 * halves of the screen answer to it. Sharing an implementation instead would
 * mean one of these pairs depending on the other for a rule set of three
 * lines, which is a far heavier seam than two identical declarations.
 */
import { breakpoints, spacing } from "@stapel/tokens-antd";

/** The custom property every block gap on a catalogue page reads. */
export const BLOCK_GAP_VAR = "--stapel-block-gap";

/** Its coarse-pointer / narrow-window twin. */
export const BLOCK_GAP_COMPACT_VAR = "--stapel-block-gap-compact";

/** The class the rhythm's rules are hung on. */
export const BLOCK_RHYTHM_CLASS = "stapel-block-rhythm";

/** The `href` the hoisted rhythm sheet is deduplicated by. */
export const BLOCK_RHYTHM_STYLE_HREF = "stapel-block-rhythm";

/** Where a page's block gap comes from — see `CategoryPageProps.blockRhythm`. */
export type BlockRhythm = "token" | "legacy";

/**
 * The rhythm's rule set.
 *
 * Three rules, and the third is half of the fix: `margin-block: 0` on every
 * direct child. A gap only governs the space a container puts BETWEEN its
 * children — a block that also carries its own top or bottom margin adds to
 * it, and the spacing stops being one number. That is how a page ends up with
 * four different distances nobody chose.
 *
 * A sheet rather than inline styles because the compact arm is a media query
 * and the reset addresses children these components do not own.
 */
export function blockRhythmCss(): string {
  const block = `.${BLOCK_RHYTHM_CLASS}`;
  const narrow = `(max-width:${String(breakpoints.tablet - 1)}px)`;
  return [
    `${block}{gap:var(${BLOCK_GAP_VAR},${String(spacing[6])}px)}`,
    `@media (pointer:coarse),${narrow}{` +
      `${block}{gap:var(${BLOCK_GAP_COMPACT_VAR},${String(spacing[5])}px)}}`,
    // A block's own outer margin is a second opinion about the same distance.
    `${block}>*{margin-block:0}`,
  ].join("\n");
}
