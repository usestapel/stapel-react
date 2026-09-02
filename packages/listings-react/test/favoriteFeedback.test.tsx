/**
 * THE HEART GIVES FEEDBACK — measured on a live deployment as the defect that
 * it does not.
 *
 * A signed-in person taps the heart on a card or on the listing page and
 * nothing on screen moves. The write goes out and the invalidation lands, but
 * the row every card draws from is a PROP owned by a list query one or two
 * components up, so until that query has refetched and re-rendered the grid,
 * the icon is still showing the state from before the tap. On a phone that is
 * a second or more of a control that looks broken.
 *
 * Four claims here, and each is one half of a bug that shipped:
 *
 *  1. the icon flips ON THE GESTURE, before the request has settled;
 *  2. it ROLLS BACK when the request fails, and the failure is stated —
 *     a heart left filled over a save that never happened is a lie, and a
 *     silent rollback is a mystery;
 *  3. `is_favorited: null` draws the SAME outline as `false` and never a
 *     third look, while staying tellable apart underneath — `null` is "nobody
 *     asked on this person's behalf", not "not saved";
 *  4. saved is a FILLED accent shape and unsaved is an outline, on the cards
 *     and on the detail page alike, so the state is readable at a glance and
 *     not only through `aria-pressed`.
 *
 * The optimistic assertions deliberately take NO await between the click and
 * the check. A `fetch` cannot settle synchronously, so a heart that has
 * already moved at that point has moved on the gesture and on nothing else —
 * which is the whole claim, and an awaited assertion would prove only that
 * the invalidation eventually arrived.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { ListingCard, ListingDetailPane } from "../src/default/index.js";
import { useFavoriteToggle } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { CARD, detail, statusInfo } from "./fixtures.js";

/** The saved/unsaved state a person actually reads off the control. */
function heartState(testId: string): {
  readonly favorited: string | null;
  readonly pressed: string | null;
  /** `"none"` is the outline; anything else is the filled accent shape. */
  readonly fill: string | null;
} {
  const heart = screen.getByTestId(testId);
  return {
    favorited: heart.getAttribute("data-favorited"),
    pressed: heart.getAttribute("aria-pressed"),
    fill: heart.querySelector("svg")?.getAttribute("fill") ?? null,
  };
}

describe("the card heart flips on the gesture", () => {
  it("draws SAVED before the request has settled, and keeps it when it lands", async () => {
    const server = mockServer({
      "/listings/7/favorite/": { body: { favorited: true, listing_id: 7 } },
    });
    render(
      <TestProviders server={server}>
        <ListingCard listing={CARD} href="/l/7" />
      </TestProviders>
    );
    expect(heartState("listings-card-favorite").favorited).toBe("false");

    fireEvent.click(screen.getByTestId("listings-card-favorite"));

    // THE claim: the icon has already moved, and nothing has come back yet.
    const during = heartState("listings-card-favorite");
    expect(during.favorited).toBe("true");
    expect(during.pressed).toBe("true");
    expect(during.fill).not.toBe("none");
    // Sharper than "before it settled": at this point the request has not
    // even been DISPATCHED — react-query queues the mutation a tick after the
    // handler returns. The icon moved on the gesture and on nothing else.
    expect(server.matching("/listings/7/favorite/")).toHaveLength(0);

    // The server agreed, so the prediction simply stands — no second flip.
    await waitFor(() => {
      expect(server.matching("/listings/7/favorite/")).toHaveLength(1);
    });
    expect(heartState("listings-card-favorite").favorited).toBe("true");
    expect(screen.queryByTestId("listings-card-favorite-error")).toBeNull();
  });

  it("ROLLS BACK and states the failure when the save fails", async () => {
    const server = mockServer({
      "/listings/7/favorite/": { status: 500, body: { detail: "boom" } },
    });
    render(
      <TestProviders server={server}>
        <ListingCard listing={CARD} href="/l/7" />
      </TestProviders>
    );

    fireEvent.click(screen.getByTestId("listings-card-favorite"));
    expect(heartState("listings-card-favorite").favorited).toBe("true");

    await waitFor(() => {
      expect(heartState("listings-card-favorite").favorited).toBe("false");
    });
    // The outline is back AND the person is told why — a silent rollback is
    // a control that flickered for no stated reason.
    expect(heartState("listings-card-favorite").fill).toBe("none");
    expect(heartState("listings-card-favorite").pressed).toBe("false");
    expect(screen.getByTestId("listings-card-favorite-error")).toBeTruthy();
  });

  it("un-favourites the same way, from a row that says it is saved", async () => {
    const server = mockServer({
      "/listings/7/unfavorite/": { body: { favorited: false, listing_id: 7 } },
    });
    render(
      <TestProviders server={server}>
        <ListingCard listing={{ ...CARD, is_favorited: true }} href="/l/7" />
      </TestProviders>
    );
    expect(heartState("listings-card-favorite").fill).not.toBe("none");

    fireEvent.click(screen.getByTestId("listings-card-favorite"));

    expect(heartState("listings-card-favorite").favorited).toBe("false");
    expect(heartState("listings-card-favorite").fill).toBe("none");
    await waitFor(() => {
      expect(server.matching("/listings/7/unfavorite/")).toHaveLength(1);
    });
    // The endpoint the STATE implies, not a second favourite.
    expect(server.matching("/listings/7/favorite/")).toHaveLength(0);
  });
});

describe("`is_favorited: null` is not `false`, and does not look like a third thing", () => {
  it("draws the same outline heart as an unsaved row", () => {
    const server = mockServer({});
    const { rerender } = render(
      <TestProviders server={server}>
        <ListingCard listing={{ ...CARD, is_favorited: null }} href="/l/7" />
      </TestProviders>
    );
    const nulled = heartState("listings-card-favorite");

    rerender(
      <TestProviders server={server}>
        <ListingCard listing={{ ...CARD, is_favorited: false }} href="/l/7" />
      </TestProviders>
    );
    const falsed = heartState("listings-card-favorite");

    // Identical on screen. A "we did not ask" heart that looked different
    // would be a state with no name and no action attached to it.
    expect(nulled).toEqual(falsed);
    expect(nulled.fill).toBe("none");
    expect(nulled.pressed).toBe("false");
  });

  it("still tells the two apart underneath — `known` is the seam", () => {
    const server = mockServer({});
    function Wrapper(props: { children: ReactNode }): ReactElement {
      return <TestProviders server={server}>{props.children}</TestProviders>;
    }

    const asNull = renderHook(() => useFavoriteToggle(7, null), {
      wrapper: Wrapper,
    });
    const asFalse = renderHook(() => useFavoriteToggle(7, false), {
      wrapper: Wrapper,
    });
    const asTrue = renderHook(() => useFavoriteToggle(7, true), {
      wrapper: Wrapper,
    });

    // Both draw the outline...
    expect(asNull.result.current.favorited).toBe(false);
    expect(asFalse.result.current.favorited).toBe(false);
    // ...and only one of them is the row speaking authoritatively.
    expect(asNull.result.current.known).toBe(false);
    expect(asFalse.result.current.known).toBe(true);
    expect(asTrue.result.current.known).toBe(true);
    expect(asTrue.result.current.favorited).toBe(true);
  });
});

describe("the detail page's heart, same contract", () => {
  function pane(overrides: Parameters<typeof detail>[0] = {}): MockServer {
    const server = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/favorite/": { body: { favorited: true, listing_id: 7 } },
      "/listings/7/": { body: detail(overrides) },
    });
    render(
      <TestProviders server={server}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    return server;
  }

  it("flips on the gesture rather than waiting for the refetch", async () => {
    pane({ is_favorited: false });
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    expect(heartState("listings-detail-favorite").favorited).toBe("false");

    fireEvent.click(screen.getByTestId("listings-detail-favorite"));

    const during = heartState("listings-detail-favorite");
    expect(during.favorited).toBe("true");
    expect(during.pressed).toBe("true");
    expect(during.fill).not.toBe("none");
  });

  it("rolls back and states the failure", async () => {
    const server = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/favorite/": { status: 500, body: { detail: "boom" } },
      "/listings/7/": { body: detail({ is_favorited: false }) },
    });
    render(
      <TestProviders server={server}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("listings-detail-favorite"));
    expect(heartState("listings-detail-favorite").favorited).toBe("true");

    await waitFor(() => {
      expect(heartState("listings-detail-favorite").favorited).toBe("false");
    });
    expect(screen.getByTestId("listings-detail-favorite-error")).toBeTruthy();
  });

  it("renders `null` as the outline, never as a look of its own", async () => {
    pane({ is_favorited: null });
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    const state = heartState("listings-detail-favorite");
    expect(state.favorited).toBe("false");
    expect(state.fill).toBe("none");
  });
});

describe("the favourite COUNT is not invented", () => {
  it("draws no number, because the contract carries none", () => {
    render(
      <TestProviders server={mockServer({})}>
        <ListingCard listing={CARD} href="/l/7" />
      </TestProviders>
    );
    // `ListingCard`/`ListingDetail` carry `is_favorited` and no counterpart
    // count — asserted against the generated schema itself in
    // `engagementState.test.tsx`, which is what turns this red the day one
    // lands. A placeholder beside the heart would be a number about someone
    // else's listing that nothing in the system ever said.
    expect(screen.queryByTestId("listings-card-favorite-count")).toBeNull();
  });
});
