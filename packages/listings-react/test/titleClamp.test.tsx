/**
 * A CARD TITLE IS TWO LINES, AND THE CUT IS NEVER INSIDE A WORD.
 *
 * The tile card clamped its title to two lines. The grid card answered the
 * same question with antd's `<Typography.Text ellipsis>`, which is ONE line
 * and puts the cut wherever the line happens to end — in the middle of a word
 * for any title longer than a few characters. On the live storefront's home
 * grid (2026-09-13, desktop 1440) that drew job titles cut as
 * "Electrician - construc…" while the tile beside it wrapped the same string
 * over two lines.
 *
 * Two cards, two different answers, and the wrong one on the busiest surface.
 * Owner's ruling: two lines, ellipsis at the end of the SECOND line, never
 * mid-word, on list and tile alike.
 *
 * ── what this suite can and cannot see ────────────────────────────────────
 *
 * jsdom does not lay text out, so "the cut lands at the end of line two" is
 * not observable here; it is the browser's own behaviour once the rule is
 * applied. What IS observable, and what actually broke, is WHICH RULE each
 * card reaches for — so this asserts that both cards carry the same clamp
 * class, that the clamp is a real hoisted CSS rule (a style OBJECT would drop
 * `-webkit-line-clamp` and `-webkit-box-orient` silently outside a browser,
 * which is exactly how a clamp goes missing unnoticed), and that no card is
 * left on antd's one-line `ellipsis`.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { ListingCard, ListingFeedCard, ListingSerpCard } from "../src/default/index.js";
import {
  TITLE_CLAMP_CLASS,
  TITLE_CLAMP_LINES,
  TITLE_CLAMP_STYLE_HREF,
  titleClampCss,
} from "../src/default/titleClamp.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function providers(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

const CARDS = [
  { name: "the grid card", testId: "listings-card-title", render: () => <ListingCard listing={CARD} href="/l/7" /> },
  { name: "the tile card", testId: "listings-feed-title", render: () => <ListingFeedCard listing={CARD} href="/l/7" /> },
  { name: "the list card", testId: "listings-serp-title", render: () => <ListingSerpCard listing={CARD} href="/l/7" /> },
] as const;

describe("the clamp itself", () => {
  it("is two lines", () => {
    expect(TITLE_CLAMP_LINES).toBe(2);
    expect(titleClampCss()).toContain("-webkit-line-clamp:2");
  });

  it("gives the browser its own ellipsis at the end of the last line", () => {
    // `-webkit-box` + `box-orient: vertical` is what makes `line-clamp` mean
    // anything at all; without the pair the declaration is inert and the title
    // simply runs on.
    expect(titleClampCss()).toContain("display:-webkit-box");
    expect(titleClampCss()).toContain("-webkit-box-orient:vertical");
    expect(titleClampCss()).toContain("overflow:hidden");
  });

  it("moves a long word to the next line whole rather than breaking it", () => {
    // The ruling is "never mid-word". `line-clamp` decides where the BLOCK
    // ends; this decides that a word is not split to fill a line on the way
    // there, which is the same defect one level down and is what a narrow grid
    // track would otherwise do.
    expect(titleClampCss()).toContain("overflow-wrap:normal");
    expect(titleClampCss()).not.toContain("break-word");
    expect(titleClampCss()).not.toContain("break-all");
  });
});

describe.each(CARDS)("$name", ({ testId, render: renderCard }) => {
  it("clamps its title with the shared rule", () => {
    render(providers(renderCard()));
    expect(screen.getByTestId(testId).className).toContain(TITLE_CLAMP_CLASS);
  });

  it("is NOT on antd's one-line ellipsis", () => {
    render(providers(renderCard()));
    // This is the defect, named: `ellipsis` stamps `ant-typography-ellipsis`
    // and clamps to a single line, which is where the mid-word cut came from.
    expect(screen.getByTestId(testId).className).not.toContain(
      "ant-typography-ellipsis"
    );
  });

  it("hoists the rule as a real stylesheet, under the shared href", () => {
    render(providers(renderCard()));
    // React 19 hoists `<style href precedence>` and re-stamps the key as
    // `data-href` on the element it puts in the head — querying `href` finds
    // nothing and looks exactly like "the card forgot the stylesheet".
    const sheet = document.querySelector(
      `style[data-href="${TITLE_CLAMP_STYLE_HREF}"]`
    );
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toContain("-webkit-line-clamp:2");
  });
});

describe("every card answers the question the same way", () => {
  it("shares one class across all THREE, so no card can drift apart", () => {
    // The defect was not that any rule was wrong on its own. It was that there
    // were several of them and only some cards' were right — and the count of
    // "some" was wrong twice: the first fix reached the tile and missed the
    // grid, the second reached the grid and missed the LIST card, which is the
    // default view on a live storefront and therefore the one the owner is
    // actually looking at. Three cards, one rule, asserted together.
    const classes = CARDS.map(({ testId, render: renderCard }) => {
      const { unmount } = render(providers(renderCard()));
      const className = screen.getByTestId(testId).className;
      unmount();
      return { testId, className };
    });
    for (const { testId, className } of classes) {
      expect(className, `${testId} must carry the shared clamp`).toContain(
        TITLE_CLAMP_CLASS
      );
    }
  });
});
