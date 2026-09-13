/**
 * A CARD CUTS TEXT ONE WAY, AND THE CUT IS NEVER INSIDE A WORD.
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
 * Owner's ruling: ellipsis at the end of the LAST line the string is allowed,
 * never mid-word, on list and tile alike.
 *
 * ── the second round: the LOCATION line ───────────────────────────────────
 *
 * The titles were fixed and the place name one row below them was not. On a
 * live storefront at 390px, where the grid card is tiled two across, the place
 * still came out cut inside a word — a city name followed by a district name
 * chopped four letters in, on cards for two different Russian cities. All
 * three cards were still on antd's one-line `ellipsis` for the place (the list
 * card on no rule at all), which is the very defect `titleClamp.ts` was
 * written to stop, one row further down the same card.
 *
 * So the line COUNT is now a parameter of the one rule instead of a second
 * rule: the title gets two lines, the place gets one — see
 * `LOCATION_CLAMP_LINES` for why one — and both come out of the same module,
 * the same hoisted sheet and the same "cut after a whole word" behaviour.
 *
 * ── what this suite can and cannot see ────────────────────────────────────
 *
 * jsdom does not lay text out. "The ellipsis lands after a whole word" and
 * "the cut is at the end of line two" are BROWSER facts and are not observable
 * here — nothing in this file measures a glyph, a line box or an overflow.
 *
 * What IS observable, and what actually broke every time, is WHICH RULE each
 * element reaches for. So this asserts: the element carries the shared class;
 * the class resolves to a real hoisted CSS rule with the line count in it (a
 * style OBJECT would drop `-webkit-line-clamp` and `-webkit-box-orient`
 * silently outside a browser, which is how a clamp goes missing unnoticed);
 * the rule says `overflow-wrap: normal`, which is what keeps a word whole; the
 * selector is doubled, so a host's own element selector cannot quietly win the
 * tie and make the clamp inert; and no card is left on antd's one-line
 * `ellipsis`, which is `white-space: nowrap` and would override the clamp even
 * with the class, the sheet and the declaration all correct.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { ListingCard, ListingFeedCard, ListingSerpCard } from "../src/default/index.js";
import type { ClampLines } from "../src/default/titleClamp.js";
import {
  CARD_CLAMP_STYLE_HREF,
  LOCATION_CLAMP_CLASS,
  LOCATION_CLAMP_LINES,
  TITLE_CLAMP_CLASS,
  TITLE_CLAMP_LINES,
  cardClampCss,
  clampClass,
} from "../src/default/titleClamp.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function providers(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

/**
 * A two-part place name — a city, then a district — long enough that a narrow
 * column has to cut it. Transliterated from the Russian cities the defect was
 * measured on, because the repo lints Cyrillic out of source.
 */
const LONG_PLACE = "Ekaterinburg, Zarechny district";

const WITH_PLACE = { ...CARD, location_label: LONG_PLACE };

const CARDS = [
  { name: "the grid card", testId: "listings-card-title", render: () => <ListingCard listing={CARD} href="/l/7" /> },
  { name: "the tile card", testId: "listings-feed-title", render: () => <ListingFeedCard listing={CARD} href="/l/7" /> },
  { name: "the list card", testId: "listings-serp-title", render: () => <ListingSerpCard listing={CARD} href="/l/7" /> },
] as const;

const PLACES = [
  { name: "the grid card", testId: "listings-card-location", render: () => <ListingCard listing={WITH_PLACE} href="/l/7" /> },
  { name: "the tile card", testId: "listings-feed-location", render: () => <ListingFeedCard listing={WITH_PLACE} href="/l/7" /> },
  { name: "the list card", testId: "listings-serp-location", render: () => <ListingSerpCard listing={WITH_PLACE} href="/l/7" /> },
] as const;

/**
 * One rule per line count, pulled back out of the emitted sheet by its class.
 * Fails loudly rather than returning `undefined`, so a missing arm reads as
 * "the sheet has no rule for N lines" and not as a confusing `toContain` diff.
 */
function ruleFor(lines: ClampLines): string {
  const selector = `.${clampClass(lines)}.${clampClass(lines)}{`;
  const css = cardClampCss();
  const start = css.indexOf(selector);
  expect(start, `no rule for a ${String(lines)}-line clamp in the sheet`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start) + 1);
}

const CLAMPS = [
  { name: "the title clamp", lines: TITLE_CLAMP_LINES, className: TITLE_CLAMP_CLASS },
  { name: "the location clamp", lines: LOCATION_CLAMP_LINES, className: LOCATION_CLAMP_CLASS },
] as const;

describe("the clamp itself", () => {
  it("gives the title two lines and the place one", () => {
    // The counts are the POINT of the parameter: a title is a sentence and
    // gets a second line, a place is a subtitle and does not. Recorded here so
    // a change to either is a change to a test that says why.
    expect(TITLE_CLAMP_LINES).toBe(2);
    expect(LOCATION_CLAMP_LINES).toBe(1);
    expect(clampClass(TITLE_CLAMP_LINES)).toBe(TITLE_CLAMP_CLASS);
    expect(clampClass(LOCATION_CLAMP_LINES)).toBe(LOCATION_CLAMP_CLASS);
    // Two counts, two classes: one class carrying both would clamp whichever
    // element it landed on to whichever count was written last.
    expect(TITLE_CLAMP_CLASS).not.toBe(LOCATION_CLAMP_CLASS);
  });

  it("emits both arms from ONE module, so a card cannot answer twice", () => {
    // The defect in one sentence, twice over: the card had two answers to
    // "how do I cut text" on two rows one above the other. The sheet is the
    // proof that there is now one source for both.
    for (const { lines } of CLAMPS) {
      expect(ruleFor(lines)).toContain(`-webkit-line-clamp:${String(lines)}`);
    }
  });
});

describe.each(CLAMPS)("$name", ({ lines, className }) => {
  it("gives the browser its own ellipsis at the end of the last line", () => {
    // `-webkit-box` + `box-orient: vertical` is what makes `line-clamp` mean
    // anything at all; without the pair the declaration is inert and the text
    // simply runs on.
    const rule = ruleFor(lines);
    expect(rule).toContain("display:-webkit-box");
    expect(rule).toContain("-webkit-box-orient:vertical");
    expect(rule).toContain("overflow:hidden");
  });

  it("outranks a host's own element selector on the same element", () => {
    // THE DEFECT THIS EXISTS FOR, measured live 2026-09-13. Everything the
    // other assertions check was true — class on the element, sheet in the
    // head, `-webkit-line-clamp: 2` in the computed style — and the clamp was
    // still inert, because the container set `display: block` on
    // `[data-testid="listings-serp-title"]`. That selector scores (0,1,0),
    // the same as a single class, so the later sheet won and a 113-character
    // title drew three lines. The doubled class scores (0,2,0) and cannot
    // lose that tie.
    const rule = ruleFor(lines);
    const selector = rule.slice(0, rule.indexOf("{"));
    const classes = selector.split(".").filter((part) => part.length > 0);
    expect(classes).toEqual([className, className]);
    // The declaration that the host's rule actually collided with.
    expect(rule).toContain("display:-webkit-box");
  });

  it("moves a long word to the next line whole rather than breaking it", () => {
    // The ruling is "never mid-word". `line-clamp` decides where the BLOCK
    // ends; this decides that a word is not split to fill a line on the way
    // there, which is the same defect one level down and is what a narrow grid
    // track would otherwise do. On a ONE-line clamp it is the whole fix: the
    // line breaks at the last word boundary that fits and the ellipsis follows
    // a complete word, instead of landing four letters into a district name.
    const rule = ruleFor(lines);
    expect(rule).toContain("overflow-wrap:normal");
    expect(rule).not.toContain("break-word");
    expect(rule).not.toContain("break-all");
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
      `style[data-href="${CARD_CLAMP_STYLE_HREF}"]`
    );
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toContain("-webkit-line-clamp:2");
  });
});

describe.each(PLACES)("$name's place name", ({ testId, render: renderCard }) => {
  it("clamps with the shared rule, at the location's line count", () => {
    render(providers(renderCard()));
    const place = screen.getByTestId(testId);
    expect(place.className).toContain(LOCATION_CLAMP_CLASS);
    // The class is only half of it — the sheet that gives the class meaning
    // has to be on the page too, under the href both clamps share.
    const sheet = document.querySelector(
      `style[data-href="${CARD_CLAMP_STYLE_HREF}"]`
    );
    expect(sheet?.textContent).toContain(
      `-webkit-line-clamp:${String(LOCATION_CLAMP_LINES)}`
    );
  });

  it("is NOT on antd's one-line ellipsis", () => {
    render(providers(renderCard()));
    // THE DEFECT, named. `ellipsis` stamps `ant-typography-ellipsis` and with
    // it `white-space: nowrap` + `text-overflow: ellipsis`, which cuts at the
    // exact pixel the column runs out — mid-word — and would keep doing so
    // with our class, our sheet and our declaration all present, because
    // `nowrap` leaves the line no word boundary to break at. Removing the prop
    // IS the fix; carrying the class beside it would have been a green test
    // over an unchanged screen.
    expect(screen.getByTestId(testId).className).not.toContain(
      "ant-typography-ellipsis"
    );
  });

  it("keeps the WHOLE place name in the document, not just the visible part", () => {
    render(providers(renderCard()));
    const place = screen.getByTestId(testId);
    // antd's `ellipsis` truncates in JAVASCRIPT and hands the remainder back
    // as a hover-only tooltip — which is nothing at all on the 390px phone
    // this was measured on, and which the fleet's own lint rule
    // (stapel/no-tooltip-in-skin) refuses on a Typography for that reason.
    // A CSS clamp hides the overflow instead of removing it, so the district
    // is still selectable, still findable by the browser's find-in-page, and
    // still read out in full by a screen reader.
    //
    // This one IS fully observable in jsdom — it is text content, not layout.
    expect(place.textContent).toBe(LONG_PLACE);
    // And the cut is not being done in JS behind our back.
    expect(place.textContent).not.toContain("…");
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

  it("cuts the place the same way on all THREE, one row below the title", () => {
    // The title and the place are the two strings on a card that can outrun
    // their column, and they have now drifted apart on this question three
    // times. The two loops stand next to each other deliberately: whoever adds
    // a fourth card surface fails both or neither.
    const places = PLACES.map(({ testId, render: renderCard }) => {
      const { unmount } = render(providers(renderCard()));
      const el = screen.getByTestId(testId);
      const seen = { testId, className: el.className };
      unmount();
      return seen;
    });
    for (const { testId, className } of places) {
      expect(className, `${testId} must carry the shared clamp`).toContain(
        LOCATION_CLAMP_CLASS
      );
      expect(className, `${testId} must not be on antd's one-line ellipsis`).not.toContain(
        "ant-typography-ellipsis"
      );
    }
  });
});
