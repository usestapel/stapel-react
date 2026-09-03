import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { StapelApiError, actionAvailable } from "@stapel/core";
import { ListingComposerPage } from "../src/default/index.js";
import { envelopeFieldErrors, LOCATION_FIELD, PRICE_FIELD } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { DRAFT, detail } from "./fixtures.js";

/**
 * Blocker C2, second half: a refusal the person could not read.
 *
 * `save-draft` refused one over-precise coordinate, and the screen answered
 * with two identical "Validation error" plaques over the footer and not a
 * word about which of thirty-odd controls was wrong. The envelope knew — it
 * carries `params.field` — and nothing looked at it, because the per-field
 * door in this pair only opened for a publish BATCH.
 *
 * What has to hold now: the field name in an envelope reaches the control it
 * belongs to, the banner stops repeating what the control already says, and a
 * refusal that names nothing (or names something this composer does not draw)
 * still gets its banner.
 */

/** The shape stapel-core's handler folds a DRF field error into. */
function fieldEnvelope(field: string, sentence: string): Record<string, unknown> {
  return {
    localizable_error: "error.400.validation_error",
    error: sentence,
    params: { field, detail: { [field]: [sentence] } },
    error_language: "en",
  };
}

const OVER_PRECISE = fieldEnvelope(
  "lat_draft",
  "Ensure that there are no more than 6 decimal places."
);

function categoryPicker(slot: { setCategory: (id: string) => void }): ReactElement {
  return (
    <button
      type="button"
      data-testid="listings-composer-category-pick"
      onClick={() => {
        slot.setCategory("tools/power");
      }}
    >
      pick
    </button>
  );
}

const GALLERY = { refs: ["image/9f2c1a"], settled: actionAvailable() };

function locationPicker(): ReactElement {
  return <div data-testid="stand-in-picker" />;
}

function composer(overrides: Record<string, unknown> = {}) {
  const srv = mockServer({
    "/listings/42/save-draft/": { status: 400, body: OVER_PRECISE },
    "/listings/42/": { body: detail({ id: 42, status: "draft" }) },
    "/listings/": { body: DRAFT },
    ...overrides,
  });
  render(
    <TestProviders server={srv}>
      <ListingComposerPage
        listingId={42}
        renderCategoryPicker={categoryPicker}
        renderLocationPicker={locationPicker}
        features={[]}
        images={GALLERY}
      />
    </TestProviders>
  );
  return srv;
}

describe("envelopeFieldErrors — the API's field name → the control", () => {
  it("routes both halves of the coordinate pair onto the one location control", () => {
    for (const column of ["lat_draft", "lon_draft"]) {
      const routed = envelopeFieldErrors(
        new StapelApiError({
          code: "error.400.validation_error",
          message: "Ensure that there are no more than 6 decimal places.",
          params: { field: column },
          status: 400,
          body: {},
        })
      );
      expect(Object.keys(routed)).toEqual([LOCATION_FIELD]);
      // The sentence should name the CONTROL, not the column behind it.
      expect(routed[LOCATION_FIELD]?.params["field"]).toBe(LOCATION_FIELD);
      expect(routed[LOCATION_FIELD]?.status).toBe(400);
    }
  });

  it("routes a price refusal onto the price control", () => {
    const routed = envelopeFieldErrors(
      new StapelApiError({
        code: "error.400.validation_error",
        message: "no",
        params: { field: "price_draft" },
        status: 400,
        body: {},
      })
    );
    expect(Object.keys(routed)).toEqual([PRICE_FIELD]);
  });

  it("routes nothing for a refusal that names no field, or names one we do not draw", () => {
    expect(
      envelopeFieldErrors(
        new StapelApiError({
          code: "error.503.unavailable",
          message: "down",
          params: {},
          status: 503,
          body: {},
        })
      )
    ).toEqual({});
    expect(
      envelopeFieldErrors(
        new StapelApiError({
          code: "error.400.validation_error",
          message: "no",
          params: { field: "some_column_we_never_drew" },
          status: 400,
          body: {},
        })
      )
    ).toEqual({});
    expect(envelopeFieldErrors(new Error("boom"))).toEqual({});
    expect(envelopeFieldErrors(undefined)).toEqual({});
  });
});

describe("a refused save is read on the control, not as a wall", () => {
  it("marks the location field and prints no banner at all", async () => {
    composer();
    await waitFor(() => {
      expect(
        screen
          .getByTestId("listings-composer-publish-gate")
          .getAttribute("data-stapel-gated")
      ).toBe("available");
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-save"));
    });

    await waitFor(() => {
      // The control the person can actually change is the one wearing it.
      const item = screen
        .getByTestId("listings-composer-location-slot")
        .closest(".ant-form-item");
      expect(item?.textContent).toContain("Validation error");
    });
    // …and the two identical plaques are gone.
    expect(screen.queryByTestId("listings-composer-save-error")).toBeNull();
    expect(screen.queryByTestId("listings-composer-error")).toBeNull();
  });

  it("still banners a refusal with nowhere else to go", async () => {
    composer({
      "/listings/42/save-draft/": {
        status: 503,
        body: {
          localizable_error: "error.503.unavailable",
          error: "Service unavailable",
          params: {},
        },
      },
    });
    await waitFor(() => {
      expect(
        screen
          .getByTestId("listings-composer-publish-gate")
          .getAttribute("data-stapel-gated")
      ).toBe("available");
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-save"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("listings-composer-save-error")).toBeTruthy();
    });
  });
});
