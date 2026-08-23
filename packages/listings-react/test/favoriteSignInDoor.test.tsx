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

    // Never hidden (private-space canon §6.3): the heart is there, switched
    // off, because a control that disappears teaches nobody it exists.
    const heart = screen.getByTestId("listings-card-favorite");
    expect(heart).toHaveProperty("disabled", true);

    // The reason as TEXT, not as a tooltip on a control that swallows pointer
    // events.
    const blocked = screen.getByTestId("listings-card-favorite-blocked");
    expect(blocked.textContent?.length).toBeGreaterThan(0);

    const door = screen.getByTestId("listings-card-sign-in");
    expect(door.getAttribute("href")).toBe("/login?next=/l/7");
    expect(blocked.contains(door)).toBe(true);
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
