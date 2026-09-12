/**
 * The skin's scrollbar — one rule set, for every scroll port this pair owns.
 *
 * It started as the rail's own: `<SearchPage>` replaced the platform bar
 * standing next to the filters with a 6px hairline in the token palette. But
 * the rail is not the only box in the panel that scrolls — a dictionary facet
 * (the make axis, 418 car makes) is a scroll port INSIDE the rail, and kept the
 * platform's bar: on the live storefront the system thumb was painted over the
 * count column, so «Chery 5» read as «Chery» with the 5 under a grey strip.
 *
 * A box that scrolls owes the reader two things, and both are here:
 *
 *  - `scrollbar-gutter: stable`, so the space the bar needs is subtracted from
 *    the CONTENT box rather than overlaid on it, and the box's right edge does
 *    not move when the thumb arrives;
 *  - a thumb that is the skin's — a 6px track with no arrows and no track
 *    fill, transparent at rest, appearing on `:hover` (a pointer scrolling
 *    inside it) and `:focus-within` (a keyboard), and standing permanently
 *    under `(pointer: coarse)`, where neither fires and an invisible bar is a
 *    box with no sign it has a tail.
 *
 * Both vendor forms, because they are not alternatives: Firefox reads
 * `scrollbar-width`/`scrollbar-color` and nothing else, WebKit and Chromium
 * read the `::-webkit-scrollbar` pseudo-elements and (in Chromium) the
 * standard properties too.
 *
 * The colours are `--stapel-*` custom properties, which resolve per theme at
 * paint time — an inline colour or a `useToken()` value would freeze whichever
 * theme was mounted first. This design system's neutral vocabulary has no
 * `colorFill*` ramp of its own: `border` IS its tertiary-fill role (the
 * hairline every pane is separated by) and `text-subtle` is that role one step
 * stronger, which is what the thumb takes when a pointer is on the thumb
 * itself.
 *
 * Emitted as one hoisted `<style href precedence>` (React 19 dedupes by
 * `href`), because a pseudo-element is unreachable from an inline style — so
 * the rail and the dictionary list mount the SAME element, once, however many
 * of each are on screen.
 *
 * The names still say "rail" and they stay that way: they are this package's
 * published surface, and a hoisted sheet is identified by its `href`. Renaming
 * them would break every host that reads the class to assert which bar is on
 * screen, and would buy nothing but a tidier word.
 */
import type { CSSProperties } from "react";
import { cssVar, spacing } from "@stapel/tokens";

/**
 * The class that carries the SKIN's scrollbar — present on the rail under
 * `railScrollbar: "styled"` and absent under `"system"`, so the two arms are
 * one class apart and a stand can read which one is on screen. Always present
 * on a scroll port INSIDE the panel, which is not a surface a host chose.
 */
export const RAIL_SCROLLBAR_CLASS = "stapel-search-rail-scrollbar";

/** The `href` the hoisted rail sheet is deduplicated by. */
export const RAIL_STYLE_HREF = "stapel-search-rail";

/**
 * The scrollbar's track width, in CSS pixels.
 *
 * Not on the spacing scale on purpose, and not a spacing decision: this is the
 * thickness of a hairline instrument, the size every platform's own overlay
 * bar lands within, and the number the storefront's owner named. Six is thin
 * enough to read as part of the panel and thick enough to grab.
 */
export const RAIL_SCROLLBAR_WIDTH = 6;

/** See the module note. */
export function railScrollbarCss(): string {
  const bar = `.${RAIL_SCROLLBAR_CLASS}`;
  const size = `${String(RAIL_SCROLLBAR_WIDTH)}px`;
  const thumb = cssVar("border");
  const awake = `${bar}:hover,${bar}:focus-within`;
  return [
    // ── Firefox ────────────────────────────────────────────────────────────
    `${bar}{scrollbar-width:thin;scrollbar-gutter:stable;` +
      `scrollbar-color:transparent transparent}`,
    `${awake}{scrollbar-color:${thumb} transparent}`,
    // ── WebKit / Chromium ──────────────────────────────────────────────────
    `${bar}::-webkit-scrollbar{inline-size:${size};block-size:${size}}`,
    `${bar}::-webkit-scrollbar-track{background:transparent}`,
    `${bar}::-webkit-scrollbar-thumb{background:transparent;` +
      `border-radius:${cssVar("radius-full")}}`,
    `${bar}:hover::-webkit-scrollbar-thumb,` +
      `${bar}:focus-within::-webkit-scrollbar-thumb{background:${thumb}}`,
    `${bar}::-webkit-scrollbar-thumb:hover{background:${cssVar("text-subtle")}}`,
    // ── A surface with no hover at all ─────────────────────────────────────
    `@media (pointer:coarse){${bar}{scrollbar-color:${thumb} transparent}` +
      `${bar}::-webkit-scrollbar-thumb{background:${thumb}}}`,
  ].join("\n");
}

/**
 * What a scroll port inside the panel reserves at its trailing edge.
 *
 * `scrollbar-gutter: stable` is the rule and the sheet above states it; this
 * is the same number as a value, for the ROW to keep its last column clear of.
 * `scrollbar-gutter` subtracts the gutter from the scroll container's content
 * box, which is enough on every engine that honours it — and is ignored
 * outright by Safari, where an overlay thumb still lands on top of whatever
 * sits at the trailing edge. A count is the one thing in a facet row that
 * lives there, so it carries the gutter as padding of its own: correct twice
 * over on Chromium and Firefox, and the only thing standing between the number
 * and the thumb on WebKit.
 */
export const SCROLL_GUTTER_INLINE_END: CSSProperties = {
  paddingInlineEnd: RAIL_SCROLLBAR_WIDTH,
};

/**
 * The top of a list that sits directly under a control.
 *
 * The dictionary list's first row was drawn flush against the box that filters
 * it — at a glance the row read as clipped BY the input rather than as the
 * first value under it. One step of the scale is the whole fix; it is stated
 * here rather than inline so the rail's two scroll ports open the same way.
 */
export const SCROLL_LIST_INSET_BLOCK_START: number = spacing[1];
