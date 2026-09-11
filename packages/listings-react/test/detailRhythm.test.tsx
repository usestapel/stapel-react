/**
 * ONE GAP BETWEEN THE LISTING PAGE'S BLOCKS.
 *
 * The stand's tidiness probe measured the gaps INSIDE `<ListingDetailPane>`'s
 * own column at 1440 and 390: 111.05, 53.59, 42.39, 29 and 27 pixels, in a
 * container that declares 16 (12 in the buy column). Five distances, none of
 * them chosen — a flex `gap` and a child's own `margin-block` ADD, and half
 * the children are antd components carrying one (`<Divider>` 24 + 24,
 * `<Typography.Title>` its level's margin, `<Typography.Paragraph>` a line).
 *
 * jsdom resolves none of this: it has no layout, and `getComputedStyle` on a
 * `margin-block` written by a hoisted sheet answers `""` (checked). So the
 * claim is made the way it can be made truthfully, in three parts that
 * together say what a browser would:
 *
 *   1. the sheet is IN the document and its reset is scoped to the class the
 *      pane's columns carry;
 *   2. EVERY direct child of each column is matched by that reset's selector —
 *      enumerated, not sampled, so a block added later without a margin of the
 *      pane's own is still covered;
 *   3. no child writes an outer margin INLINE, which would beat the sheet;
 *      the one exception is the section rule, whose own class is the more
 *      specific selector and whose spacing is a token.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  DETAIL_RHYTHM_CLASS,
  DETAIL_RULE_CLASS,
  DETAIL_RULE_SPACE,
  ListingDetailPane,
  detailRhythmCss,
} from "../src/default/index.js";
import { spacing } from "@stapel/tokens";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

function server() {
  return mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": { body: detail() },
  });
}

/** Is this element covered by the column's own reset? */
function reset(node: Element): boolean {
  return node.matches(`.${DETAIL_RHYTHM_CLASS} > *`);
}

/** What the element writes INLINE about its own outer margin — the one thing
 * that would beat the sheet. */
function inlineMargin(node: Element): string {
  const style = (node as HTMLElement).style;
  return [
    style.margin,
    style.marginTop,
    style.marginBottom,
    style.marginBlock,
    style.marginBlockStart,
    style.marginBlockEnd,
  ]
    .filter((one) => one !== "")
    .join("|");
}

describe("the pane's column owns the distance between its blocks", () => {
  it("carries the reset, and every direct child is under it", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-description")).toBeTruthy();
    });
    const column = screen.getByTestId("listings-detail");
    expect(column.classList.contains(DETAIL_RHYTHM_CLASS)).toBe(true);

    const children = [...column.children];
    // The page really is assembled out of blocks in this one column — the
    // fragments the pane returns flatten into it, which is exactly why the
    // reset has to be a `> *` and not a handful of named components.
    expect(children.length).toBeGreaterThan(5);
    for (const child of children) {
      expect(reset(child), child.tagName + (child.className || "")).toBe(true);
    }
  });

  it("lets no child state its own outer margin inline, except the rule", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-description")).toBeTruthy();
    });
    const column = screen.getByTestId("listings-detail");
    for (const child of [...column.children]) {
      // An inline declaration is beaten by nothing short of `!important`, so
      // one here would be a second opinion the sheet could not answer.
      expect(inlineMargin(child), child.tagName).toBe("");
    }
  });

  it("gives the section rule a token spacing rather than antd's 24", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-description")).toBeTruthy();
    });
    const rule = document.querySelector(`.${DETAIL_RULE_CLASS}`);
    expect(rule).toBeTruthy();
    // A break, not a block: it keeps ONE step of its own, and the step is a
    // token rather than whatever antd's sheet happened to sum to.
    expect(DETAIL_RULE_SPACE).toBe(spacing[2]);
    expect(DETAIL_RULE_SPACE).not.toBe(24);
    const css = detailRhythmCss();
    expect(css).toContain(`.${DETAIL_RHYTHM_CLASS}>*{margin-block:0}`);
    expect(css).toContain(
      `.${DETAIL_RHYTHM_CLASS}>.${DETAIL_RULE_CLASS}{margin-block:${String(
        DETAIL_RULE_SPACE
      )}px}`
    );
    // Specificity, not `!important`: `.col > .rule` (0,2,0) beats
    // `.col > *` (0,1,0), so the rule keeps its air and a host can still
    // out-specify both with one more condition.
    expect(css).not.toContain("!important");
  });

  it("resets both columns of the split layout too", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} layout="split" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-buy-column")).toBeTruthy();
    });
    // The reading column and the sticky buy column are the two places the
    // split puts blocks in; the outer column holds the split itself.
    for (const id of [
      "listings-detail",
      "listings-detail-reading-column",
      "listings-detail-buy-column",
    ]) {
      expect(
        screen.getByTestId(id).classList.contains(DETAIL_RHYTHM_CLASS),
        id
      ).toBe(true);
    }
    for (const child of [...screen.getByTestId("listings-detail-buy-column").children]) {
      expect(reset(child)).toBe(true);
      expect(inlineMargin(child)).toBe("");
    }
  });

  it("hoists the sheet into the document, once", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-description")).toBeTruthy();
    });
    const sheets = [...document.querySelectorAll("style")].filter((one) =>
      (one.textContent ?? "").includes(`.${DETAIL_RHYTHM_CLASS}>*`)
    );
    expect(sheets).toHaveLength(1);
  });
});
