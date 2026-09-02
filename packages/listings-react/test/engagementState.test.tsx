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
    expect("is_viewed" in CARD).toBe(false);
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
    expect(said).not.toContain("is_viewed");
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
  ] as const)("leaves the cards undimmed for is_viewed=%s", (_name, value) => {
    render(allCards({ ...CARD, is_viewed: value }));
    for (const id of CARD_IDS) {
      expect(screen.getByTestId(id).hasAttribute("data-listing-viewed"), id).toBe(
        false
      );
    }
  });

  it("reads the same way in the model, under EITHER spelling", () => {
    for (const key of ["is_viewed", "viewed"] as const) {
      expect(isListingViewed({ [key]: true }), key).toBe(true);
      expect(isListingViewed({ [key]: false }), key).toBe(false);
      expect(isListingViewed({ [key]: null }), key).toBe(false);
    }
    expect(isListingViewed({})).toBe(false);
    expect(isListingViewed(undefined)).toBe(false);
  });

  /**
   * The seam this pair must not fall through. The contract note this work was
   * built against calls the flag `is_viewed`; stapel-listings' own emitted
   * schema calls it `viewed`. Neither has shipped, so the name is still open
   * — and a pair that read only one would render NOTHING for the other, with
   * no error and no log line, because an absent key is `undefined` and
   * `undefined` correctly means "do not dim". A defect with no symptom.
   */
  it("dims a card that arrives under the schema's own spelling", () => {
    render(allCards({ ...CARD, viewed: true }));
    for (const id of CARD_IDS) {
      expect(screen.getByTestId(id).getAttribute("data-listing-viewed"), id).toBe(
        "true"
      );
    }
  });
});

describe("an already-seen row is DIMMED, and legibly so in either theme", () => {
  it("marks every card surface", () => {
    render(allCards({ ...CARD, is_viewed: true }));
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
    render(member(<ListingCard listing={{ ...CARD, is_viewed: true }} href="/l/7" />));
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

  it("shows a real zero — 'nobody yet' is a fact a seller can act on", async () => {
    await pane({ view_count: 0 });
    expect(screen.getByTestId("listings-detail-views").textContent).toBe("0");
  });

  it("shows nothing for null", async () => {
    await pane({ view_count: null });
    expect(screen.queryByTestId("listings-detail-views")).toBeNull();
  });

  it("reads the same way in the model", () => {
    expect(listingViewCount({ view_count: 12 })).toBe(12);
    expect(listingViewCount({ view_count: 0 })).toBe(0);
    expect(listingViewCount({ view_count: null })).toBeUndefined();
    expect(listingViewCount({})).toBeUndefined();
    expect(listingViewCount(undefined)).toBeUndefined();
    // Never "NaN views" on a seller's page.
    expect(listingViewCount({ view_count: Number.NaN })).toBeUndefined();
  });
});

describe("what the generated contract actually carries", () => {
  // Relative to the package root, as `pair.test.ts` reads its manifests.
  const schema = readFileSync("src/api/generated/schema.ts", "utf8");

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

  it("does not carry the engagement fields yet — hence the local extension", () => {
    // When this goes red, the field has landed in the generated schema: keep
    // the spelling it actually arrived under, drop the other from
    // `ListingEngagementFields`, and delete the intersection once BOTH are
    // there.
    expect(schema).not.toContain("is_viewed");
    expect(schema).not.toContain("view_count");
  });
});
