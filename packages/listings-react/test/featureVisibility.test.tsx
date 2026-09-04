/**
 * The redacted stub, from the wire to the screen.
 *
 * stapel-listings 0.12.0 withholds a value the reader is not entitled to —
 * an identifier of one physical unit, a VIN or an IMEI — and keeps the ROW as
 * a value-free stub, in place and in order. Two claims are load-bearing here:
 *
 *  1. the stub reaches the DISPLAY deliberately, through the value envelope,
 *     rather than by accident through `config`'s index signature;
 *  2. the stub never reaches an EDITOR. A composer seeded from one would put
 *     `undefined` under the seller's own slug and the next save would blank a
 *     stored VIN the seller cannot even see. That is the only failure in this
 *     slice that destroys data, so it is the one with the most tests.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ListingDetailData, ListingFeatureDao } from "../src/index.js";
import {
  featureFromDao,
  featureValuesForDisplay,
  featuresDtoFromDaoList,
  featuresFromDaoList,
  unreadableFeatureCount,
} from "../src/index.js";
import { draftValuesFromDetail } from "../src/index.js";
import { ListingDetailPane } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { BADGE_DAOS, TITLE_DAOS, detail, statusInfo } from "./fixtures.js";

/** The stub `redact_dao` builds: the field's identity, `redacted`, `present`
 * — and no `value` key at all. */
function vinStub(overrides: Partial<ListingFeatureDao> = {}): ListingFeatureDao {
  return {
    slug: "vin",
    type: "string",
    name: "VIN",
    order: 15,
    visibility: "owner",
    redacted: true,
    present: true,
    ...overrides,
  };
}

/** The same row as its OWNER reads it: unredacted, value and all. */
const VIN_VALUE: ListingFeatureDao = {
  slug: "vin",
  type: "string",
  name: "VIN",
  order: 15,
  visibility: "owner",
  value: "WVWZZZ1JZXW000001",
};

describe("the stub reaches the display deliberately", () => {
  it("lifts `visibility` onto the DEFINITION, where it is a real FeatureDef field", () => {
    const view = featureFromDao(vinStub());
    expect(view?.feature.visibility).toBe("owner");
    expect(view?.feature.config["visibility"]).toBeUndefined();
  });

  it("keeps the markers on the VALUE side, out of the type's config", () => {
    const view = featureFromDao(vinStub());
    expect(view?.value).toEqual({
      type: "string",
      value: undefined,
      redacted: true,
      present: true,
    });
    // The config is the type's own keys, and none of these ever were.
    for (const key of ["redacted", "present", "verification", "visibility"]) {
      expect(view?.feature.config[key]).toBeUndefined();
    }
  });

  it("passes a verification through verbatim — the shape belongs to whoever checked", () => {
    const view = featureFromDao(
      vinStub({ verification: { status: "verified", source: "registry.example" } })
    );
    expect(view?.value?.["verification"]).toEqual({
      status: "verified",
      source: "registry.example",
    });
  });

  it("drops a verification that is not an object", () => {
    expect(
      featureFromDao(vinStub({ verification: "yes" as unknown as Record<string, unknown> }))
        ?.value?.["verification"]
    ).toBeUndefined();
  });

  it("stamps nothing for a public row — the axis costs an existing listing nothing", () => {
    const view = featureFromDao(BADGE_DAOS[0] as ListingFeatureDao);
    expect(view?.feature.visibility).toBeUndefined();
    expect(view?.value).toEqual({ type: "int", value: 1200 });
  });

  it("fails SAFE on a visibility it does not know", () => {
    // The engine normalizes at write time and raises on a typo, so this is a
    // stored row nobody expects. It still must not read as public.
    expect(featureFromDao({ ...VIN_VALUE, visibility: "privat" })?.feature.visibility).toBe(
      "staff"
    );
  });

  it("KEEPS the row rather than counting it unreadable — the field's existence is the point", () => {
    const daos = [...TITLE_DAOS, vinStub(), ...BADGE_DAOS] as ListingFeatureDao[];
    expect(featuresFromDaoList(daos).map((view) => view.feature.slug)).toEqual([
      "condition",
      "vin",
      "power",
    ]);
    expect(unreadableFeatureCount(daos)).toBe(0);
  });

  it("keeps a stub with no type at all: 'this field was answered' survives a missing slug", () => {
    const view = featureFromDao({ slug: "vin", redacted: true, present: false });
    expect(view?.value?.["redacted"]).toBe(true);
    expect(view?.value?.["present"]).toBe(false);
  });
});

describe("featuresDtoFromDaoList — the EDIT envelope, and the value it must not destroy", () => {
  it("drops the stub instead of seeding an editor with `undefined`", () => {
    const dto = featuresDtoFromDaoList([...TITLE_DAOS, vinStub(), ...BADGE_DAOS]);
    // Not `{vin: {type: "string", value: undefined}}` — that is what the next
    // save would write back over a stored VIN.
    expect(Object.keys(dto).sort()).toEqual(["condition", "power"]);
    expect("vin" in dto).toBe(false);
  });

  it("leaves the OWNER's own value alone: their read is unredacted and editable", () => {
    // The path a composer is actually supposed to take. Nothing about the
    // visibility axis stops a seller editing their own VIN.
    expect(featuresDtoFromDaoList([VIN_VALUE])).toEqual({
      vin: { type: "string", value: "WVWZZZ1JZXW000001" },
    });
  });

  it("keeps a stub out of the draft a reopened composer would submit", () => {
    const listing = detail({
      features: [...TITLE_DAOS, vinStub(), ...BADGE_DAOS] as ListingDetailData["features"],
    });
    const values = draftValuesFromDetail(
      listing,
      featuresDtoFromDaoList([...TITLE_DAOS, vinStub(), ...BADGE_DAOS])
    );
    expect(values.features).toEqual({ condition: "used", power: 1200 });
    expect("vin" in values.features).toBe(false);
  });

  it("drops a stub whose `present` is false just the same — absence is not an answer either", () => {
    expect(featuresDtoFromDaoList([vinStub({ present: false })])).toEqual({});
  });
});

describe("featureValuesForDisplay — the other half of the split", () => {
  it("KEEPS the stub, because a spec table has something to say about it", () => {
    const values = featureValuesForDisplay([...TITLE_DAOS, vinStub()]);
    expect(values["vin"]).toEqual({
      type: "string",
      value: undefined,
      redacted: true,
      present: true,
    });
    expect(values["condition"]).toEqual({ type: "string", value: "used" });
  });
});

describe("the detail pane", () => {
  const withVin = (): ListingDetailData =>
    detail({
      features: [...TITLE_DAOS, vinStub(), ...BADGE_DAOS] as ListingDetailData["features"],
    });

  it("shows the withheld row in its stored position, with no value and no verification claim", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: withVin() },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-spec-list")).toBeDefined();
    });
    const labels = [
      ...screen
        .getByTestId("listings-spec-list")
        .querySelectorAll("[data-testid^='listings-spec-label-']"),
    ].map((node) => node.textContent);
    expect(labels).toEqual(["Condition", "VIN", "Power"]);
    expect(
      screen.getByTestId("listings-spec-value-vin").textContent
    ).toBe("Provided by the seller");
    const table = screen.getByTestId("listings-spec-list").textContent ?? "";
    expect(table).not.toContain("WVWZZZ");
    expect(table.toLowerCase()).not.toContain("verified");
  });

  it("never prints a withheld row on the title line", async () => {
    // The server keeps hidden values out of `features_title` entirely; the
    // pane filters anyway, because this is the line a leaked identifier would
    // be read out loud on.
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": {
        body: detail({
          features_title: [
            ...TITLE_DAOS,
            vinStub({ order: 1 }),
          ] as unknown as ListingDetailData["features_title"],
        }),
      },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title-features").textContent).toBe("used");
    });
  });
});
