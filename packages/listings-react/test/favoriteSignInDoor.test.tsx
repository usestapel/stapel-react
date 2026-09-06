/**
 * The heart a visitor can see, the reason they can READ, and the door beside
 * it — storefront Wave D, named gap G-3.
 *
 * Two halves of one defect. The reason lived only in a `title` tooltip on a
 * disabled antd button, and a disabled button receives no pointer events in
 * any browser — core's own `actionGate.ts` says in as many words that a
 * tooltip there is "a reason nobody can read". And even read, the sentence
 * dead-ended: no pair took a sign-in href, so the storefront put its own
 * notice a screen away from the control it was about.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ListingCard } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

describe("a visitor's favourite control", () => {
  it("is visible, blocked, and says why in words — with the way in", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} signIn={{ href: "/login?next=/l/7" }} />
      </TestProviders>
    );

    // Never hidden (private-space canon §6.3): the heart is there, because a
    // control that disappears teaches nobody it exists. And where the host
    // hands in a DOOR it is not "switched off" either (D431): the press goes
    // through the door, `?next=` and all, so announcing it unavailable would
    // be a lie to exactly the people who depend on the announcement. This
    // card used to draw its own heart and never got that ruling — a visitor's
    // press on the desktop grid reached a no-op toggle and went nowhere while
    // the same press on a SERP row opened the door.
    const heart = screen.getByTestId("listings-card-favorite");
    expect(heart.getAttribute("aria-disabled")).not.toBe("true");
    // The door is a navigation, so the control is an anchor: the `next`, the
    // middle click and a person without our JavaScript all keep working.
    expect(heart.tagName.toLowerCase()).toBe("a");
    expect(heart.getAttribute("href")).toBe("/login?next=/l/7");
    expect(heart.hasAttribute("aria-pressed")).toBe(false);

    // The reason as TEXT, not as a tooltip on a control that swallows pointer
    // events.
    const blocked = screen.getByTestId("listings-card-favorite-blocked");
    expect(blocked.textContent?.length).toBeGreaterThan(0);

    const door = screen.getByTestId("listings-card-sign-in");
    expect(door.getAttribute("href")).toBe("/login?next=/l/7");
    expect(blocked.contains(door)).toBe(true);
  });

  it("a guest PRESS on the grid card's heart opens the door (D431)", () => {
    // The measured defect: the desktop grid card drew its own heart instead of
    // mounting `<FavoriteHeart>`, so it never got the door ruling — a
    // visitor's press reached a no-op toggle, announced itself unavailable and
    // went nowhere, while the same press on a SERP row opened sign-in.
    const onSignIn = vi.fn();
    const server = mockServer({});
    render(
      <TestProviders server={server} mandate="anonymous">
        <ListingCard listing={CARD} signIn={{ onSignIn }} />
      </TestProviders>
    );
    const before = server.calls.length;
    fireEvent.click(screen.getByTestId("listings-card-favorite"));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    // …and it wrote nothing: the press is the way IN, not a save attempt that
    // will be refused by the server.
    expect(server.calls.length).toBe(before);
  });

  it("takes a callback instead, for a host that opens a modal", () => {
    const onSignIn = vi.fn();
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} signIn={{ onSignIn }} />
      </TestProviders>
    );
    const door = screen.getByTestId("listings-card-sign-in");
    expect(door.hasAttribute("href")).toBe(false);
    fireEvent.click(door);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("says the reason alone when the host has no sign-in route", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} />
      </TestProviders>
    );
    expect(screen.getByTestId("listings-card-favorite-blocked")).toBeTruthy();
    expect(screen.queryByTestId("listings-card-sign-in")).toBeNull();
  });
});

describe("a member's favourite control", () => {
  it("carries no blocked line and no door", () => {
    render(
      <TestProviders server={mockServer({})}>
        <ListingCard listing={CARD} signIn={{ href: "/login" }} />
      </TestProviders>
    );
    expect(screen.getByTestId("listings-card-favorite")).toHaveProperty(
      "disabled",
      false
    );
    expect(screen.queryByTestId("listings-card-favorite-blocked")).toBeNull();
    expect(screen.queryByTestId("listings-card-sign-in")).toBeNull();
  });

  it("keeps the line off a card that hides the heart on purpose", () => {
    // The owner's own dashboard: no favourite control, so no reason about one.
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} showFavorite={false} signIn={{ href: "/login" }} />
      </TestProviders>
    );
    expect(screen.queryByTestId("listings-card-favorite")).toBeNull();
    expect(screen.queryByTestId("listings-card-favorite-blocked")).toBeNull();
  });
});
