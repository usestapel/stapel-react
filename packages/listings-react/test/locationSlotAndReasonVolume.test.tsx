/**
 * Two surface decisions this pair had no way to express, and the defects each
 * one produced on the live storefront.
 *
 *  - WHERE a thing is was asked as a raw `lat` / `lon` pair, which is a
 *    question no seller can answer. `renderLocationPicker` is the seam a host
 *    fills with its own geocoder (stapel-geo over a Photon server, on the
 *    client fleet this came from), and
 *    it carries the whole composite — `geohash` included, which only the
 *    resolver has and which this pair still refuses to compute.
 *  - A blocked favourite stated its reason AND drew a sign-in door on every
 *    card. On one card that is help; on a grid of twenty-four it was the
 *    loudest thing on the landing page, twenty-four doors to one place.
 *    `blockedReason` is the volume knob — and only the volume: the reason is
 *    on screen under all three settings.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ListingCard, ListingComposerPage } from "../src/default/index.js";
import type { ListingLocation } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD, DRAFT, detail } from "./fixtures.js";

function composerServer() {
  return mockServer({
    "/listings/42/save-draft/": { body: DRAFT },
    "/listings/42/": { body: detail({ id: 42, status: "draft" }) },
    "/listings/": { body: DRAFT },
  });
}

describe("the composer's location question", () => {
  it("asks for coordinates only when the host has no picker to offer", () => {
    render(
      <TestProviders server={composerServer()}>
        <ListingComposerPage features={[]} />
      </TestProviders>
    );
    // The pre-slot behaviour, unchanged: a host that passes nothing keeps
    // exactly the screen it had.
    expect(screen.getByTestId("listings-composer-location")).toBeTruthy();
    expect(screen.getByTestId("listings-composer-lat")).toBeTruthy();
    expect(screen.getByTestId("listings-composer-lon")).toBeTruthy();
    expect(screen.queryByTestId("listings-composer-location-slot")).toBeNull();
  });

  it("hands the whole composite to the picker and takes the whole composite back", async () => {
    // What a geocoder answers: a label a person reads, the pin, AND the
    // geohash the indexer buckets by — all four at once, which is the only
    // way they are ever consistent.
    const RESOLVED: ListingLocation = {
      locationId: "photon:W427579341",
      locationLabel: "Москва, Тверская улица",
      lat: "55.768793",
      lon: "37.597860",
      geohash: "ucftpvhz",
    };
    let seen: ListingLocation | undefined;
    const saved = vi.fn();

    render(
      <TestProviders server={composerServer()}>
        <ListingComposerPage
          features={[]}
          renderLocationPicker={({ value, setLocation, save }) => {
            seen = value;
            return (
              <button
                type="button"
                data-testid="pick"
                onClick={() => {
                  setLocation(RESOLVED);
                  save();
                  saved();
                }}
              >
                {value.locationLabel === "" ? "choose" : value.locationLabel}
              </button>
            );
          }}
        />
      </TestProviders>
    );

    // The slot replaces BOTH the label box and the coordinate pair: a picker
    // that resolved a place has already answered all four, and a second set
    // of boxes for the same value is two answers to one question.
    expect(screen.getByTestId("listings-composer-location-slot")).toBeTruthy();
    expect(screen.queryByTestId("listings-composer-lat")).toBeNull();
    expect(screen.queryByTestId("listings-composer-lon")).toBeNull();
    expect(screen.queryByTestId("listings-composer-location")).toBeNull();

    expect(seen?.lat).toBe(null);
    expect(seen?.geohash).toBe("");

    fireEvent.click(screen.getByTestId("pick"));

    // Round-trips, geohash and all — the value the resolver produced is the
    // value the draft now carries, not a re-derived one.
    await waitFor(() => {
      expect(seen).toEqual(RESOLVED);
    });
    expect(saved).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("pick").textContent).toBe("Москва, Тверская улица");
  });
});

describe("how loudly a blocked favourite states its reason", () => {
  it("prints the reason and the door by default — one card, full help", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} signIn={{ href: "/login" }} />
      </TestProviders>
    );
    expect(screen.getByTestId("listings-card-favorite-blocked")).toBeTruthy();
    expect(screen.getByTestId("listings-card-sign-in")).toBeTruthy();
  });

  it("`line` keeps the sentence and drops the repeated door", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} signIn={{ href: "/login" }} blockedReason="line" />
      </TestProviders>
    );
    expect(screen.getByTestId("listings-card-favorite-blocked")).toBeTruthy();
    expect(screen.queryByTestId("listings-card-sign-in")).toBeNull();
  });

  it("`tooltip` moves the reason onto the control, and never hides the control", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} signIn={{ href: "/login" }} blockedReason="tooltip" />
      </TestProviders>
    );
    expect(screen.queryByTestId("listings-card-favorite-blocked")).toBeNull();
    // The heart is still there and still switched off — this is a volume
    // knob, not `showFavorite={false}`.
    const heart = screen.getByTestId("listings-card-favorite");
    expect(heart).toHaveProperty("disabled", true);
    // And the reason is still reachable: the wrapper that makes a disabled
    // button's tooltip hear pointer AND keyboard events is what carries it.
    expect(screen.getByTestId("listings-card-favorite-wrap")).toBeTruthy();
  });
});
