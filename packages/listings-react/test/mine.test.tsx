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
    expect(screen.getByTestId("listings-mine-draft-title")).toBeTruthy();
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

describe("row actions are gated by the server's own transition table", () => {
  it("switches off 'mark sold' for a draft and says why", async () => {
    const srv = mockServer(dashboard(myPage([myCard({ status: "draft" })])));
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-complete")).toBeTruthy();
    });
    // draft → sold is not in LISTING_TRANSITIONS, so the mirror blocks it —
    // and the 409 stays the verdict if the table ever moves.
    expect(
      screen.getByTestId("listings-mine-complete").hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen.getByTestId("listings-mine-archive").hasAttribute("disabled")
    ).toBe(false);
  });

  it("switches off delete for a listing that is on sale", async () => {
    const srv = mockServer(dashboard());
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-mine-delete").hasAttribute("disabled")
      ).toBe(true);
    });
  });

  it("renders the 409 as the named refusal it is", async () => {
    const srv = mockServer({
      ...dashboard(),
      "/listings/7/archive/": {
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
      expect(screen.getByTestId("listings-mine-archive")).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-mine-archive"));
    });
    await waitFor(() => {
      expect(srv.matching("/listings/7/archive/")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-action-error")).toBeTruthy();
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
      expect(screen.getByTestId("listings-favorites-blocked").textContent).toBe(
        "Sign in to do this"
      );
    });
    expect(srv.matching("/listings/my/favorites/")).toHaveLength(0);
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
