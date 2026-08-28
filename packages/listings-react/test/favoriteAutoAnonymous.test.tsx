/**
 * The heart that just works for somebody who never registered.
 *
 * The owner's ask, paraphrased: stop telling people to register before they
 * can look at listings, and mint the anonymous account automatically when
 * one is needed. Reading the catalogue was already open; what was still
 * walled was the first thing a reader wants to DO with it. So the wall on
 * saving a listing comes down — and comes down by minting an account nobody
 * was asked about, at the press, rather than by handing out a form.
 *
 * The three things pinned here are the three ways that goes wrong:
 *
 *  1. The heart is offered but the write leaves before the account exists,
 *     so the person's first act buys a 401.
 *  2. The mint happens for everyone who loads a page, not for the person who
 *     pressed something.
 *  3. Saving is unblocked and so is publishing — because whoever wrote it
 *     unblocked the mandate instead of the action.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ElevationSource } from "@stapel/core";
import { ListingCard } from "../src/default/index.js";
import {
  LISTINGS_ELEVATION_ACTIONS,
  useFavorites,
  useMandateGate,
} from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

/** A source that records mints and resolves them immediately. */
function autoAnonymous(
  actions: readonly string[] = [LISTINGS_ELEVATION_ACTIONS.favorite],
  identified = false
) {
  const elevate = vi.fn((): Promise<void> => Promise.resolve());
  return {
    source: {
      actions,
      elevate,
      hasIdentity: () => identified,
    } satisfies ElevationSource,
    elevate,
  };
}

describe("saving a listing with auto-anonymous wired", () => {
  it("offers the heart to an anonymous visitor instead of refusing", () => {
    const { source } = autoAnonymous();
    render(
      <TestProviders server={mockServer({})} mandate="anonymous" elevation={source}>
        <ListingCard listing={CARD} signIn={{ href: "/login" }} />
      </TestProviders>
    );
    const heart = screen.getByTestId("listings-card-favorite");
    expect(heart).toHaveProperty("disabled", false);
    // No reason, because there is nothing to refuse — and therefore no
    // "sign in to do this" sentence beside it either.
    expect(screen.queryByTestId("listings-card-favorite-blocked")).toBeNull();
  });

  it("does not mint on render — a crawler costs nothing", () => {
    const { source, elevate } = autoAnonymous();
    render(
      <TestProviders server={mockServer({})} mandate="anonymous" elevation={source}>
        <ListingCard listing={CARD} />
      </TestProviders>
    );
    expect(elevate).not.toHaveBeenCalled();
  });

  it("mints first, then saves — in that order", async () => {
    const order: string[] = [];
    const source: ElevationSource = {
      actions: [LISTINGS_ELEVATION_ACTIONS.favorite],
      elevate: () => {
        order.push("mint");
        return Promise.resolve();
      },
    };
    const server = mockServer({
      "/favorite/": () => {
        order.push("favorite");
        return { body: { favorited: true } };
      },
    });
    render(
      <TestProviders server={server} mandate="anonymous" elevation={source}>
        <ListingCard listing={CARD} />
      </TestProviders>
    );

    fireEvent.click(screen.getByTestId("listings-card-favorite"));

    await waitFor(() => expect(server.matching("/favorite/")).toHaveLength(1));
    // The order IS the feature. A save that overtakes its own account is a
    // 401 delivered to somebody who did everything right.
    expect(order).toEqual(["mint", "favorite"]);
  });

  it("abandons the save when the mint fails", async () => {
    const source: ElevationSource = {
      actions: [LISTINGS_ELEVATION_ACTIONS.favorite],
      elevate: () => Promise.reject(new Error("429")),
    };
    const server = mockServer({ "/favorite/": { body: { favorited: true } } });
    render(
      <TestProviders server={server} mandate="anonymous" elevation={source}>
        <ListingCard listing={CARD} />
      </TestProviders>
    );

    fireEvent.click(screen.getByTestId("listings-card-favorite"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(server.matching("/favorite/")).toHaveLength(0);
  });

  it("leaves the wall standing for an action the host did not list", () => {
    // The same visitor, the same session, a source that names only chat.
    const { source } = autoAnonymous(["chat.start_direct"]);
    render(
      <TestProviders server={mockServer({})} mandate="anonymous" elevation={source}>
        <ListingCard listing={CARD} signIn={{ href: "/login" }} />
      </TestProviders>
    );
    expect(screen.getByTestId("listings-card-favorite")).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByTestId("listings-card-favorite-blocked")).toBeTruthy();
  });

  it("unblocks the named action WITHOUT unblocking the unnamed ones", () => {
    const { source } = autoAnonymous();
    const { result } = renderHook(
      () => ({
        favorite: useMandateGate(LISTINGS_ELEVATION_ACTIONS.favorite),
        publish: useMandateGate(),
      }),
      {
        wrapper: ({ children }) => (
          <TestProviders
            server={mockServer({})}
            mandate="anonymous"
            elevation={source}
          >
            {children}
          </TestProviders>
        ),
      }
    );
    // One visitor, one session, two answers. This is the whole reason
    // elevation is per-action and does not touch the mandate: a seller who
    // cannot be reached again is not a seller, so the composer keeps its
    // wall no matter how many hearts the same person pressed.
    expect(result.current.favorite.available).toBe(true);
    expect(result.current.publish.available).toBe(false);
  });

  it("keeps the saved-listings page shut until the visitor has an account", () => {
    const stranger = autoAnonymous();
    const { result } = renderHook(() => useFavorites(), {
      wrapper: ({ children }) => (
        <TestProviders
          server={mockServer({})}
          mandate="anonymous"
          elevation={stranger.source}
        >
          {children}
        </TestProviders>
      ),
    });
    // Never elevated: there is nothing of theirs here, and rendering the page
    // would fire a read that answers 401. The page must not mint to display
    // itself — that is what `identified` is for.
    expect(result.current.gate.available).toBe(false);
    expect(stranger.elevate).not.toHaveBeenCalled();
  });

  it("opens the saved-listings page once the guest has one", () => {
    const guest = autoAnonymous([LISTINGS_ELEVATION_ACTIONS.favorite], true);
    const { result } = renderHook(() => useFavorites(), {
      wrapper: ({ children }) => (
        <TestProviders
          server={mockServer({ "/my/favorites/": { body: { items: [] } } })}
          mandate="anonymous"
          elevation={guest.source}
        >
          {children}
        </TestProviders>
      ),
    });
    // The other half of the bargain: an account that can save and cannot
    // re-read is worse than the refusal it replaced.
    expect(result.current.gate.available).toBe(true);
  });

  it("changes nothing with no elevation wired", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} signIn={{ href: "/login" }} />
      </TestProviders>
    );
    expect(screen.getByTestId("listings-card-favorite")).toHaveProperty(
      "disabled",
      true
    );
  });
});
