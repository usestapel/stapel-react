import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { MyListingsPane, FavoritesPane } from "../src/default/index.js";
import {
  MY_LISTINGS_UNTABBED_STATUSES,
  myListingImages,
  myListingPrice,
  myListingTitle,
  showsDraft,
} from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { Handler } from "./harness.js";
import {
  COUNTERS,
  MY_PAGE,
  NO_BLOCKED,
  PAGE,
  myCard,
  myPage,
} from "./fixtures.js";

/**
 * The dashboard, the route under it, and the row actions.
 *
 * `GET my/listings/` answers TWO of this pane's questions off one path — the
 * showing tab's statuses, and `?status=blocked` for the takedowns that are in
 * no tab. Every handler below routes on the query for exactly that reason: a
 * mock that answered both with the same body would let a live listing render
 * as taken down and the test would pass against a lie.
 */

/** `?status=blocked` → *blocked*, anything else → *rows*. */
function myListingsHandler(
  rows: unknown,
  blocked: unknown = NO_BLOCKED
): Handler {
  return (call) => ({
    body: call.url.includes("status=blocked") ? blocked : rows,
  });
}

function dashboard(
  rows: unknown = MY_PAGE,
  blocked: unknown = NO_BLOCKED
): Record<string, Handler | { body: unknown }> {
  return {
    "/listings/my/counters/": { body: COUNTERS },
    "/listings/my/listings/": myListingsHandler(rows, blocked),
  };
}

describe("the owner's own rows come off the contract's own route", () => {
  it("asks my/listings for the showing tab's statuses and renders them", async () => {
    // stapel-listings 0.7.0. Before it there was no owner-scoped list at all
    // and this pane named the absence; `model/mineSource.ts` keeps that
    // history.
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-mine-row")).toHaveLength(1);
    });
    const asked = srv
      .matching("/listings/my/listings/")
      .map((call) => new URL(call.url).searchParams.get("status"));
    // The active tab is the SERVER's grouping, so the count beside it and the
    // rows under it describe the same set.
    expect(asked).toContain("published,pending");
  });

  it("checks for takedowns beside the tab, off the same route", async () => {
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-mine-row")).toHaveLength(1);
    });
    const asked = srv
      .matching("/listings/my/listings/")
      .map((call) => new URL(call.url).searchParams.get("status"));
    expect(asked).toContain("blocked");
    // `blocked` is in no tab, because `my/counters` counts it in none.
    expect(MY_LISTINGS_UNTABBED_STATUSES).toEqual(["blocked"]);
  });

  it("shows a takedown ABOVE the tabs, where it cannot be missed", async () => {
    const taken = myPage([
      myCard({ id: 9, status: "blocked", moderation_status: "rejected" }),
    ]);
    const srv = mockServer(dashboard(MY_PAGE, taken));
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-takedowns")).toBeTruthy();
    });
    expect(screen.getByTestId("listings-mine-takedowns").textContent).toContain("1");
  });

  it("says nothing at all when there are no takedowns", async () => {
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-mine-row")).toHaveLength(1);
    });
    expect(screen.queryByTestId("listings-mine-takedowns")).toBeNull();
  });

  it("distinguishes 'no takedowns' from 'we could not check'", async () => {
    // A failed check is not "none". Saying nothing would be the second
    // sentence told in place of the first.
    const srv = mockServer({
      "/listings/my/counters/": { body: COUNTERS },
      "/listings/my/listings/": (call) =>
        call.url.includes("status=blocked")
          ? { status: 503, body: {} }
          : { body: MY_PAGE },
    });
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-takedowns-failed")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-mine-takedowns")).toBeNull();
    // and the tab itself still renders
    expect(screen.getAllByTestId("listings-mine-row").length).toBeGreaterThan(0);
  });

  it("names WHICH emptiness an empty tab is", async () => {
    const srv = mockServer(dashboard(myPage([])));
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-empty")).toBeTruthy();
    });
    const empty = screen.getByTestId("listings-mine-empty");
    expect(empty.getAttribute("data-empty-tab")).toBe("active");
    expect(empty.textContent).toContain("live or awaiting review");

    await act(async () => {
      fireEvent.click(screen.getByText("Drafts"));
    });
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-mine-empty").getAttribute("data-empty-tab")
      ).toBe("drafts");
    });
    expect(screen.getByTestId("listings-mine-empty").textContent).toContain(
      "No drafts"
    );
  });

  it("shows a LIVE listing whose edit is under review, off the real second axis", async () => {
    // The one combination 0.5.0 made possible and `status` alone cannot
    // express. Before 0.7.0 the card had no `moderation_status` and the row
    // passed "approved" as a stand-in, so this sentence never appeared.
    const srv = mockServer(
      dashboard(myPage([myCard({ moderation_status: "pending" })]))
    );
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-mine-row")).toHaveLength(1);
    });
    const note = screen.getByTestId("listings-moderation-note");
    expect(note.getAttribute("data-listing-moderation")).toBe("pending");
    // The named boolean, not an inference a skin repeats: live to the public,
    // under review for its owner.
    expect(note.getAttribute("data-listing-live-under-review")).toBe("true");
  });

  it("renders a never-published draft off its twin, and marks it as one", async () => {
    const srv = mockServer(
      dashboard(
        myPage([
          myCard({
            id: 8,
            title: "",
            status: "draft",
            title_draft: "Makita HR2470",
            price_draft: "6900.00",
          }),
        ])
      )
    );
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-mine-row")).toHaveLength(1);
    });
    // Without the twin this row would be a blank line — the published fields
    // are empty until a publish promotes them.
    expect(document.body.textContent).toContain("Makita HR2470");
    // The lifecycle tag is the ONE place the row says "Draft" — the word used
    // to appear a second time beside the title, which is the same fact drawn
    // twice and the thing that split "Draf/t" across two lines at 390px.
    const tags = screen.getAllByTestId("listings-status-tag");
    expect(tags).toHaveLength(1);
    expect(tags[0]?.getAttribute("data-listing-status")).toBe("draft");
  });

  it("does not ask at all for a visitor, and says why", async () => {
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv} mandate="anonymous">
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-blocked")).toBeTruthy();
    });
    expect(srv.matching("/listings/my/listings/")).toHaveLength(0);
  });

  it("still shows the counters, because those ARE real", async () => {
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-count-drafts").textContent).toContain(
        "3"
      );
    });
    expect(srv.matching("/listings/my/counters/")).toHaveLength(1);
  });

  it("shows no badge at all for a count it could not fetch", async () => {
    // A count we could not fetch is not zero. `showZero` on a real 0 is
    // information; a 0 standing in for a failed read is a lie.
    const srv = mockServer({
      ...dashboard(),
      "/listings/my/counters/": { status: 503, body: {} },
    });
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-counters-failed")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-mine-count-active")).toBeNull();
  });

  it("lets a host-supplied source replace the route for the TAB rows", async () => {
    // The seam survives the endpoint that closed the gap: a deployment that
    // keeps its sellers' rows elsewhere hands one in. The takedown check is
    // deliberately NOT routed through it — it is a property of moderation,
    // not of wherever a host caches its rows.
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane
          source={() => Promise.resolve(myPage([myCard({ id: 77 })]))}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-mine-row")).toHaveLength(1);
    });
    expect(
      screen.getByTestId("listings-mine-row").getAttribute("data-listing-id")
    ).toBe("77");
    const asked = srv
      .matching("/listings/my/listings/")
      .map((call) => new URL(call.url).searchParams.get("status"));
    expect(asked).toEqual(["blocked"]);
  });

  it("asks the source for the tab that is showing, and drops the cursor on a tab change", async () => {
    // An anchor belongs to ONE ordered candidate set: carried across a tab
    // change it either bounces or honestly returns page four of a different
    // list.
    const asked: { tab: string; anchor: string | undefined }[] = [];
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane
          source={({ tab, page }) => {
            asked.push({ tab, anchor: page.anchor });
            return Promise.resolve(
              myPage([myCard()], { has_next: true, next_anchor: "a1" })
            );
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-mine-row").length).toBe(1);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-mine-next"));
    });
    await waitFor(() => {
      expect(asked.some((call) => call.anchor === "a1")).toBe(true);
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Drafts"));
    });
    await waitFor(() => {
      const last = asked[asked.length - 1];
      expect(last?.tab).toBe("drafts");
      expect(last?.anchor).toBeUndefined();
    });
  });
});

describe("the row draws the moves the SERVER offers, and only those", () => {
  /**
   * D182, the one-way door. Measured on a live stand: "Mark sold" moved a
   * listing to SOLD and into the Archive tab, where the row went on offering
   * the same four buttons — "Mark sold" on something already sold and
   * "Archive" on something already archived, both no-ops, and nothing at all
   * that would put it back on sale. A misclick cost the seller the listing:
   * 78 seconds and 26 clicks to enter it again.
   *
   * The moves are `available_transitions` (stapel-listings 0.20.0) — the
   * server reporting `OWNER_TRANSITIONS` for this row, and the same list
   * `POST {id}/transition/` validates against.
   */
  const rowMoves = (): readonly string[] =>
    [...document.querySelectorAll("[data-listing-move]")].map(
      (el) => el.getAttribute("data-listing-move") ?? ""
    );

  async function renderRow(card: Parameters<typeof myCard>[0]) {
    const srv = mockServer(dashboard(myPage([myCard(card)])));
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-row")).toBeTruthy();
    });
    return srv;
  }

  it("offers a SOLD listing the way back, and never the move it already made", async () => {
    await renderRow({
      status: "sold",
      available_transitions: ["published", "archived"],
    });
    expect(rowMoves()).toEqual(["published", "archived"]);
    // The two that used to be here and did nothing.
    expect(screen.queryByTestId("listings-mine-move-sold")).toBeNull();
    expect(screen.getByTestId("listings-mine-move-published")).toBeTruthy();
  });

  it("offers an ARCHIVED listing the way back, and not 'archive' again", async () => {
    await renderRow({
      status: "archived",
      available_transitions: ["draft"],
    });
    expect(rowMoves()).toEqual(["draft"]);
    expect(screen.queryByTestId("listings-mine-move-archived")).toBeNull();
  });

  it("never offers a DRAFT the move it cannot make", async () => {
    await renderRow({
      status: "draft",
      available_transitions: ["pending", "archived"],
    });
    // draft → sold is in neither table, and it is not drawn switched off with
    // an explanation: it is simply not a thing this row can do.
    expect(screen.queryByTestId("listings-mine-move-sold")).toBeNull();
    expect(rowMoves()).toEqual(["pending", "archived"]);
  });

  it("takes the card's own list over the mirror, edge for edge", async () => {
    // A deployment that narrows the seller's half further is describing its
    // own rule; a pair that re-derived the table would draw a button the
    // route then 409s on.
    await renderRow({
      status: "published",
      available_transitions: ["archived"],
    });
    expect(rowMoves()).toEqual(["archived"]);
  });

  it("falls back to the mirror for a row that carries no list", async () => {
    // A row read before stapel-listings 0.20.0. Offering nothing would be the
    // one-way door again, this time by omission.
    const card = myCard({ status: "sold" }) as Record<string, unknown>;
    delete card["available_transitions"];
    const srv = mockServer(dashboard(myPage([card as never])));
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-move-published")).toBeTruthy();
    });
    expect(rowMoves()).toEqual(["published", "archived"]);
  });

  it("sends the move through the ONE route, naming where it goes", async () => {
    const srv = await renderRow({
      status: "sold",
      available_transitions: ["published", "archived"],
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-mine-move-published"));
    });
    await waitFor(() => {
      expect(srv.matching("/listings/7/transition/")).toHaveLength(1);
    });
    expect(srv.matching("/listings/7/transition/")[0]?.body).toEqual({
      to: "published",
    });
  });

  it("renders the 409 as the named refusal it is", async () => {
    const srv = mockServer({
      ...dashboard(myPage([myCard({ status: "sold", available_transitions: ["published", "archived"] })])),
      "/listings/7/transition/": {
        status: 409,
        body: {
          localizable_error: "error.409.invalid_listing_transition",
          error: "Invalid status transition for sold",
          params: { from_status: "sold" },
        },
      },
    });
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-move-published")).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-mine-move-published"));
    });
    await waitFor(() => {
      expect(srv.matching("/listings/7/transition/")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-action-error")).toBeTruthy();
    });
  });
});

describe("a seller can open their own listing", () => {
  /**
   * D183. Measured on a live cabinet: `a[href^="/l/"]` — ZERO. The title was
   * bold text and the thumbnail was a picture, so the one move a person makes
   * straight after publishing ("did that come out right?") could only be made
   * by typing a URL.
   */
  const listingHref = (id: number): string => `/l/${String(id)}`;

  it("links the title and the thumbnail at the listing's own page", async () => {
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane listingHref={listingHref} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-open")).toBeTruthy();
    });
    expect(screen.getByTestId("listings-mine-open").getAttribute("href")).toBe(
      "/l/7"
    );
    expect(screen.getByTestId("listings-mine-thumb-link").getAttribute("href")).toBe(
      "/l/7"
    );
  });

  it("leaves a never-published draft unlinked", async () => {
    // `title`/`price`/`images` are the PUBLISHED fields, so a draft's public
    // page is a blank one. A link to nothing is worse than no link, and the
    // predicate is the SERVER's own — DRAFT and NOT_SUBMITTED, the pair the
    // 0.20.0 migration used to mean "nobody ever pressed publish".
    const srv = mockServer(
      dashboard(
        myPage([
          myCard({
            status: "draft",
            moderation_status: "not_submitted",
            title: "",
            title_draft: "Half-written",
            available_transitions: ["pending", "archived"],
          }),
        ])
      )
    );
    render(
      <TestProviders server={srv}>
        <MyListingsPane listingHref={listingHref} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-row")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-mine-open")).toBeNull();
  });

  it("links a draft that HAS been published before", async () => {
    // Restored from the archive, or taken down for an edit: its public half
    // exists and its owner may read it. Withholding the link here was the
    // shape the first cut of this rule had — it asked which half of the twin
    // the row was SHOWING, which is a different question.
    const srv = mockServer(
      dashboard(
        myPage([
          myCard({
            status: "draft",
            moderation_status: "approved",
            available_transitions: ["pending", "archived"],
          }),
        ])
      )
    );
    render(
      <TestProviders server={srv}>
        <MyListingsPane listingHref={listingHref} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-open")).toBeTruthy();
    });
  });

  it("hands listingHref the row itself, title included, as a second argument", async () => {
    // The storefront ask: a host that addresses listings as
    // `/l/<id>-<title-slug>` cannot build the slug from an id alone.
    const seen: Array<{ id: number; title: string }> = [];
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane
          listingHref={(id, row) => {
            seen.push({ id, title: row.title });
            return `/l/${String(id)}`;
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-open")).toBeTruthy();
    });
    expect(seen).toContainEqual({ id: 7, title: "Bosch GSB 1200" });
  });

  it("draws no link at all when the host has no listing page", async () => {
    // ABSENT IS A REAL ANSWER — a deployment whose listings have no public
    // page has nothing to link to. What it must not be is this file's
    // decision for everybody, which is what it was.
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-title")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-mine-open")).toBeNull();
  });
});

describe("row actions are gated by the server's own transition table", () => {
  it("switches off delete for a listing that is on sale", async () => {
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-mine-delete").getAttribute("aria-disabled")
      ).toBe("true");
    });
  });
});

describe("favourites", () => {
  it("tells 'nothing saved yet' apart from 'we could not load'", async () => {
    const empty = mockServer({
      "/listings/my/favorites/": {
        body: { items: [], has_next: false, has_prev: false, count: 0 },
      },
    });
    const { unmount } = render(
      <TestProviders server={empty}>
        <FavoritesPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-favorites-empty")).toBeTruthy();
    });
    unmount();

    const broken = mockServer({
      "/listings/my/favorites/": { status: 503, body: {} },
    });
    render(
      <TestProviders server={broken}>
        <FavoritesPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-favorites-error")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-favorites-empty")).toBeNull();
  });

  it("does not ask at all for a visitor, and says why", async () => {
    const srv = mockServer({ "/listings/my/favorites/": { body: PAGE } });
    render(
      <TestProviders server={srv} mandate="anonymous">
        <FavoritesPane />
      </TestProviders>
    );
    await waitFor(() => {
      // ONE state: the reason, the hint, and the door — not a notice with a
      // spinner turning underneath it.
      expect(
        screen.getByTestId("listings-favorites-blocked").textContent
      ).toContain("Sign in to do this");
    });
    expect(srv.matching("/listings/my/favorites/")).toHaveLength(0);
  });

  it("hands hrefFor the row itself, title included, as a second argument", async () => {
    const seen: Array<{ id: number; title: string }> = [];
    const srv = mockServer({ "/listings/my/favorites/": { body: PAGE } });
    render(
      <TestProviders server={srv} resolveImage>
        <FavoritesPane
          hrefFor={(id, row) => {
            seen.push({ id, title: row.title });
            return `/l/${String(id)}`;
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-card")).toHaveLength(1);
    });
    expect(seen).toContainEqual({ id: 7, title: "Bosch GSB 1200" });
  });

  it("renders the saved cards through the same card the search slot gets", async () => {
    const srv = mockServer({ "/listings/my/favorites/": { body: PAGE } });
    render(
      <TestProviders server={srv} resolveImage>
        <FavoritesPane hrefFor={(id) => `/l/${String(id)}`} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-card")).toHaveLength(1);
    });
    // The badge came out of the stored projection — no category read.
    expect(srv.calls.every((call) => !call.url.includes("categories"))).toBe(true);
    expect(document.body.textContent).toContain("1200");
  });
});

describe("what an owner's row says, when half its fields are still a draft", () => {
  // The rule, in one place: the published value when there is one, the draft
  // otherwise. NOT "always the draft" — a live listing being edited has to go
  // on reading as what strangers currently see.
  it("prefers the published half", () => {
    const row = myCard({ title: "Live", title_draft: "Being written" });
    expect(myListingTitle(row)).toBe("Live");
    expect(showsDraft(row)).toBe(false);
  });

  it("falls back to the twin when the published half is the model's empty string", () => {
    const row = myCard({ title: "", price: "", title_draft: "Draft", price_draft: "10.00" });
    expect(myListingTitle(row)).toBe("Draft");
    expect(myListingPrice(row)).toBe("10.00");
    expect(showsDraft(row)).toBe(true);
  });

  it("returns undefined rather than inventing a heading", () => {
    expect(myListingTitle(myCard({ title: "", title_draft: "" }))).toBeUndefined();
  });

  it("takes images from whichever half has them", () => {
    expect(myListingImages(myCard({ images: [], images_draft: ["x/1"] }))).toEqual([
      "x/1",
    ]);
    expect(myListingImages(myCard({ images: ["y/2"], images_draft: ["x/1"] }))).toEqual(
      ["y/2"]
    );
    expect(myListingImages(myCard({ images: null, images_draft: null }))).toEqual([]);
  });
});
