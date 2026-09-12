import { describe, expect, it } from "vitest";
import type { FeatureDef } from "@stapel/attributes-react";
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

  /* ── D455: a shared slug is not a shared answer ──────────────────────────
   *
   * Measured on a client fleet's stand, 2026-09-12 (walk probe, publish
   * flow). The analysis read the photo as the wristwatch leaf and answered
   * the colour with `zolotoy`;
   * the category was corrected to the laptop leaf, which declares `color` as
   * well — and therefore kept the value — but spells gold `zolotistyy`. The
   * control drew the raw code `zolotoy`, the mirror refused it
   * `not_in_options`, and the publish gate shut on the colour field over a
   * row the catalogue marks OPTIONAL and the server publishes without.
   * Retention by slug alone is what carried it across.
   */
  const WATCH_GOLD = { brand: ["bosch"], color: ["zolotoy"] };
  const LAPTOP: readonly FeatureDef[] = [
    ...FEATURES,
    {
      slug: "color",
      name: "Цвет",
      mandatory: false,
      config: {
        type: "select",
        options: [
          { value: "zolotistyy", label: "Золотистый" },
          { value: "seryy", label: "Серый" },
        ],
        maxSelected: 1,
        minSelected: 0,
      },
    } as unknown as FeatureDef,
  ];

  it("drops an answer whose slug survives but whose VALUE this category refuses", () => {
    expect(retainKnownFeatureValues(WATCH_GOLD, LAPTOP)).toEqual({
      brand: ["bosch"],
    });
  });

  it("names that answer too — it did not apply, it was not lost silently", () => {
    expect(droppedFeatureSlugs(WATCH_GOLD, LAPTOP)).toEqual(["color"]);
  });

  it("keeps an answer the new schema DOES offer", () => {
    const kept = retainKnownFeatureValues(
      { brand: ["bosch"], color: ["seryy"] },
      LAPTOP
    );
    expect(kept).toEqual({ brand: ["bosch"], color: ["seryy"] });
    expect(droppedFeatureSlugs({ brand: ["bosch"], color: ["seryy"] }, LAPTOP)).toEqual([]);
  });

  it("never names a BLANK field as dropped — a demand is not a verdict", () => {
    // `brand` is mandatory and unanswered here: the mirror says
    // `mandatory_missing`, which asks for an answer rather than refusing one.
    // Reporting it as "did not apply" would tell a person their answer was
    // discarded when they never gave one.
    expect(droppedFeatureSlugs({ brand: [], color: ["seryy"] }, LAPTOP)).toEqual([]);
    expect(retainKnownFeatureValues({ brand: [], color: ["seryy"] }, LAPTOP)).toEqual({
      brand: [],
      color: ["seryy"],
    });
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

/**
 * `save-draft` REPLACES what the body names — it does not merge — so what a
 * body OMITS is as load-bearing as what it spells. Both halves of that are
 * asserted here: the schema this pair has not been given yet, and the save
 * that names the fields it is writing.
 */
describe("a save-draft body claims only what it can claim (D: features_draft)", () => {
  it("spells NO features_draft when there is no schema to tag with", () => {
    const values = {
      ...emptyDraftValues(),
      features: { power: 1200 },
    };
    // The measured harm: a save fired before the category's schema arrived
    // spelled `features_draft: {}` and DELETED the row's stored answers while
    // the form on screen still showed them.
    expect("features_draft" in draftPatchFromValues(values, [])).toBe(false);
    expect("features_draft" in draftPatchFromValues(values, undefined)).toBe(
      false
    );
    // Everything else in the body is unaffected: a title save is still a
    // title save while the schema is in flight.
    expect(draftPatchFromValues(values, []).title_draft).toBe(values.title);
  });

  it("is unchanged in shape once the schema is there", () => {
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
    // Fourteen fields, exactly as before: no key gained, none lost.
    expect(Object.keys(body).sort()).toEqual(
      [
        "auto_republish",
        "category_id",
        "countable",
        "currency",
        "description_draft",
        "features_draft",
        "images_draft",
        "lat_draft",
        "location_id_draft",
        "location_label_draft",
        "lon_draft",
        "price_draft",
        "stock_quantity",
        "title_draft",
      ].sort()
    );
  });

  it("writes ONLY the fields a partial save names", () => {
    const values = {
      ...emptyDraftValues(),
      categoryId: "tools/power",
      title: "Bosch GSB 1200",
      images: ["image/a"],
      features: { power: 1200 },
    };
    // The photo settled; nothing else on the form is being claimed.
    const body = draftPatchFromValues(values, FEATURES, {
      fields: ["images_draft"],
    });
    expect(body).toEqual({ images_draft: ["image/a"] });
    // Which is the point: a save that does not name `features_draft` cannot
    // replace the stored map, whatever schema it happens to be holding.
    expect("features_draft" in body).toBe(false);
    expect("title_draft" in body).toBe(false);
  });

  it("keeps the value rules inside the selection", () => {
    const values = { ...emptyDraftValues(), price: "" };
    // A named field is still whatever the rules produced — an empty price is
    // `null` here exactly as it is in a whole body.
    expect(
      draftPatchFromValues(values, FEATURES, { fields: ["price_draft"] })
    ).toEqual({ price_draft: null });
    // And a named field the rules OMIT stays omitted: naming
    // `features_draft` without a schema still writes nothing rather than
    // resurrecting `{}`.
    expect(
      draftPatchFromValues(values, [], { fields: ["features_draft"] })
    ).toEqual({});
    // `category_id` while unchosen is the same story.
    expect(
      draftPatchFromValues(values, FEATURES, { fields: ["category_id"] })
    ).toEqual({});
  });

  it("sends the whole body when no fields are named", () => {
    const values = { ...emptyDraftValues(), categoryId: "tools/power" };
    expect(draftPatchFromValues(values, FEATURES, {})).toEqual(
      draftPatchFromValues(values, FEATURES)
    );
  });
});
