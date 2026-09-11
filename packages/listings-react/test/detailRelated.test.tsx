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
  RELATED_STRIP_CLASS,
  SPEC_FOLD_MIN_HIDDEN,
  relatedStripCss,
} from "../src/default/index.js";
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
