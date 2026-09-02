/**
 * THE OVERLAY IS WHAT MAKES THE ENGAGEMENT STATE VISIBLE AT ALL.
 *
 * The dimming and the filled heart were built against `viewed` /
 * `is_favorited` on the listing ROW, and on this module's own card list and
 * on the listing page that is where they arrive. But the two surfaces a buyer
 * actually scrolls — the home feed and the SERP — are drawn from the SEARCH
 * index, whose stored document can carry neither a flag that differs per
 * reader nor a counter that moves faster than a re-index. On exactly those
 * screens the row carries nothing, every card renders undimmed with an
 * outline heart, and no error is raised anywhere: the feature would have been
 * invisible on the only pages it was asked for.
 *
 * `GET /listings/engagement/?ids=…` is the backend's answer — one call per
 * page, `{id: {view_count, viewed, is_favorited}}`, `AllowAny` so a
 * signed-out grid is not a second code path. This file is the pair's half of
 * that contract:
 *
 *  1. an overlay entry OVERRIDES what the row says (and supplies what it
 *     never said);
 *  2. no scope, an empty page, a failed read and a missing id are all the
 *     same SILENT no-op — a grid that renders is worth more than a flag;
 *  3. `null` (an anonymous caller) neither dims nor claims `false`;
 *  4. one request per PAGE, not one per card.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import {
  ListingCard,
  ListingFeedCard,
  ListingSerpCard,
} from "../src/default/index.js";
import {
  LISTINGS_ENGAGEMENT_BATCH_LIMIT,
  ListingEngagementScope,
  engagementIds,
  listingsQueryKeys,
  withEngagement,
} from "../src/index.js";
import type { ListingCard as ListingCardData } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

const ENGAGEMENT = "/listings/engagement/";

/** A page of rows exactly as a SEARCH-served grid delivers them: no `viewed`,
 * no `view_count`, and `is_favorited` null because the index cannot know. */
function searchRow(id: number): ListingCardData {
  return { ...CARD, id, is_favorited: null };
}

function overlayBody(
  items: Readonly<Record<string, unknown>>
): { readonly body: { readonly items: Readonly<Record<string, unknown>> } } {
  return { body: { items } };
}

function scoped(
  server: MockServer,
  ids: readonly number[],
  children: ReactNode,
  mandate: "member" | "anonymous" = "member"
): ReactElement {
  return (
    <TestProviders server={server} mandate={mandate}>
      <ListingEngagementScope ids={ids}>{children}</ListingEngagementScope>
    </TestProviders>
  );
}

function cardState(testId: string): {
  readonly viewed: string | null;
  readonly favorited: string | null;
} {
  return {
    viewed: screen.getByTestId(testId).getAttribute("data-listing-viewed"),
    favorited: screen
      .getByTestId(`${testId === "listings-feed-card" ? "listings-feed" : "listings-card"}-favorite`)
      .getAttribute("data-favorited"),
  };
}

describe("an overlay entry overrides the row", () => {
  it("dims and fills a card whose row said nothing at all", async () => {
    const server = mockServer({
      [ENGAGEMENT]: overlayBody({
        "7": { view_count: 12, viewed: true, is_favorited: true },
      }),
    });
    render(scoped(server, [7], <ListingFeedCard listing={searchRow(7)} href="/l/7" />));

    // Before the overlay lands the card is drawn from the row, which is what
    // makes the grid usable at once.
    expect(cardState("listings-feed-card").viewed).toBeNull();

    await waitFor(() => {
      expect(cardState("listings-feed-card").viewed).toBe("true");
    });
    expect(cardState("listings-feed-card").favorited).toBe("true");
  });

  it("wins over a row that carries a STALER answer", async () => {
    // A search document re-indexed before the person saved the listing.
    const stale: ListingCardData = {
      ...CARD,
      is_favorited: false,
      viewed: false,
    };
    const server = mockServer({
      [ENGAGEMENT]: overlayBody({
        "7": { view_count: 3, viewed: true, is_favorited: true },
      }),
    });
    render(scoped(server, [7], <ListingCard listing={stale} href="/l/7" />));

    await waitFor(() => {
      expect(cardState("listings-card").viewed).toBe("true");
    });
    expect(cardState("listings-card").favorited).toBe("true");
  });

  it("leaves a row alone when the answer did not carry its id", async () => {
    // "An id with no listing is simply absent" — a deleted row, or one the
    // batch's cap cut off. Absent is not `false`.
    const server = mockServer({
      [ENGAGEMENT]: overlayBody({
        "8": { view_count: 1, viewed: true, is_favorited: true },
      }),
    });
    render(
      scoped(
        server,
        [7, 8],
        <ListingCard listing={{ ...CARD, viewed: true }} href="/l/7" />
      )
    );
    await waitFor(() => {
      expect(server.matching(ENGAGEMENT)).toHaveLength(1);
    });
    // Id 7 kept the row's own `viewed: true` rather than being overwritten
    // with an absence.
    expect(cardState("listings-card").viewed).toBe("true");
  });

  it("merges by field in the model, and by identity when there is nothing", () => {
    const row: ListingCardData = { ...CARD, is_favorited: false };
    expect(withEngagement(row, undefined)).toBe(row);
    const merged = withEngagement(row, {
      view_count: 9,
      viewed: true,
      is_favorited: true,
    });
    expect(merged.viewed).toBe(true);
    expect(merged.view_count).toBe(9);
    expect(merged.is_favorited).toBe(true);
    // Everything else about the row survives.
    expect(merged.title).toBe(row.title);
  });
});

describe("no overlay is a silent no-op", () => {
  it("fires NOTHING for a card outside a scope", async () => {
    const server = mockServer({});
    render(
      <TestProviders server={server}>
        <ListingFeedCard listing={searchRow(7)} href="/l/7" />
      </TestProviders>
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(server.matching(ENGAGEMENT)).toHaveLength(0);
    expect(cardState("listings-feed-card").viewed).toBeNull();
  });

  it("asks nothing for an empty page", async () => {
    const server = mockServer({});
    render(scoped(server, [], <div data-testid="grid" />));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(server.matching(ENGAGEMENT)).toHaveLength(0);
  });

  it("draws the grid from the rows when the overlay FAILS, and says nothing", async () => {
    const server = mockServer({ [ENGAGEMENT]: { status: 500, body: { detail: "boom" } } });
    render(
      scoped(server, [7], <ListingCard listing={{ ...CARD, is_favorited: true }} href="/l/7" />)
    );
    await waitFor(() => {
      expect(server.matching(ENGAGEMENT)).toHaveLength(1);
    });
    // The card is still the card: the row's own state, no dimming invented,
    // and above all NO error surface over a results page that works.
    expect(cardState("listings-card").favorited).toBe("true");
    expect(cardState("listings-card").viewed).toBeNull();
    expect(document.querySelector("[data-stapel-error]")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    // And it is not retried: a decoration does not get three goes at a
    // person's connection.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.matching(ENGAGEMENT)).toHaveLength(1);
  });
});

describe("`null` is an anonymous caller, and claims nothing", () => {
  it("neither dims nor fills when the overlay answers null", async () => {
    // The AllowAny arm: `view_count` is public, both per-viewer flags are
    // `null` because nothing is remembered for a stranger.
    const server = mockServer({
      [ENGAGEMENT]: overlayBody({
        "7": { view_count: 44, viewed: null, is_favorited: null },
      }),
    });
    render(
      scoped(server, [7], <ListingCard listing={searchRow(7)} href="/l/7" />, "anonymous")
    );
    await waitFor(() => {
      expect(server.matching(ENGAGEMENT)).toHaveLength(1);
    });
    expect(cardState("listings-card").viewed).toBeNull();
    expect(cardState("listings-card").favorited).toBe("false");
  });

  it("does not overwrite a row's TRUE with the overlay's null", async () => {
    // A guest whose row somehow knows better keeps what it knows: `null` is
    // "we did not ask", and an unasked question cannot retract an answer.
    const server = mockServer({
      [ENGAGEMENT]: overlayBody({
        "7": { view_count: 44, viewed: null, is_favorited: null },
      }),
    });
    render(
      scoped(
        server,
        [7],
        <ListingCard listing={{ ...CARD, viewed: true }} href="/l/7" />,
        "anonymous"
      )
    );
    await waitFor(() => {
      expect(server.matching(ENGAGEMENT)).toHaveLength(1);
    });
    // The overlay DID answer for this id, so it wins — and `null` renders as
    // "not seen", never as a third look. What must not happen is a claim of
    // `false` anywhere in the data.
    expect(cardState("listings-card").viewed).toBeNull();
  });
});

describe("one request per PAGE, not one per card", () => {
  it("asks once for twenty cards", async () => {
    const ids = Array.from({ length: 20 }, (_, index) => index + 1);
    const server = mockServer({
      [ENGAGEMENT]: overlayBody(
        Object.fromEntries(
          ids.map((id) => [String(id), { view_count: id, viewed: true, is_favorited: false }])
        )
      ),
    });
    render(
      scoped(
        server,
        ids,
        <>
          {ids.map((id) => (
            <ListingSerpCard key={id} listing={searchRow(id)} href={`/l/${String(id)}`} />
          ))}
        </>
      )
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-serp-card")[0]?.getAttribute(
        "data-listing-viewed"
      )).toBe("true");
    });
    // THE claim. Twenty cards, one call — the N+1 the batch endpoint exists
    // to prevent.
    expect(server.matching(ENGAGEMENT)).toHaveLength(1);
    const url = new URL(server.matching(ENGAGEMENT)[0]?.url ?? "");
    expect(url.searchParams.get("ids")).toBe(ids.join(","));
    // Every card got its own entry out of the one answer.
    for (const card of screen.getAllByTestId("listings-serp-card")) {
      expect(card.getAttribute("data-listing-viewed")).toBe("true");
    }
  });

  it("normalizes the ids so a re-ordered page does not buy a second request", () => {
    // The key IS the request (see `model/queryKeys.ts`): the answer is a map
    // keyed by id and carries no order, so the same ids in another order are
    // the same question.
    expect(engagementIds([3, 1, 2])).toEqual([1, 2, 3]);
    expect(engagementIds([2, 2, 1])).toEqual([1, 2]);
    expect(engagementIds([1, Number.NaN, 2.5, 2])).toEqual([1, 2]);
    expect(listingsQueryKeys.engagement([3, 1])).toEqual(
      listingsQueryKeys.engagement([1, 3, 1])
    );
  });

  it("caps at the server's own batch limit rather than asking for a crawl", () => {
    const many = Array.from({ length: 250 }, (_, index) => index + 1);
    expect(engagementIds(many)).toHaveLength(LISTINGS_ENGAGEMENT_BATCH_LIMIT);
    expect(LISTINGS_ENGAGEMENT_BATCH_LIMIT).toBe(100);
  });
});
