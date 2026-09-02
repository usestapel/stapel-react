/**
 * Two surface decisions this pair had no way to express, and the defects each
 * one produced on the live storefront.
 *
 *  - WHERE a thing is was asked as a raw `lat` / `lon` pair, which is a
 *    question no seller can answer. It is a SLOT now, in two shapes — the
 *    `{ value, onChange }` component contract `@stapel/geo-react`'s
 *    `<LocationPickerField>` fills, and the whole-composite render prop for a
 *    picker that also resolves this pair's `location_id`. Unfilled, the
 *    composer names the slot instead of improvising two decimal boxes.
 *  - A blocked favourite stated its reason AND drew a sign-in door on every
 *    card. On one card that is help; on a grid of twenty-four it was the
 *    loudest thing on the landing page, twenty-four doors to one place.
 *    `blockedReason` is the volume knob for the DOOR — the reason itself is on
 *    screen under both settings, because the third setting used to be a
 *    `Tooltip` on a disabled button, which no device can open.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ListingCard, ListingComposerPage } from "../src/default/index.js";
import type { ComposerLocationPickerProps } from "../src/default/index.js";
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
  it("names the slot rather than asking a seller for coordinates", () => {
    render(
      <TestProviders server={composerServer()}>
        <ListingComposerPage features={[]} />
      </TestProviders>
    );
    // The whole point: no decimal boxes anywhere on an unwired composer.
    expect(screen.queryByTestId("listings-composer-lat")).toBeNull();
    expect(screen.queryByTestId("listings-composer-lon")).toBeNull();
    expect(screen.queryByTestId("listings-composer-location-slot")).toBeNull();
    // A dev build says which slot is unfilled; a production build renders null.
    expect(
      document.querySelector('[data-stapel-slot="locationPicker"]')
    ).not.toBeNull();
  });

  it("names every other unfilled slot too — category, currency, gallery", () => {
    render(
      <TestProviders server={composerServer()}>
        <ListingComposerPage features={[]} />
      </TestProviders>
    );
    for (const name of [
      "renderCategoryPicker",
      "renderCurrencyPicker",
      "gallerySlot",
    ]) {
      expect(
        document.querySelector(`[data-stapel-slot="${name}"]`),
        name
      ).not.toBeNull();
    }
    // And not one improvised control in their place.
    expect(screen.queryByRole("textbox", { name: "Category" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Currency" })).toBeNull();
  });

  it("hands a `{value,onChange}` picker numbers and takes decimal strings to the wire", async () => {
    let seen: ComposerLocationPickerProps["value"] | undefined;

    function Picker(props: ComposerLocationPickerProps) {
      seen = props.value;
      return (
        <button
          type="button"
          data-testid="pick"
          onClick={() => {
            props.onChange({
              lat: 55.768793,
              lon: 37.59786,
              address: "Москва, Тверская улица",
            });
          }}
        >
          {props.value.address ?? "choose"}
        </button>
      );
    }

    const server = composerServer();
    render(
      <TestProviders server={server}>
        <ListingComposerPage
          features={[]}
          category="tools/power"
          locationPicker={Picker}
        />
      </TestProviders>
    );

    expect(screen.getByTestId("listings-composer-location-slot")).toBeTruthy();
    expect(seen?.lat).toBe(null);

    fireEvent.click(screen.getByTestId("pick"));

    await waitFor(() => {
      expect(seen?.address).toBe("Москва, Тверская улица");
    });
    // Choosing a place IS the commit — the picker has no blur to wait for.
    await waitFor(() => {
      const body = server.lastBody("/listings/42/save-draft/") as Record<
        string,
        unknown
      >;
      expect(body["lat_draft"]).toBe("55.768793");
      expect(body["location_label_draft"]).toBe("Москва, Тверская улица");
    });
  });

  it("still offers the whole-composite render prop, and it wins", async () => {
    // What a place directory answers: a label, a pin, and its own opaque id —
    // the one member a generic `{lat,lon}` picker cannot know about.
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

    expect(screen.getByTestId("listings-composer-location-slot")).toBeTruthy();
    expect(seen?.lat).toBe(null);
    expect(seen?.geohash).toBe("");

    fireEvent.click(screen.getByTestId("pick"));

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
    // The reason is the shared gate's, as visible text linked to the control.
    const gate = document.querySelector('[data-stapel-gated="blocked"]');
    expect(gate).not.toBeNull();
    expect(gate?.querySelector("[data-stapel-gated-reason]")).not.toBeNull();
    expect(screen.getByTestId("listings-card-sign-in")).toBeTruthy();
  });

  it("`line` keeps the sentence and drops the repeated door", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} signIn={{ href: "/login" }} blockedReason="line" />
      </TestProviders>
    );
    expect(
      document.querySelector("[data-stapel-gated-reason]")
    ).not.toBeNull();
    expect(screen.queryByTestId("listings-card-sign-in")).toBeNull();
  });

  it("never hides the control, and never puts the reason in a hover", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} signIn={{ href: "/login" }} />
      </TestProviders>
    );
    const heart = screen.getByTestId("listings-card-favorite");
    expect(heart.getAttribute("aria-disabled")).toBe("true");
    expect(heart).toHaveProperty("disabled", false);
    // `aria-describedby` points AT the visible sentence — the whole reason the
    // tooltip arm was removed rather than kept as a "quieter" option.
    const describedBy = heart.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBeTruthy();
    expect(heart.getAttribute("title")).toBeNull();
  });
});
