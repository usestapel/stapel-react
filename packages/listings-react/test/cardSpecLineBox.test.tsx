/**
 * THE SPEC LINE'S BOX, not its pixels.
 *
 * `<CardSpecLine>` draws `<Typography.Text ellipsis>` around the badge row's
 * own `<span>`. antd's `ellipsis` clips on the TEXT element; the span inside
 * is a separate, inline box that lays out at its natural width whatever its
 * parent hides — so the line looked right and measured wrong. The stand's
 * tidiness probe: `listings-card-specs-text` 57px wider than the element it
 * sits in.
 *
 * A box that reports a width nothing on screen has is a defect whether or not
 * a pixel of it is visible: it is what a container measuring the card, a
 * sticky-header calculation or the next layout rule reads.
 *
 * jsdom has no layout, so the 57px is not what is asserted here. What is
 * asserted is the mechanism that removes it — the truncation moved onto the
 * span, and the one declaration without which every other rule is decoration:
 * `min-inline-size: 0`, which is what lets a flex child shrink below its own
 * content at all.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CARD_SPEC_LINE_CLASS,
  CARD_SPEC_TEXT_CLASS,
  CardSpecLine,
  cardSpecLineCss,
} from "../src/default/index.js";
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
    // child at all…
    expect(css).toContain(`.${CARD_SPEC_LINE_CLASS}{display:flex`);
    // …and the box itself must be allowed to shrink inside the card.
    expect(css).toContain(`.${CARD_SPEC_LINE_CLASS}{display:flex;min-inline-size:0}`);
    // THE declaration. `min-width: auto` is a flex item's default and it
    // pins the item at its content's natural width; without this line the
    // overflow rule below has nothing to act on.
    expect(css).toContain(`.${CARD_SPEC_TEXT_CLASS}{flex:1 1 auto;min-inline-size:0;`);
    expect(css).toContain("overflow:hidden");
    expect(css).toContain("white-space:nowrap");
    expect(css).toContain("text-overflow:ellipsis");
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
