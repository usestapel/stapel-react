/**
 * THE ENGAGEMENT AXIS, BUILT AGAINST A CONTRACT THAT IS LANDING AND NOT LIVE.
 *
 * `is_viewed` and `view_count` are siblings of `is_favorited` that the
 * backend is adding. Neither is in any response the fleet answers today and
 * neither is in the generated schema, which is emitted from the upstream
 * `docs/schema.json` and is not ours to edit.
 *
 * So the FIRST half of this file is the more important one: with the fields
 * absent — which is every deployment right now — nothing changes. No dimming,
 * no count, no console line, no extra node in the tree. A feature that is
 * silent until its contract arrives can ship today; one that logs a warning
 * about a release that has not happened cannot.
 *
 * The second half is what happens when they do arrive, so the day the server
 * starts sending them there is nothing left to write.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { readFileSync } from "node:fs";
import { render, screen, waitFor } from "@testing-library/react";
import {
  CARD_VIEWED_CLASS,
  LISTING_VIEWED_OPACITY,
  ListingCard,
  ListingDetailPane,
  ListingFeedCard,
  ListingSerpCard,
} from "../src/default/index.js";
import { cardTargetCss } from "../src/default/ListingCard.js";
import { isListingViewed, listingViewCount } from "../src/index.js";
import type { ListingCard as ListingCardData } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD, detail, statusInfo } from "./fixtures.js";

function member(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

/** All three card surfaces over one row — the dimming rule is shared, so it
 * is asserted on all of them or it is asserted on none. */
function allCards(listing: ListingCardData): ReactElement {
  return member(
    <>
      <ListingCard listing={listing} href="/l/7" />
      <ListingSerpCard listing={listing} href="/l/7" />
      <ListingFeedCard listing={listing} href="/l/7" />
    </>
  );
}

const CARD_IDS = [
  "listings-card",
  "listings-serp-card",
  "listings-feed-card",
] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the fields are ABSENT, and that is a total no-op", () => {
  it("dims nothing and marks nothing on any of the three cards", () => {
    // `CARD` is a real response body and carries neither field.
    expect("viewed" in CARD).toBe(false);
    expect("view_count" in CARD).toBe(false);

    render(allCards(CARD));

    for (const id of CARD_IDS) {
      const card = screen.getByTestId(id);
      expect(card.hasAttribute("data-listing-viewed"), id).toBe(false);
      expect(card.className.includes(CARD_VIEWED_CLASS), id).toBe(false);
    }
    expect(document.querySelector(`.${CARD_VIEWED_CLASS}`)).toBeNull();
  });

  it("says nothing to the console about a field that has not shipped", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(allCards(CARD));

    const said = [...error.mock.calls, ...warn.mock.calls]
      .flat()
      .map((entry) => String(entry))
      .join(" ");
    expect(said).not.toContain("viewed");
    expect(said).not.toContain("view_count");
  });

  it("prints no view count on the listing page", async () => {
    render(
      <TestProviders
        server={mockServer({
          "/listings/7/status/": { body: statusInfo() },
          "/listings/7/": { body: detail() },
        })}
      >
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    // No row, and above all no "0" standing in for an absence.
    expect(screen.queryByTestId("listings-detail-views")).toBeNull();
  });
});

describe("`null` is not `true` — an unasked row is not a seen one", () => {
  it.each([
    ["null", null],
    ["false", false],
  ] as const)("leaves the cards undimmed for viewed=%s", (_name, value) => {
    render(allCards({ ...CARD, viewed: value }));
    for (const id of CARD_IDS) {
      expect(screen.getByTestId(id).hasAttribute("data-listing-viewed"), id).toBe(
        false
      );
    }
  });

  it("reads the same way in the model", () => {
    expect(isListingViewed({ viewed: true })).toBe(true);
    expect(isListingViewed({ viewed: false })).toBe(false);
    expect(isListingViewed({ viewed: null })).toBe(false);
    expect(isListingViewed({})).toBe(false);
    expect(isListingViewed(undefined)).toBe(false);
  });
});

describe("an already-seen row is DIMMED, and legibly so in either theme", () => {
  it("marks every card surface", () => {
    render(allCards({ ...CARD, viewed: true }));
    for (const id of CARD_IDS) {
      const card = screen.getByTestId(id);
      expect(card.getAttribute("data-listing-viewed"), id).toBe("true");
      expect(card.className.includes(CARD_VIEWED_CLASS), id).toBe(true);
    }
  });

  it("dims with a real rule, not only an aria attribute", () => {
    const css = cardTargetCss();
    const rule = css
      .split("}")
      .map((chunk) => `${chunk}}`)
      .find((chunk) => chunk.includes(CARD_VIEWED_CLASS) && chunk.includes("opacity"));
    expect(rule).toBeTruthy();
    expect(rule).toContain(String(LISTING_VIEWED_OPACITY));
    // OPACITY and no colour: it composites against whatever ground the theme
    // painted, so one number is legible on a white page and on a black one.
    // A colour would have to be chosen twice and the second choice is the one
    // nobody photographs — and a hard-coded one could not be either.
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(rule).not.toMatch(/\brgba?\(/i);
    expect(rule).not.toMatch(/\bhsla?\(/i);
    // Overridable by a host without forking the sheet.
    expect(rule).toContain("var(--listing-viewed-opacity");
  });

  it("does not dim the heart with it — a faded control reads as a dead one", () => {
    render(member(<ListingCard listing={{ ...CARD, viewed: true }} href="/l/7" />));
    const heart = screen.getByTestId("listings-card-favorite");
    // The rule reaches the anchor and the photo, and the heart is outside
    // both — see CARD_VIEWED_CLASS.
    expect(screen.getByTestId("listings-card-open").contains(heart)).toBe(false);
  });
});

describe("the view count on the listing page", () => {
  async function pane(overrides: Parameters<typeof detail>[0]): Promise<void> {
    render(
      <TestProviders
        server={mockServer({
          "/listings/7/status/": { body: statusInfo() },
          "/listings/7/": { body: detail(overrides) },
        })}
      >
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
  }

  it("shows the number when the server sends one", async () => {
    await pane({ view_count: 1284 });
    expect(screen.getByTestId("listings-detail-views").textContent).toBe("1284");
  });

  it("reads on the page's meta line and NOT as a row of the specs table", async () => {
    await pane({ view_count: 1284 });
    // Where it spent a release: a `<Descriptions.Item>` between "Colour" and
    // "Where it is", two screens below the fold, read as a property of the
    // GOODS (walker D106). A view count is a fact about the page.
    const views = screen.getByTestId("listings-detail-views");
    expect(views.closest(".ant-descriptions")).toBeNull();
    // …and it sits with the title, above the price, where a reader looks for
    // how much company they have.
    const meta = screen.getByTestId("listings-detail-meta");
    expect(meta.contains(views)).toBe(true);
    const title = screen.getByTestId("listings-detail-title");
    expect(
      title.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const price = screen.getByTestId("listings-detail-price");
    expect(
      meta.compareDocumentPosition(price) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("shows a real zero — 'nobody yet' is a fact a seller can act on", async () => {
    await pane({ view_count: 0 });
    expect(screen.getByTestId("listings-detail-views").textContent).toBe("0");
  });

  it("shows nothing when the response carries no count", async () => {
    // `view_count` is a non-nullable integer on the contract, so the absence
    // this arm renders is a DEPLOYMENT one: a server older than 0.16 answers
    // a detail with no such key at all. The type admits that (see
    // `ListingEngagementFields`) and the page says nothing rather than
    // printing a zero nobody reported.
    await pane({});
    expect(screen.queryByTestId("listings-detail-views")).toBeNull();
  });

  it("reads the same way in the model", () => {
    expect(listingViewCount({ view_count: 12 })).toBe(12);
    expect(listingViewCount({ view_count: 0 })).toBe(0);
    expect(listingViewCount({})).toBeUndefined();
    expect(listingViewCount(undefined)).toBeUndefined();
    // Never "NaN views" on a seller's page. Unreachable from the wire — the
    // belt is for a host that computed the number itself.
    expect(listingViewCount({ view_count: Number.NaN })).toBeUndefined();
  });
});

describe("what the generated contract actually carries", () => {
  // Relative to the package root, as `pair.test.ts` reads its manifests.
  const schema = readFileSync("src/api/generated/schema.ts", "utf8");
  const types = readFileSync("src/api/types.ts", "utf8");

  it("has is_favorited and NO favourite count — which is why none is drawn", () => {
    expect(schema).toContain("is_favorited");
    // The gate for the count requirement: a card may not print a number the
    // wire never sent, and this turns red the day one lands, at which point
    // rendering it beside the heart is a deliberate change rather than an
    // invention.
    for (const spelling of [
      "favorite_count",
      "favorites_count",
      "favourite_count",
      "favourites_count",
      "favorited_count",
    ]) {
      expect(schema, spelling).not.toContain(spelling);
    }
  });

  /**
   * THIS TEST USED TO ASSERT THE OPPOSITE, AND THAT IS THE POINT.
   *
   * While the pair's contract pin sat at `>=0.12 <0.13` the emitted schema
   * could not see stapel-listings 0.16/0.17, so `ListingEngagementFields`,
   * `ListingEngagement` and `ListingEngagementBatch` were hand-written
   * mirrors of a contract that had already shipped. A duplicated wire type is
   * a second source of truth, and a second source of truth with no expiry is
   * one somebody discovers years later — so the expiry was a test asserting
   * the schema still LACKED the surface. The pin landed, that test went red,
   * and the mirrors were deleted.
   *
   * What replaces it is the durable claim: the pair's types are DERIVED from
   * the generated table rather than restated beside it. A future hand-written
   * `interface ListingEngagement` fails here.
   */
  it("is where the engagement types come from — no hand-written mirrors", () => {
    expect(schema).toContain("ListingEngagement");
    expect(schema).toContain("ListingEngagementBatch");
    expect(schema).toContain("/listings/api/v1/listings/engagement/");
    expect(schema).toContain("viewed");
    expect(schema).toContain("view_count");

    expect(types).toContain('Schemas["ListingEngagement"]');
    expect(types).toContain('Schemas["ListingEngagementBatch"]');
    // The field NAMES are picked off the generated row, so a rename upstream
    // is a compile error here rather than a grid that quietly stops dimming.
    expect(types).toContain('Pick<Schemas["ListingCard"], "viewed" | "view_count">');
    // And nothing restates them.
    expect(types).not.toMatch(/interface ListingEngagement\b/);
    expect(types).not.toMatch(/interface ListingEngagementBatch\b/);
  });

  /**
   * The one thing the generated types do NOT settle: a generated type is a
   * promise about the CONTRACT, and the bytes a given deployment sends may be
   * older. The engagement fields are required on `Schemas["ListingCard"]` and
   * optional on this pair's `ListingCard`, because the pair's most important
   * card source — the search index, through `renderCard` — cannot supply them
   * at all. That relaxation is deliberate and load-bearing; assert it, or the
   * next person "tightens" it and breaks every search-served grid.
   */
  it("keeps the engagement fields OPTIONAL on the row the cards take", () => {
    const searchRow: ListingCardData = { ...CARD };
    expect("viewed" in searchRow).toBe(false);
    expect(isListingViewed(searchRow)).toBe(false);
    expect(listingViewCount(searchRow)).toBeUndefined();
    expect(types).toContain("WithOptionalEngagement");
  });
});
