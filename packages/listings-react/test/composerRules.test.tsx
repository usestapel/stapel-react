/**
 * What the composer inherited from stapel-attributes 0.5.0, and the three
 * places it had to change to keep telling the truth.
 *
 * 1. **A category's defaults reach a blank draft.** `FeatureDef.default` (and
 *    the type's own default) is what the CATALOGUE says a form opens with. It
 *    is applied when the schema lands, only where the draft has no answer —
 *    a reopened listing outranks a default, because a default is a suggestion
 *    and an answer is not.
 * 2. **Requiredness is the RULE STATE, not `mandatory`.** A field the rules
 *    hide must not block a publish for an answer nobody can give, and a field
 *    a rule made required must block one even though `mandatory` is false.
 * 3. **A missing vocabulary source blocks through the SAME channel** an
 *    unsupported type does. One fact, one gate, one sentence — a second
 *    channel would be a second sentence for the same dead control.
 *
 * Everything is asserted on the bag (`useListingComposer`) rather than through
 * a rendered page: these are decisions about the DRAFT, and the draft is what
 * the wire carries.
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { VocabularyClientProvider, toFeaturesDto } from "@stapel/attributes-react";
import type { FeatureDef, VocabularyClient } from "@stapel/attributes-react";
import { BUILTIN_VALUE_EDITOR_TYPES } from "@stapel/attributes-react/default";
import { useListingComposer } from "../src/index.js";
import { LISTINGS_I18N_KEYS } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";

const SEEDED: readonly FeatureDef[] = [
  {
    slug: "condition",
    name: "Condition",
    config: {
      type: "select",
      maxSelected: 1,
      options: [
        { value: "new", label: "New", default: true },
        { value: "used", label: "Used" },
      ],
    },
  },
  {
    slug: "warranty_months",
    name: "Warranty",
    config: { type: "int", min: 0, max: 60 },
    default: 12,
  },
];

/** Shown and required only for a used item — `mandatory` stays false. */
const SCREEN_STATE: FeatureDef = {
  slug: "screen_state",
  name: "Screen condition",
  config: { type: "string" },
  rules: [
    { effect: "show", when: { all: [{ feature: "condition", op: "in", values: ["used"] }] } },
    { effect: "require", when: { all: [{ feature: "condition", op: "in", values: ["used"] }] } },
  ],
};

/** Mandatory, and removed from the page for a new item. */
const HIDDEN_MANDATORY: FeatureDef = {
  slug: "wear",
  name: "Wear",
  mandatory: true,
  config: { type: "string" },
  rules: [
    { effect: "hide", when: { all: [{ feature: "condition", op: "in", values: ["new"] }] } },
  ],
};

const REF_FEATURE: FeatureDef = {
  slug: "vendor",
  name: "Brand",
  config: {
    type: "ref_select",
    optionsRef: { vocabulary: "avito-phones", level: "Vendor" },
    maxSelected: 1,
  },
};

const CLIENT: VocabularyClient = {
  async search() {
    return [{ code: "apple", label: "Apple" }];
  },
  async resolve() {
    return {};
  },
};

function bagFor(
  features: readonly FeatureDef[],
  options: {
    readonly initialFeatures?: Readonly<Record<string, unknown>>;
    readonly vocabularyClient?: VocabularyClient | null;
  } = {}
) {
  const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
    <TestProviders server={mockServer({})}>
      <VocabularyClientProvider value={options.vocabularyClient ?? null}>
        {children}
      </VocabularyClientProvider>
    </TestProviders>
  );
  return renderHook(
    () =>
      useListingComposer({
        features,
        editorTypes: BUILTIN_VALUE_EDITOR_TYPES,
        category: "phones",
        initialValues: {
          categoryId: "phones",
          description: "A perfectly ordinary description, long enough to pass.",
          ...(options.initialFeatures ? { features: options.initialFeatures } : {}),
        },
      }),
    { wrapper }
  );
}

describe("the category's defaults reach a blank draft", () => {
  it("applies FeatureDef.default and the type's own default when the schema lands", async () => {
    const { result } = bagFor(SEEDED);
    await waitFor(() => {
      expect(result.current.values.features).toEqual({
        condition: ["new"],
        warranty_months: 12,
      });
    });
  });

  it("leaves an answer the draft already has alone — an answer outranks a default", async () => {
    const { result } = bagFor(SEEDED, { initialFeatures: { condition: ["used"] } });
    await waitFor(() => {
      expect(result.current.values.features["warranty_months"]).toBe(12);
    });
    expect(result.current.values.features["condition"]).toEqual(["used"]);
  });

  it("seeds nothing while the schema is still loading", () => {
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
      <TestProviders server={mockServer({})}>{children}</TestProviders>
    );
    const { result } = renderHook(
      () =>
        useListingComposer({
          features: SEEDED,
          featuresLoading: true,
          category: "phones",
          initialValues: { categoryId: "phones" },
        }),
      { wrapper }
    );
    // Seeding against a half-known schema is how a default from the PREVIOUS
    // category ends up in this one's draft.
    expect(result.current.values.features).toEqual({});
  });
});

describe("the publish gate reads the rules, not `mandatory`", () => {
  const features = [SEEDED[0] as FeatureDef, SCREEN_STATE, HIDDEN_MANDATORY];

  it("does not block on a mandatory feature the rules hid", async () => {
    const { result } = bagFor(features, { initialFeatures: { condition: ["new"] } });
    // `wear` is mandatory and is not on the page: blocking here would demand
    // an answer to a question nobody was asked.
    await waitFor(() => expect(result.current.mirror["wear"]).toBeUndefined());
    expect(result.current.publishGate.available).toBe(true);
  });

  it("blocks on a feature a RULE made required, though `mandatory` is false", async () => {
    const { result } = bagFor(features, { initialFeatures: { condition: ["used"] } });
    await waitFor(() =>
      expect(result.current.mirror["screen_state"]?.code).toBe(
        "error.400.feature_mandatory_missing"
      )
    );
    expect(result.current.publishGate.available).toBe(false);
  });

  it("unblocks once that answer is given", async () => {
    const { result } = bagFor(features, {
      // `wear` is answered too: for a USED item the rule stops hiding it, and
      // its own `mandatory: true` applies again — which is the same claim in
      // the other direction.
      initialFeatures: { condition: ["used"], screen_state: "two scratches", wear: "light" },
    });
    await waitFor(() => expect(result.current.mirror["screen_state"]).toBeUndefined());
    expect(result.current.publishGate.available).toBe(true);
  });
});

describe("a composite goes through the composer untouched", () => {
  /**
   * The claim is that the composer needed NO code for the `group` kind: the
   * bag holds a value keyed by slug whatever its shape, `<FeatureFields>`
   * resolves the editor, and the mirror judges the rows. If any of those had
   * special-cased the twelve scalar kinds, this is where it would show.
   */
  const LADDER: FeatureDef = {
    slug: "discount_ladder",
    name: "Wholesale discount",
    mandatory: true,
    config: {
      type: "group",
      fields: [
        { slug: "quantity", name: "From, units", mandatory: true,
          config: { type: "int", min: 1, max: 1000 } },
        { slug: "discount", name: "Discount", config: { type: "int", min: 1, max: 30 } },
      ],
      repeat: { min: 1, max: 5 },
    },
  };

  it("draws with the builtin editors — no unsupported type, no blocked publish", async () => {
    const { result } = bagFor([LADDER], {
      initialFeatures: { discount_ladder: [{ quantity: 10, discount: 5 }] },
    });
    await waitFor(() => expect(result.current.unsupported).toEqual([]));
    expect(BUILTIN_VALUE_EDITOR_TYPES).toContain("group");
    expect(result.current.publishGate.available).toBe(true);
  });

  it("blocks the publish while a mandatory composite is empty, and unblocks on a row", async () => {
    const { result } = bagFor([LADDER]);
    await waitFor(() =>
      expect(result.current.mirror["discount_ladder"]?.code).toBe(
        "error.400.feature_mandatory_missing"
      )
    );
    expect(result.current.publishGate.available).toBe(false);
  });

  it("refuses a cell the CHILD's own bounds refuse", async () => {
    const { result } = bagFor([LADDER], {
      initialFeatures: { discount_ladder: [{ quantity: 10, discount: 99 }] },
    });
    await waitFor(() =>
      expect(result.current.mirror["discount_ladder"]?.code).toBe(
        "error.400.feature_above_maximum"
      )
    );
    expect(result.current.publishGate.available).toBe(false);
  });

  it("puts the table on the wire under the group's own slug", async () => {
    const rows = [{ quantity: 10, discount: 5 }, { quantity: 50, discount: 12 }];
    const { result } = bagFor([LADDER], { initialFeatures: { discount_ladder: rows } });
    await waitFor(() => expect(result.current.unsupported).toEqual([]));
    expect(toFeaturesDto([LADDER], result.current.values.features)).toEqual({
      discount_ladder: { type: "group", value: rows },
    });
  });
});

describe("a missing vocabulary source is an UNSUPPORTED feature", () => {
  it("reports the type and blocks the publish, with the reason named", async () => {
    const { result } = bagFor([REF_FEATURE]);
    await waitFor(() => expect(result.current.unsupported).toEqual(["ref_select"]));
    expect(result.current.publishGate.available).toBe(false);
    // The SAME sentence an unsupported type raises — one dead control, one
    // reason, no second channel.
    expect(result.current.publishGate.block?.code).toBe(
      LISTINGS_I18N_KEYS.composeBlockedUnsupportedType
    );
  });

  it("stops reporting it once a client is in scope", async () => {
    const { result } = bagFor([REF_FEATURE], { vocabularyClient: CLIENT });
    await waitFor(() => expect(result.current.unsupported).toEqual([]));
    expect(result.current.publishGate.available).toBe(true);
  });
});
