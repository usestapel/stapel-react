/**
 * The axis role — the catalogue's answer to "which feature here is the make?".
 *
 * The defect this closes is not a crash: a storefront kept its own table of
 * slugs (`brand` / `make` / `make_ref_select` / `vendor`), a catalogue spelled
 * the axis `manufacturer`, and the «more of this make» link SILENTLY stopped
 * being drawn. So the assertions below are mostly about the answers that are
 * not exceptions — an unknown role, an absent one, and two features claiming
 * the same one — because every one of those is a place a reader could quietly
 * go on believing it had found the make.
 */
import { describe, expect, it } from "vitest";
import { AXIS_ROLES, axisRoleOf, byAxisRole } from "../src/axis.js";
import type { AxisRole } from "../src/axis.js";
import type { FeatureDef } from "../src/types.js";
import { feature } from "./fixtures.js";

/** A feature that claims `role`, shaped like a `/features/` row. */
function axis(slug: string, role: string | null | undefined): FeatureDef {
  return feature(slug, { type: "ref_select" }, {
    ...(role === undefined ? {} : { axis_role: role as AxisRole | null }),
  } as Partial<FeatureDef>);
}

describe("AXIS_ROLES", () => {
  it("is the closed vocabulary, in descent order", () => {
    expect(AXIS_ROLES).toEqual(["make", "model", "generation", "year", "mileage"]);
  });

  /**
   * HALF COMPILE-TIME, and the reason `AxisRole` is derived from the generated
   * `FeatureDef` rather than restated.
   *
   * The record below is `Record<AxisRole, true>`, so a sixth role landing in
   * the §68 canon regenerates `src/generated/featureDef.ts`, widens
   * `AxisRole`, leaves this literal a key short and fails `tsc -p
   * tsconfig.test.json`. The runtime comparison then pins `AXIS_ROLES` to that
   * same set — so the array cannot be shipped one role behind the type it
   * claims to enumerate, with `byAxisRole` quietly answering `null` for the
   * axis nobody added here.
   */
  it("lists every role the generated canon declares, and only those", () => {
    const everyRole: Record<AxisRole, true> = {
      make: true,
      model: true,
      generation: true,
      year: true,
      mileage: true,
    };
    expect([...AXIS_ROLES].sort()).toEqual(Object.keys(everyRole).sort());
    expect(new Set(AXIS_ROLES).size).toBe(AXIS_ROLES.length);
  });
});

describe("axisRoleOf", () => {
  it("reads a declared role", () => {
    expect(axisRoleOf(axis("brand", "make"))).toBe("make");
    expect(axisRoleOf(axis("mileage_km", "mileage"))).toBe("mileage");
  });

  it("answers null for a feature that claims nothing", () => {
    // Three spellings of "nothing was said", all of which reach a browser:
    // a definition written before the field existed, an explicit null from
    // the resolved read, and the editor serializer's blank authoring column.
    expect(axisRoleOf(axis("colour", undefined))).toBeNull();
    expect(axisRoleOf(axis("colour", null))).toBeNull();
    expect(axisRoleOf(axis("colour", ""))).toBeNull();
  });

  it("answers null for a role this build does not know, and does not throw", () => {
    // Python's `normalize_axis_role` RAISES here, because there the value is
    // being authored. This side is reading a payload it did not write: an
    // unrecognised role must claim nothing rather than blow up a category
    // page, and must not be passed through as if a caller could act on it.
    expect(() => axisRoleOf(axis("brand", "manufacturer"))).not.toThrow();
    expect(axisRoleOf(axis("brand", "manufacturer"))).toBeNull();
    expect(axisRoleOf(axis("brand", "MAKE"))).toBeNull();
  });

  it("tolerates a non-string value and a missing definition", () => {
    expect(axisRoleOf({ slug: "x", config: {}, axis_role: 3 })).toBeNull();
    expect(axisRoleOf(null)).toBeNull();
    expect(axisRoleOf(undefined)).toBeNull();
  });
});

describe("byAxisRole", () => {
  it("is the lookup that replaces a slug table", () => {
    const features = [
      axis("brand", "make"),
      axis("model_ref", "model"),
      axis("colour", null),
      axis("year_of_make", "year"),
    ];
    const axes = byAxisRole(features);

    expect(axes.make?.slug).toBe("brand");
    expect(axes.model?.slug).toBe("model_ref");
    expect(axes.year?.slug).toBe("year_of_make");
    // Absent, not null: "this schema does not name that axis".
    expect("generation" in axes).toBe(false);
    expect(axes.generation).toBeUndefined();
  });

  it("DROPS a role two features claim rather than picking a winner", () => {
    // A link built off the wrong `make` sends a buyer to a facet that is not
    // the one they clicked, and neither feature is more right than the other.
    // The producer side does the same one step earlier; this is the reader's
    // half of the same rule.
    const axes = byAxisRole([
      axis("brand", "make"),
      axis("vendor", "make"),
      axis("model_ref", "model"),
    ]);

    expect("make" in axes).toBe(false);
    expect(axes.make).toBeUndefined();
    // The contradiction is contained: the roles nobody duplicated survive.
    expect(axes.model?.slug).toBe("model_ref");
  });

  it("drops the role even when the duplicate is third in the list", () => {
    const axes = byAxisRole([
      axis("brand", "make"),
      axis("model_ref", "model"),
      axis("manufacturer_ref", "make"),
    ]);
    expect(axes.make).toBeUndefined();
    expect(axes.model?.slug).toBe("model_ref");
  });

  it("is empty for a schema that names no axis at all", () => {
    const axes = byAxisRole([axis("colour", null), axis("warranty", undefined)]);
    expect(Object.keys(axes)).toEqual([]);
  });

  it("never invents a role from a slug", () => {
    // The whole point: `brand` LOOKS like a make and claims nothing, so it is
    // not one. The catalogue decides, not the reader.
    expect(byAxisRole([axis("brand", null), axis("make", undefined)])).toEqual({});
  });

  it("takes any iterable of definitions and keeps the row identity", () => {
    const make = axis("brand", "make");
    const axes = byAxisRole(new Set([make]));
    // The DEFINITION comes back, not a copy — a caller reads `config` off it
    // to build the facet the link points at.
    expect(axes.make).toBe(make);
  });
});
