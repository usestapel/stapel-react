/**
 * THE SPEC LINE'S BOX, not its pixels.
 *
 * ── Round one: the truncation was on the wrong element ────────────────────
 *
 * `<CardSpecLine>` drew `<Typography.Text ellipsis>` around the badge row's
 * own `<span>`. antd's `ellipsis` clips on the TEXT element; the span inside
 * is a separate, inline box that lays out at its natural width whatever its
 * parent hides — so the line looked right and measured wrong. The stand's
 * tidiness probe: `listings-card-specs-text` 57px wider than the element it
 * sits in. The answer was to move the clipping onto the span and make the box
 * a flex container so the span could shrink.
 *
 * ── Round two: that answer never acted, and here is why ───────────────────
 *
 * Two reviewers re-measured the card at 390 on the live stand and the same
 * span still ran past its column — 7px on one category page, 47px on another.
 * The class was on the element, the sheet was in the document and every
 * declaration was in it. What was missing is that antd writes
 *
 *     a.ant-typography-ellipsis, span.ant-typography-ellipsis
 *       { display: inline-block; max-width: 100% }
 *
 * (`antd/es/typography/style/mixins.js`, `getEllipsisStyles`), and an element
 * plus a class scores (0,1,1) against the single class `.stapel-listing-
 * spec-line` (0,1,0). It wins on SPECIFICITY, so no load order and no hoisting
 * could have saved it: the box was never a flex container, the span was
 * therefore never a flex child, and `min-inline-size: 0` on a child that is
 * not a flex item does nothing at all. `.ant-typography-ellipsis-single-line`
 * then put `white-space: nowrap` on the box, which INHERITS, so the span had
 * no break opportunity either.
 *
 * MEASURED IN HEADLESS CHROMIUM, the same DOM the SSR render emits and antd's
 * own two rules copied out of `node_modules`, in a 180px column:
 *
 *   before — box `display: block` (the inline-block blockified by the card's
 *            own flex column), span `display: inline`, span width 454.77px
 *            in a 180px box: 274.77px past the column.
 *   after  — box `display: flex`, span clamped to one line, span width 180px,
 *            0px past the column.
 *
 * ── What the fix IS ───────────────────────────────────────────────────────
 *
 * The `ellipsis` prop goes, because it is the thing that puts those two antd
 * classes on the box. The cut is then the module the card already answers
 * "how do I cut text" with — `titleClamp.ts` at `LOCATION_CLAMP_LINES`, one
 * line, the ellipsis after a whole WORD rather than inside one — and the box
 * keeps `display: flex` + `min-inline-size: 0` so the span may shrink below
 * its content. One rule for the card's four strings, not a second one here.
 *
 * WHAT THIS FILE CANNOT SEE. jsdom lays nothing out and evaluates no cascade:
 * "the span is 180px", "the ellipsis falls after a whole word" and "274.77px
 * of overflow are gone" are BROWSER facts, and they are proven above in
 * headless Chromium rather than here. What is asserted here is the mechanism
 * that produces them, in DOM terms: which classes are on which element, that
 * the antd class whose rule beat ours is no longer among them, and that the
 * sheet that does the cutting is in the document.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CARD_SPEC_LINE_CLASS,
  CARD_SPEC_TEXT_CLASS,
  CardSpecLine,
  cardSpecLineCss,
} from "../src/default/index.js";
/* The clamp module is internal to the skin — imported by its own path, the
   way `titleClamp.test.tsx` does, rather than through the entry it is
   deliberately not on. */
import { LOCATION_CLAMP_CLASS, cardClampCss } from "../src/default/titleClamp.js";
import { TestProviders, mockServer } from "./harness.js";

const ROWS = [
  {
    slug: "power",
    type: "int" as const,
    value: 1200,
    name: "Power",
    unit: "W",
    label: "1 200",
    presentation: "value_unit" as const,
    title: true,
    order: 1,
  },
  {
    slug: "condition",
    type: "select" as const,
    value: ["used"],
    name: "Condition",
    label: "Second-hand and rather long, as a seller writes it",
    presentation: "value" as const,
    title: true,
    order: 2,
  },
];

function line() {
  render(
    <TestProviders server={mockServer({})}>
      <CardSpecLine rows={ROWS} copy={{}} testId="listings-card-specs" />
    </TestProviders>
  );
  return {
    box: screen.getByTestId("listings-card-specs"),
    text: screen.getByTestId("listings-card-specs-text"),
  };
}

describe("the spec line truncates on the element that holds the words", () => {
  it("makes the text a flex child that may shrink below its content", () => {
    const { box, text } = line();
    expect(box.classList.contains(CARD_SPEC_LINE_CLASS)).toBe(true);
    expect(text.classList.contains(CARD_SPEC_TEXT_CLASS)).toBe(true);
    // The span really is INSIDE the box it was overflowing — the pair the
    // probe measured, not two unrelated elements.
    expect(box.contains(text)).toBe(true);

    const css = cardSpecLineCss();
    // The container has to be a flex container for the child to be a flex
    // child at all, and the selector has to be able to WIN: a single class
    // loses to antd's `span.ant-typography-ellipsis` on specificity, which is
    // how this declaration sat in the sheet for a release doing nothing.
    expect(css).toContain(
      `.${CARD_SPEC_LINE_CLASS}.${CARD_SPEC_LINE_CLASS}{display:flex;min-inline-size:0}`
    );
    // THE declaration. `min-width: auto` is a flex item's default and it
    // pins the item at its content's natural width.
    expect(css).toContain(`.${CARD_SPEC_TEXT_CLASS}{flex:1 1 auto;min-inline-size:0}`);
  });

  it("cuts with the card's own clamp and does not answer the question twice", () => {
    const { box, text } = line();
    // The cut is `titleClamp.ts`'s one-line rule — the same module the title,
    // the place and the description are cut by.
    expect(text.classList.contains(LOCATION_CLAMP_CLASS)).toBe(true);
    // …and the rule that does it is in the document, not merely named.
    const clamp = [...document.querySelectorAll("style")].filter((one) =>
      (one.textContent ?? "").includes(`.${LOCATION_CLAMP_CLASS}.${LOCATION_CLAMP_CLASS}{`)
    );
    expect(clamp).toHaveLength(1);
    expect(cardClampCss()).toContain("-webkit-line-clamp:1");

    // The pair's own sheet no longer cuts anything: a second answer to "how
    // do I cut text" on one card is the defect `titleClamp.ts` exists to stop,
    // and `white-space: nowrap` is what puts an ellipsis inside a word.
    const css = cardSpecLineCss();
    expect(css).not.toContain("white-space:nowrap");
    expect(css).not.toContain("text-overflow:ellipsis");

    // THE ANTD CLASS THAT BEAT US IS GONE. `ellipsis` is what puts it there,
    // and while it is on the element no sheet of ours can make the box a flex
    // container — `span.ant-typography-ellipsis` scores (0,1,1).
    expect(box.className).not.toContain("ant-typography-ellipsis");
  });

  it("hoists its sheet once, and writes no inline geometry", () => {
    const { box, text } = line();
    const sheets = [...document.querySelectorAll("style")].filter((one) =>
      (one.textContent ?? "").includes(`.${CARD_SPEC_TEXT_CLASS}{`)
    );
    expect(sheets).toHaveLength(1);
    // A class, so a host that wants two lines instead of one writes a
    // selector rather than an `!important` over a pair's own geometry.
    expect(box.style.display).toBe("");
    expect(text.style.overflow).toBe("");
    expect(text.style.minInlineSize).toBe("");
  });

  it("still says nothing for a listing with no title features", () => {
    render(
      <TestProviders server={mockServer({})}>
        <CardSpecLine rows={[]} copy={{}} testId="listings-card-specs" />
      </TestProviders>
    );
    expect(screen.queryByTestId("listings-card-specs")).toBeNull();
  });
});
