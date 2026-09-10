/**
 * The generated schema's feature-config discriminator, pinned.
 *
 * This pair filed the upstream defect: `FeatureConfig.discriminator.mapping`
 * carried a single `"null"` entry instead of the ten type slugs, so
 * openapi-typescript re-added a SYNTHETIC discriminant per member and the
 * generated `BoolConfig` declared `type: "BoolConfig"` where the wire sends
 * `type: "bool"`. stapel-attributes 0.4.7 fixed the serializer,
 * stapel-categories 0.6.1 regenerated `docs/schema.json`, and the pair's
 * workaround came out.
 *
 * The assertion is TYPE-LEVEL on purpose: nothing at runtime carries these
 * literals, and `pnpm --filter @stapel/categories-react test` type-checks
 * before it runs, so a regenerated schema that reintroduced a class name (or
 * dropped a slug) fails the build rather than a matcher. `EXHAUSTIVE` is
 * checked in BOTH directions — a missing slug and an extra one are different
 * defects and both are defects.
 */
import { describe, expect, it } from "vitest";
import { AXIS_ROLES, axisRoleOf } from "@stapel/attributes-react";
import type {
  AxisRole,
  Category,
  CategoryFeature,
  CategoryFeatureConfig,
  CategoryFeatureType,
  CategoryLinkedChild,
  CategoryVirtualChild,
  Schemas,
} from "../src/index.js";

/** The thirteen registered value types (stapel-attributes 0.5.0 added the two
 * vocabulary-backed ones and 0.7.0 the `group` container; stapel-categories
 * 0.9.0 carries them).
 *
 * `group` is the odd one and is listed here for the same reason `header` is:
 * this list pins what the WIRE can send, not what this pair draws. A group's
 * config holds `fields` — its children as raw dicts, each discriminated by its
 * own `type` — plus an optional `repeat`, so it is a container in the schema
 * and an editor question elsewhere. Leaving it out of the list would fail this
 * assertion in the direction that says "the union has a member you did not
 * name", which is exactly the signal a regenerated schema is supposed to
 * give. */
const FEATURE_TYPE_SLUGS = [
  "int",
  "float",
  "string",
  "bool",
  "hex_color",
  "select",
  "date",
  "header",
  "hierarchical_select",
  "convertible_unit",
  "ref_select",
  "ref_hierarchical_select",
  "group",
] as const;

/** Every slug above is a discriminant of the generated union… */
const _slugsAreDiscriminants: readonly CategoryFeatureType[] = FEATURE_TYPE_SLUGS;
/** …and the union has no member the list above does not name. */
type Extra = Exclude<CategoryFeatureType, (typeof FEATURE_TYPE_SLUGS)[number]>;
const _noExtraMembers: Extra extends never ? true : never = true;

describe("FeatureConfig discriminator", () => {
  it("is slug-keyed, thirteen members, in both directions", () => {
    // The compile-time assertions above are the test; these keep the runtime
    // half honest about the count and about the absence of the old spelling.
    expect(new Set(FEATURE_TYPE_SLUGS).size).toBe(13);
    expect(FEATURE_TYPE_SLUGS).not.toContain("BoolConfig" as never);
    expect(_slugsAreDiscriminants.length).toBe(13);
    expect(_noExtraMembers).toBe(true);
  });

  it("narrows a well-formed config to its own fields", () => {
    // `type` is what makes narrowing possible at all — the whole point of the
    // upstream fix. A "select" config has options; an "int" config does not.
    const config: CategoryFeatureConfig = {
      type: "select",
      options: [{ value: "bosch", label: "demo.brand.bosch" }],
    };
    expect(config.type === "select" ? config.options?.length : 0).toBe(1);
  });
});

/**
 * The axis-role seam, pinned at compile time in both directions.
 *
 * stapel-categories serves the value, `@stapel/attributes-react` owns the
 * vocabulary, and this pair is the only place the two meet. Nothing at runtime
 * carries the literals, so — like the discriminator above — the assertion is a
 * type: a sixth role landing on one side and not the other fails
 * `tsc -p tsconfig.test.json` instead of quietly widening one half of a seam
 * whose whole value is that both halves agree.
 */
type SchemaAxisRole = NonNullable<Schemas["FeatureCompact"]["axis_role"]>;
/** Every role the catalogue can serve is one `byAxisRole` can key on… */
const _schemaRolesAreKnown: readonly AxisRole[] = [] as readonly SchemaAxisRole[];
/** …and the reader claims none the catalogue cannot send. */
type UnservedRole = Exclude<AxisRole, SchemaAxisRole>;
const _noUnservedRoles: UnservedRole extends never ? true : never = true;

describe("axis_role — the catalogue's value and the reader's vocabulary", () => {
  it("names the same five roles on both sides of the seam", () => {
    expect(AXIS_ROLES).toEqual(["make", "model", "generation", "year", "mileage"]);
    expect(_schemaRolesAreKnown.length).toBe(0);
    expect(_noUnservedRoles).toBe(true);
  });

  it("is nullable on the wire, and absent is the same answer as null", () => {
    // Every definition written before the field existed says nothing here, and
    // so does the overwhelming majority of features that are properties rather
    // than axes. Neither is an error and neither is "not a make".
    const unclaimed: CategoryFeature = { slug: "colour", config: { type: "select" } };
    expect(axisRoleOf(unclaimed)).toBeNull();
    expect(axisRoleOf({ ...unclaimed, axis_role: null })).toBeNull();
  });
});

/**
 * A POINTER IS A ROW, AND THE CONTRACT SAYS SO.
 *
 * The whole reason this pair grew no second rendering path for a linked child
 * is upstream's promise that "a client that already renders a child renders
 * this one with no new code": every key on `CategoryLinkedChild` is the
 * target's. That promise is a SHAPE, so it is asserted as one. If a future
 * release narrows the pointer's payload — drops the ancestry columns, say, or
 * the icons — this fails `tsc -p tsconfig.test.json` here, at the seam, rather
 * than in a storefront's tile grid.
 *
 * The other direction is deliberately NOT asserted: `Category` is missing
 * `linked`, which is exactly the one key the pointer adds.
 */
type PointerIsARow = CategoryLinkedChild extends Category ? true : never;
const _pointerIsARow: PointerIsARow = true;

/** …and a VALUE is the opposite: nothing addressable at all. */
type ValueHasNoId = "id" extends keyof CategoryVirtualChild ? never : true;
const _valueHasNoId: ValueHasNoId = true;

describe("the three kinds of child", () => {
  it("keeps a pointer assignable to a row and a value un-addressable", () => {
    expect(_pointerIsARow).toBe(true);
    expect(_valueHasNoId).toBe(true);
  });
});
