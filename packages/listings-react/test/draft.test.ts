import { describe, expect, it } from "vitest";
import { toFeaturesDto } from "@stapel/attributes-react";
import {
  DEFAULT_DRAFT_LIMITS,
  DESCRIPTION_FIELD,
  EMPTY_LOCATION,
  PRICE_FIELD,
  createDraftBody,
  draftPatchFromValues,
  draftValuesFromDetail,
  draftValuesFromWire,
  droppedFeatureSlugs,
  emptyDraftValues,
  featuresDtoFromDaoList,
  mirrorListingFields,
  publishRefusal,
  retainKnownFeatureValues,
} from "../src/index.js";
import { StapelApiError } from "@stapel/core";
import { BADGE_DAOS, DRAFT, FEATURES, TITLE_DAOS, detail } from "./fixtures.js";

/** The pure half of a submission: what goes on the wire, and what the mirror says
 * before anything does. No React, no fetch — so the claims are about the
 * payload rather than about a component's plumbing. */

describe("the draft twin, both directions", () => {
  it("creates a row with the category and NOTHING else", () => {
    expect(createDraftBody("tools/power")).toEqual({
      category_id: "tools/power",
    });
  });

  it("tags each feature value with the type from the CATEGORY schema", () => {
    // The engine overrides whatever the client sent (`dto_data = {**dto_data,
    // 'type': config.type}`), so a client that guessed differently would be
    // sending a field the server throws away.
    const values = {
      ...emptyDraftValues(),
      categoryId: "tools/power",
      features: { brand: ["bosch"], power: 1200 },
    };
    const body = draftPatchFromValues(values, FEATURES);
    expect(body.features_draft).toEqual({
      brand: { type: "select", value: ["bosch"] },
      power: { type: "int", value: 1200 },
    });
  });

  it("omits a blank answer rather than sending null", () => {
    const values = {
      ...emptyDraftValues(),
      features: { brand: [], power: 1200 },
    };
    const body = draftPatchFromValues(values, FEATURES);
    expect(body.features_draft).toEqual({ power: { type: "int", value: 1200 } });
  });

  it("mirrors the countable/stock cross-field rule instead of contradicting it", () => {
    // `validate_countable_stock` refuses a quantity beside `countable: false`.
    const values = {
      ...emptyDraftValues(),
      countable: false,
      stockQuantity: 3,
    };
    expect(draftPatchFromValues(values, []).stock_quantity).toBeNull();
    expect(
      draftPatchFromValues({ ...values, countable: true }, []).stock_quantity
    ).toBe(3);
  });

  it("sends an empty price as null, not as an empty string", () => {
    expect(draftPatchFromValues(emptyDraftValues(), []).price_draft).toBeNull();
  });

  it("defaults a new draft to the storefront's currency (owner verdict F6)", () => {
    expect(emptyDraftValues().currency).toBe("RUB");
    expect(emptyDraftValues({ currency: "USD" }).currency).toBe("USD");
  });

  it("reads a saved draft back into the composer's shape", () => {
    const values = draftValuesFromWire({
      ...DRAFT,
      title_draft: "Bosch",
      price_draft: "4500.00",
      images_draft: ["image/a", "image/b"],
      features_draft: { power: { type: "int", value: 1200 } },
    });
    expect(values.title).toBe("Bosch");
    expect(values.images).toEqual(["image/a", "image/b"]);
    expect(values.features).toEqual({ power: 1200 });
  });

  it("seeds an EDIT from the published half — the only half a read returns", () => {
    // stapel-listings 0.6.1 exposes no read of the `*_draft` twin, so a live
    // listing's editor is seeded from what the buyer sees. That is also the
    // right content: it IS the listing.
    const listing = detail();
    const values = draftValuesFromDetail(
      listing,
      featuresDtoFromDaoList([...TITLE_DAOS, ...BADGE_DAOS])
    );
    expect(values.title).toBe(listing.title);
    expect(values.location.geohash).toBe("ucsu5uh");
    expect(values.features).toEqual({ condition: "used", power: 1200 });
  });
});

describe("changing category keeps what still applies", () => {
  const answered = { brand: ["bosch"], power: 1200, mileage: 40000 };

  it("retains the slugs the new schema also declares", () => {
    expect(retainKnownFeatureValues(answered, FEATURES)).toEqual({
      brand: ["bosch"],
      power: 1200,
    });
  });

  it("names what it dropped instead of losing it silently", () => {
    // 0.6.0's M-7 rule rejects an unknown slug per feature, so carrying it
    // would turn a category change into a publish refusal about a field the
    // composer no longer draws.
    expect(droppedFeatureSlugs(answered, FEATURES)).toEqual(["mileage"]);
  });
});

describe("the mirror, which never refuses what the server would accept", () => {
  it("counts description length in CODE POINTS, as Python's len() does", () => {
    // Five emoji are five characters on both sides of the wire;
    // `String.length` would call them ten and accept a description the
    // server refuses — or refuse one it accepts.
    const values = { ...emptyDraftValues(), categoryId: "c", description: "👍👍" };
    const errors = mirrorListingFields(values, DEFAULT_DRAFT_LIMITS);
    expect(errors[DESCRIPTION_FIELD]?.code).toBe(
      "error.400.description_too_short"
    );
    expect(errors[DESCRIPTION_FIELD]?.params["min_length"]).toBe(4);
  });

  it("takes its ceilings from the deployment, not from a constant", () => {
    // Every bound it mirrors is a STAPEL_LISTINGS setting a host can move; a
    // hardcoded 500 would refuse a valid submission on a host that widened
    // it, and the server would never hear about the refusal.
    const values = {
      ...emptyDraftValues(),
      categoryId: "c",
      description: "abc",
    };
    expect(
      mirrorListingFields(values, { ...DEFAULT_DRAFT_LIMITS, descriptionMin: 1 })[
        DESCRIPTION_FIELD
      ]
    ).toBeUndefined();
  });

  it("refuses a price shape the DecimalField would refuse", () => {
    const bad = { ...emptyDraftValues(), categoryId: "c", description: "abcd", price: "-5" };
    expect(mirrorListingFields(bad, DEFAULT_DRAFT_LIMITS)[PRICE_FIELD]).toBeDefined();
    const good = { ...bad, price: "4500.00" };
    expect(mirrorListingFields(good, DEFAULT_DRAFT_LIMITS)[PRICE_FIELD]).toBeUndefined();
  });

  it("treats half a coordinate as broken, not as half a location", () => {
    const values = {
      ...emptyDraftValues(),
      categoryId: "c",
      description: "abcd",
      location: { ...EMPTY_LOCATION, lat: "55.79" },
    };
    expect(mirrorListingFields(values, DEFAULT_DRAFT_LIMITS)["location"]).toBeDefined();
  });

  it("raises its own refusals with status 0", () => {
    // A client-side rule must not be indistinguishable from one that came
    // over the wire (the cdn-react precedent).
    const values = { ...emptyDraftValues(), description: "abcd" };
    const errors = mirrorListingFields(values, DEFAULT_DRAFT_LIMITS);
    for (const error of Object.values(errors)) expect(error.status).toBe(0);
  });
});

describe("the two kinds of publish 400", () => {
  it("reads a BARE ValidationBatchResult body as a per-field verdict", () => {
    const thrown = new StapelApiError({
      code: "stapel.http.400",
      message: "Request failed with status 400",
      status: 400,
      body: {
        valid: false,
        results: [
          {
            slug: "brand",
            status: "validation_failed",
            localizable_error: "error.400.feature_mandatory_missing",
            params: { feature: "Brand", slug: "brand" },
          },
        ],
      },
    });
    const refusal = publishRefusal(thrown);
    expect(refusal.kind).toBe("invalid_draft");
    if (refusal.kind !== "invalid_draft") return;
    // …and `field` is added on the way out, because the engine sends
    // `{feature, slug}` and the fleet's `useFieldError` routes on `field`.
    expect(refusal.fieldErrors["brand"]?.params["field"]).toBe("brand");
  });

  it("reads an ENVELOPE 400 as a sentence, not as a field verdict", () => {
    const thrown = new StapelApiError({
      code: "error.400.publish_validation_failed",
      message: "Listing validation failed",
      status: 400,
      body: { localizable_error: "error.400.publish_validation_failed" },
    });
    const refusal = publishRefusal(thrown);
    expect(refusal.kind).toBe("error");
  });

  it("wraps a non-Stapel throw rather than letting a raw value escape", () => {
    const refusal = publishRefusal(new TypeError("network"));
    expect(refusal.kind).toBe("error");
    if (refusal.kind !== "error") return;
    expect(refusal.error.status).toBe(0);
  });
});

describe("the DAO projection carries what a card needs", () => {
  it("splits a stored row into the (definition, value) pair the formatter takes", () => {
    expect(featuresDtoFromDaoList(BADGE_DAOS)).toEqual({
      power: { type: "int", value: 1200 },
    });
  });

  it("round-trips through toFeaturesDto with the same tags", () => {
    const dto = featuresDtoFromDaoList([...TITLE_DAOS, ...BADGE_DAOS]);
    const values = { condition: "used", power: 1200 };
    const defs = [
      { slug: "condition", config: { type: "string" } },
      { slug: "power", config: { type: "int" } },
    ];
    expect(toFeaturesDto(defs, values)).toEqual(dto);
  });
});
