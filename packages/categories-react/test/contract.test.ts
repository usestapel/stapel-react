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
import type { CategoryFeatureConfig, CategoryFeatureType } from "../src/index.js";

/** The ten registered value types (stapel-categories CHANGELOG 0.6.1). */
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
] as const;

/** Every slug above is a discriminant of the generated union… */
const _slugsAreDiscriminants: readonly CategoryFeatureType[] = FEATURE_TYPE_SLUGS;
/** …and the union has no member the list above does not name. */
type Extra = Exclude<CategoryFeatureType, (typeof FEATURE_TYPE_SLUGS)[number]>;
const _noExtraMembers: Extra extends never ? true : never = true;

describe("FeatureConfig discriminator", () => {
  it("is slug-keyed, ten members, in both directions", () => {
    // The compile-time assertions above are the test; these keep the runtime
    // half honest about the count and about the absence of the old spelling.
    expect(new Set(FEATURE_TYPE_SLUGS).size).toBe(10);
    expect(FEATURE_TYPE_SLUGS).not.toContain("BoolConfig" as never);
    expect(_slugsAreDiscriminants.length).toBe(10);
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
