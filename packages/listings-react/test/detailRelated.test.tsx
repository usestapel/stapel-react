/**
 * THE TWO "FIND MORE" STRIPS, and the spec fold above them.
 *
 * The gaps (REPORT §16 comparison 4, comparison 1; inventory rows "No
 * similar/find more widgets" and "Characteristics table shows roughly 2.5×
 * fewer fields"): the reference ends a listing with two DISTINCT sections —
 * catalogue-style "more options" and "other listings from this seller" — and
 * folds a long characteristics list behind one control.
 *
 * What is asserted here about the CHARACTERISTICS is deliberately not "we now
 * show more fields": the pane already draws every stored row it can key (see
 * `detailCharacteristics` in this file), and the shortfall the comparison
 * measured was in the DATA. What `characteristicsLimit` adds is the reference's
 * fold, off by default.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  ListingDetailPane,
  ListingSpecList,
  RELATED_CARD_GAP,
  RELATED_CARD_WIDTH,
  RELATED_STRIP_CLASS,
  SPEC_FOLD_MIN_HIDDEN,
  relatedStripCss,
} from "../src/default/index.js";
import { TITLE_CLAMP_CLASS } from "../src/default/titleClamp.js";
import type { ListingCard } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD, detail, statusInfo } from "./fixtures.js";

function server() {
  return mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": { body: detail() },
  });
}

function rows(ids: readonly number[]): ListingCard[] {
  return ids.map((id) => ({ ...CARD, id, title: `Row ${String(id)}` }));
}

describe("the two ways to find more, and neither drawn empty", () => {
  it("draws only the strip that has items, each with its own caption", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          similar={rows([11, 12])}
          listingHref={(id) => `/l/${String(id)}`}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-similar")).toBeTruthy();
    });
    // A heading over nothing reads as a section that failed to load.
    expect(screen.queryByTestId("listings-detail-from-seller")).toBeNull();
    const strip = screen.getByTestId("listings-detail-similar");
    expect(strip.textContent).toContain("Similar listings");
    expect(strip.querySelectorAll(`.${RELATED_STRIP_CLASS} > *`)).toHaveLength(2);
    // The cards lead somewhere, through the host's own address builder.
    expect(strip.querySelector('a[href="/l/11"]')).toBeTruthy();
    // No link out unless the host named the search this is a sample of.
    expect(screen.queryByTestId("listings-detail-similar-all")).toBeNull();
  });

  it("links each strip out to the search it samples", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          fromSeller={rows([21])}
          fromSellerHref="/s?owner=1f5b"
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-from-seller")).toBeTruthy();
    });
    const all = screen.getByTestId("listings-detail-from-seller-all");
    expect(all.getAttribute("href")).toBe("/s?owner=1f5b");
    expect(all.textContent).toBe("Show all");
    expect(screen.getByTestId("listings-detail-from-seller").textContent).toContain(
      "More from this seller"
    );
  });

  it("hands a render prop what the pane knows, and draws no default beside it", async () => {
    let seen: Record<string, unknown> | undefined;
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          similar={rows([11])}
          renderSimilar={(context) => {
            seen = context as unknown as Record<string, unknown>;
            return <div data-testid="host-similar" />;
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("host-similar")).toBeTruthy();
    });
    // The renderer WINS over the rows: a host with one has already decided
    // what the section is.
    expect(screen.queryByTestId("listings-detail-similar")).toBeNull();
    // Everything a search query for "more like this" is built from.
    expect(seen?.["listingId"]).toBe(7);
    expect(seen?.["categoryId"]).toBe("tools/power");
    expect(typeof seen?.["ownerKey"]).toBe("string");
    expect(Array.isArray(seen?.["axes"])).toBe(true);
  });

  it("gives the strip its cards' width in a stylesheet, not inline", () => {
    const css = relatedStripCss();
    // The child rule is the reason this is a sheet: an inline style cannot
    // reach a child, and the basis is what makes the row a strip.
    expect(css).toContain(`.${RELATED_STRIP_CLASS}{display:flex`);
    expect(css).toContain("overflow-x:auto");
    expect(css).toContain(`.${RELATED_STRIP_CLASS}>*{flex:0 0`);
  });
});

describe("the characteristics fold", () => {
  const FEATURES = Array.from({ length: 14 }, (_, i) => ({
    slug: `f${String(i)}`,
    name: `Field ${String(i)}`,
    config: { type: "string" },
  }));
  const VALUES = Object.fromEntries(
    FEATURES.map((feature) => [feature.slug, { type: "string", value: "yes" }])
  );

  it("draws every row when no limit was asked for", () => {
    render(
      <TestProviders server={server()}>
        <ListingSpecList features={FEATURES} values={VALUES} />
      </TestProviders>
    );
    expect(screen.getAllByTestId(/^listings-spec-row-/)).toHaveLength(14);
    expect(screen.queryByTestId("listings-spec-list-show-all")).toBeNull();
  });

  it("folds at the limit and opens the rest in place", () => {
    render(
      <TestProviders server={server()}>
        <ListingSpecList features={FEATURES} values={VALUES} limit={10} />
      </TestProviders>
    );
    expect(screen.getAllByTestId(/^listings-spec-row-/)).toHaveLength(10);
    const control = screen.getByTestId("listings-spec-list-show-all");
    expect(control.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(control);
    // In place: no navigation, and every row now in the accessibility tree.
    expect(screen.getAllByTestId(/^listings-spec-row-/)).toHaveLength(14);
    expect(screen.queryByTestId("listings-spec-list-show-all")).toBeNull();
  });

  it("does not fold a list it cannot save two rows by folding", () => {
    render(
      <TestProviders server={server()}>
        <ListingSpecList
          features={FEATURES.slice(0, 10 + SPEC_FOLD_MIN_HIDDEN - 1)}
          values={VALUES}
          limit={10}
        />
      </TestProviders>
    );
    // A control as tall as the row it hides is not a saving.
    expect(screen.getAllByTestId(/^listings-spec-row-/)).toHaveLength(11);
    expect(screen.queryByTestId("listings-spec-list-show-all")).toBeNull();
  });

  it("reaches the pane through characteristicsLimit, and is off by default", async () => {
    const { unmount } = render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-spec-list")).toBeTruthy();
    });
    const all = screen.getAllByTestId(/^listings-spec-row-/).length;
    expect(all).toBeGreaterThan(0);
    expect(screen.queryByTestId("listings-spec-list-show-all")).toBeNull();
    unmount();

    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} characteristicsLimit={1} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-spec-list")).toBeTruthy();
    });
    if (all - 1 >= SPEC_FOLD_MIN_HIDDEN) {
      expect(screen.getAllByTestId(/^listings-spec-row-/)).toHaveLength(1);
      expect(screen.getByTestId("listings-spec-list-show-all")).toBeTruthy();
    }
  });
});

/**
 * THE TWO RAILS ARE RAILS, NOT STAIRCASES.
 *
 * Measured by the reviewers at 390 / 768 / 1024 / 1440 in both themes, and
 * re-measured in headless Chromium on the LIVE page (`/l/1077`, the seller's
 * rail, eight cards) while this was being written:
 *
 *   - the card width is `min(46%, 220px)`, which is a SHARE of the rail below
 *     about 478px and a fixed 220 above it: measured on the live page, the
 *     card is 175.72px wide with a 131.78px photo at 390 and 220 / 165 at
 *     1440. One card, two sizes, and the photo height follows the width —
 *     which is the range of widths and the differing photo heights the
 *     reviewers reported across the four viewports they walked;
 *   - the PRICES do not share a baseline: 1733px on six cards and 1709px on
 *     two, a 24px step, because the title above them is one line on some cards
 *     and two on others and nothing reserves the second;
 *   - the rail's `scrollWidth` is 1844 against a `clientWidth` of 988 and
 *     there is no arrow, no fade and no "more" card — the last card is cut at
 *     the container's edge and nothing says the rail moves.
 *
 * WHAT THIS ASSERTS: the mechanism for each, in terms jsdom can establish —
 * a card width that is one fixed length rather than a percentage, a reserved
 * two-line title box, and arrow controls that exist, stay hidden while there
 * is nothing to scroll to, and MOVE the rail when pressed.
 *
 * WHAT IT CANNOT SEE: jsdom lays nothing out and scrolls nothing. "The prices
 * land on one baseline", "the photos are the same height" and "the arrow is
 * over the rail's trailing edge" are browser facts. The rail's overflow is
 * STUBBED here (jsdom reports 0 for every dimension), which is how the arrows
 * can be exercised at all.
 */
describe("the find-more rails are rails", () => {
  function stripOf(): HTMLElement {
    return document.querySelector(`.${RELATED_STRIP_CLASS}`) as HTMLElement;
  }

  /** jsdom measures nothing, so the rail is TOLD it overflows. */
  function overflowing(rail: HTMLElement, scrollWidth: number, clientWidth: number): void {
    Object.defineProperty(rail, "scrollWidth", { value: scrollWidth, configurable: true });
    Object.defineProperty(rail, "clientWidth", { value: clientWidth, configurable: true });
    fireEvent.scroll(rail);
  }

  it("gives every card ONE fixed width, not a share of the container", () => {
    const css = relatedStripCss();
    expect(RELATED_CARD_WIDTH).toBe(220);
    expect(css).toContain(`flex:0 0 ${String(RELATED_CARD_WIDTH)}px`);
    // A percentage is what made the same card four different widths, so the
    // CARD's own rule may not carry one. (The arrow's `border-radius: 50%`
    // elsewhere in the sheet is a circle, not a width.)
    const card = /\.stapel-listings-related>\*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(card).not.toBe("");
    expect(card).not.toContain("%");
  });

  it("reserves the title's second line so the prices share a baseline", () => {
    const css = relatedStripCss();
    // Two lines of the title's OWN line-height, reserved whether the title
    // fills them or not — the 24px step came from the cards where it does not.
    expect(css).toContain(`.${RELATED_STRIP_CLASS} .${TITLE_CLAMP_CLASS}{min-block-size:2lh}`);
  });

  it("draws arrows that say the rail moves, and moves it", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} similar={rows([11, 12, 13, 14])} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-similar")).toBeTruthy();
    });
    const back = screen.getByTestId("listings-detail-similar-back");
    const forward = screen.getByTestId("listings-detail-similar-forward");
    // Nothing has overflowed yet: a control that scrolls nowhere is worse
    // than no control.
    expect(back.hidden).toBe(true);
    expect(forward.hidden).toBe(true);

    const rail = stripOf();
    overflowing(rail, 1844, 988);
    await waitFor(() => {
      expect(forward.hidden).toBe(false);
    });
    // At the start edge there is nothing behind the reader.
    expect(back.hidden).toBe(true);

    fireEvent.click(forward);
    // One card and its gap — the rail lands ON a card rather than between two.
    expect(rail.scrollLeft).toBe(RELATED_CARD_WIDTH + RELATED_CARD_GAP);

    overflowing(rail, 1844, 988);
    await waitFor(() => {
      expect(back.hidden).toBe(false);
    });
    fireEvent.click(back);
    expect(rail.scrollLeft).toBe(0);
  });

  it("names its arrows with words a screen reader can use", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} similar={rows([11, 12])} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-similar")).toBeTruthy();
    });
    expect(screen.getByTestId("listings-detail-similar-forward").getAttribute("aria-label")).toBe(
      "Next"
    );
    expect(screen.getByTestId("listings-detail-similar-back").getAttribute("aria-label")).toBe(
      "Previous"
    );
  });
});
