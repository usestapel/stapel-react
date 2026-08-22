import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { MyListingsPane, FavoritesPane } from "../src/default/index.js";
import { MY_LISTINGS_SOURCE_MISSING } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD, COUNTERS, PAGE } from "./fixtures.js";

/**
 * The dashboard, the gap under it, and the row actions.
 */

describe("the gap is named, not rendered as an empty grid", () => {
  it("fails the rows with a stated reason when no source is wired", async () => {
    // stapel-listings 0.6.1 has no owner-scoped list endpoint. "We cannot
    // ask" and "you have no listings" are different sentences, and an empty
    // grid would be the second one.
    const srv = mockServer({ "/listings/my/counters/": { body: COUNTERS } });
    render(
      <TestProviders server={srv}>
        <MyListingsPane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-mine-source-missing")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-mine-empty")).toBeNull();
    expect(MY_LISTINGS_SOURCE_MISSING.status).toBe(0);
  });

  it("still shows the counters, because those ARE real", async () => {
    const srv = mockServer({ "/listings/my/counters/": { body: COUNTERS } });
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
    const srv = mockServer({ "/listings/my/counters/": { status: 503, body: {} } });
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

  it("lists the rows a host-supplied source returns", async () => {
    const srv = mockServer({ "/listings/my/counters/": { body: COUNTERS } });
    render(
      <TestProviders server={srv}>
        <MyListingsPane source={() => Promise.resolve(PAGE)} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-mine-row")).toHaveLength(1);
    });
    expect(screen.queryByTestId("listings-mine-source-missing")).toBeNull();
  });

  it("asks the source for the tab that is showing, and drops the cursor on a tab change", async () => {
    // An anchor belongs to ONE ordered candidate set: carried across a tab
    // change it either bounces or honestly returns page four of a different
    // list.
    const asked: { tab: string; anchor: string | undefined }[] = [];
    const srv = mockServer({ "/listings/my/counters/": { body: COUNTERS } });
    render(
      <TestProviders server={srv}>
        <MyListingsPane
          source={({ tab, page }) => {
            asked.push({ tab, anchor: page.anchor });
            return Promise.resolve({ ...PAGE, has_next: true, next_anchor: "a1" });
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
    const srv = mockServer({ "/listings/my/counters/": { body: COUNTERS } });
    render(
      <TestProviders server={srv}>
        <MyListingsPane
          source={() =>
            Promise.resolve({ ...PAGE, items: [{ ...CARD, status: "draft" }] })
          }
        />
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
    const srv = mockServer({ "/listings/my/counters/": { body: COUNTERS } });
    render(
      <TestProviders server={srv}>
        <MyListingsPane source={() => Promise.resolve(PAGE)} />
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
      "/listings/my/counters/": { body: COUNTERS },
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
        <MyListingsPane source={() => Promise.resolve(PAGE)} />
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
