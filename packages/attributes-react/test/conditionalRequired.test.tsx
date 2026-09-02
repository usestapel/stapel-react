/**
 * A CONDITIONALLY required field must look conditional and be enforced
 * conditionally — and the two must be the same verdict.
 *
 * Measured on a live composer: a field whose help text read "required if you
 * said the box is included" carried the asterisk with the controlling field
 * still empty, and the step's "Next" refused, naming it. The only way past it
 * was to answer it falsely. Requiredness there is rule-driven, so an
 * unsatisfied condition means NOT required — no marker, no refusal.
 *
 * The marker (`<FeatureFields>`), the mirror (`mirrorValidate`) and the
 * host-facing list (`missingRequiredFeatures`) all call
 * `featureRequiredUnder` against the evaluated state, so this file asserts
 * them together in the same frame: agreeing by construction is the only way
 * they stay agreed.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import {
  hasVisibleFields,
  missingRequiredFeatures,
  mirrorValidate,
  toFeaturesDto,
  visibleFeatureGroups,
  visibleFeatures,
} from "../src/index.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import {
  FeatureFields,
  featureRowTestId,
  featureSections,
} from "../src/default/FeatureFields.js";
import type { FeatureDef } from "../src/types.js";
import { HEADER_FEATURE, feature } from "./fixtures.js";

afterEach(() => cleanup());

function wrap(node: ReactElement): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

/** What is on the seller's screen: the "…" list and the field whose
 * requiredness hangs off it. */
const CONTENTS = feature("contents", {
  type: "select",
  maxSelected: 1,
  options: [
    { label: "Box included", value: "box" },
    { label: "Charger only", value: "charger" },
  ],
});

const BOX_SIZE = feature(
  "box_size",
  { type: "string", maxLength: 40 },
  {
    // `mandatory` is FALSE. The catalogue says the requiredness is a rule.
    mandatory: false,
    rules: [
      {
        effect: "require",
        when: { all: [{ feature: "contents", op: "in", values: ["box"] }] },
      },
    ],
  }
);

const SHEET: readonly FeatureDef[] = [CONTENTS, BOX_SIZE];

/** The three readings of "is this required", in one frame. */
function readFrame(values: Readonly<Record<string, unknown>>): {
  markers: number;
  missing: readonly string[];
  refused: readonly string[];
} {
  const { container } = render(
    wrap(<FeatureFields features={SHEET} values={values} onChange={() => {}} />)
  );
  const verdict = mirrorValidate(SHEET, toFeaturesDto(SHEET, values));
  return {
    markers: container.querySelectorAll(".ant-form-item-required").length,
    missing: missingRequiredFeatures(SHEET, values).map((one) => one.slug),
    refused: verdict.results
      .filter((row) => row.status !== "ok")
      .map((row) => row.slug),
  };
}

describe("a rule-driven requirement with its condition UNMET", () => {
  it("draws no asterisk, is not reported missing, and blocks nothing", () => {
    const frame = readFrame({});
    expect(frame.markers).toBe(0);
    expect(frame.missing).toEqual([]);
    expect(frame.refused).toEqual([]);
  });

  it("stays optional while the controlling answer is some OTHER value", () => {
    const frame = readFrame({ contents: ["charger"] });
    expect(frame.markers).toBe(0);
    expect(frame.missing).toEqual([]);
    expect(frame.refused).toEqual([]);
  });
});

describe("the same field once the condition is MET", () => {
  it("turns the marker, the missing list and the refusal on together", () => {
    const frame = readFrame({ contents: ["box"] });
    expect(frame.markers).toBe(1);
    expect(frame.missing).toEqual(["box_size"]);
    expect(frame.refused).toEqual(["box_size"]);
  });

  it("goes quiet again as soon as it is answered", () => {
    const frame = readFrame({ contents: ["box"], box_size: "20x30x10" });
    expect(frame.markers).toBe(1); // still required — and now satisfied
    expect(frame.missing).toEqual([]);
    expect(frame.refused).toEqual([]);
  });
});

describe("a field a rule HIDES is never demanded", () => {
  const HIDDEN = feature(
    "imei",
    { type: "string" },
    {
      mandatory: true,
      rules: [
        {
          effect: "hide",
          when: { all: [{ feature: "contents", op: "in", values: ["charger"] }] },
        },
      ],
    }
  );
  const sheet = [CONTENTS, HIDDEN];

  it("draws no row, marks nothing and refuses nothing — mandatory or not", () => {
    const values = { contents: ["charger"] };
    const { container, queryByTestId } = render(
      wrap(<FeatureFields features={sheet} values={values} onChange={() => {}} />)
    );
    expect(queryByTestId(featureRowTestId("imei"))).toBeNull();
    expect(container.querySelectorAll(".ant-form-item-required")).toHaveLength(0);
    expect(missingRequiredFeatures(sheet, values)).toEqual([]);
    expect(mirrorValidate(sheet, toFeaturesDto(sheet, values)).valid).toBe(true);
  });

  it("demands it the moment the rule stops hiding it", () => {
    const values = { contents: ["box"] };
    expect(missingRequiredFeatures(sheet, values).map((one) => one.slug)).toEqual([
      "imei",
    ]);
    expect(mirrorValidate(sheet, toFeaturesDto(sheet, values)).valid).toBe(false);
  });
});

describe("a field waiting on its PARENT is never demanded either", () => {
  // Progressive disclosure is the second gate: the row is not on screen, its
  // value is not in the payload, and a step must not refuse over it.
  const MAKE = feature("make", {
    type: "ref_select",
    optionsRef: { vocabulary: "cars", level: "Make" },
  });
  const MODEL = feature(
    "model",
    {
      type: "ref_select",
      optionsRef: { vocabulary: "cars", level: "Model", parentFeature: "make" },
    },
    { mandatory: true }
  );
  const sheet = [MAKE, MODEL];

  it("is absent from the missing list and from the mirror's refusals", () => {
    expect(missingRequiredFeatures(sheet, {})).toEqual([]);
    expect(mirrorValidate(sheet, toFeaturesDto(sheet, {})).valid).toBe(true);
  });

  it("is demanded once the parent reveals it", () => {
    const values = { make: ["bmw"] };
    expect(missingRequiredFeatures(sheet, values).map((one) => one.slug)).toEqual([
      "model",
    ]);
    expect(mirrorValidate(sheet, toFeaturesDto(sheet, values)).valid).toBe(false);
  });
});

describe("does this block have anything to ask? (the step-ladder predicate)", () => {
  const shownWhenBox = (slug: string): FeatureDef =>
    feature(
      slug,
      { type: "string" },
      {
        group: "Parcel",
        rules: [
          {
            effect: "show",
            when: { all: [{ feature: "contents", op: "in", values: ["box"] }] },
          },
        ],
      }
    );
  // One block, every field of it behind the same condition — and the
  // controlling answer lives OUTSIDE the block, which is the usual shape.
  const parcel = [shownWhenBox("box_width"), shownWhenBox("box_height")];
  const sheet: readonly FeatureDef[] = [CONTENTS, ...parcel];

  it("a block whose fields are ALL rule-hidden is not a step", () => {
    expect(visibleFeatureGroups(sheet, {}).map((one) => one.group)).toEqual([""]);
    expect(hasVisibleFields(parcel, { contents: ["box"] })).toBe(false);
  });

  it("becomes a step again once the condition is satisfied", () => {
    const groups = visibleFeatureGroups(sheet, { contents: ["box"] });
    expect(groups.map((one) => one.group)).toEqual(["", "Parcel"]);
    expect(groups[1]?.features.map((one) => one.slug)).toEqual([
      "box_width",
      "box_height",
    ]);
  });

  it("evaluates the condition against the WHOLE sheet, block by block", () => {
    // Handed the block alone, `contents` is not a defined slug and reads as
    // unanswered — which is why the group helper takes the full set.
    expect(hasVisibleFields(sheet, { contents: ["box"] })).toBe(true);
    expect(visibleFeatures(sheet, { contents: ["box"] }).map((one) => one.slug)).toEqual(
      ["contents", "box_width", "box_height"]
    );
  });

  it("a block of nothing but headings asks nothing — a caption is not a question", () => {
    expect(visibleFeatures([HEADER_FEATURE], {})).toHaveLength(1);
    expect(hasVisibleFields([HEADER_FEATURE], {})).toBe(false);
    expect(visibleFeatureGroups([HEADER_FEATURE], {})).toEqual([]);
  });

  it("does not count a field that is still waiting on its parent", () => {
    const make = feature("make", {
      type: "ref_select",
      optionsRef: { vocabulary: "cars", level: "Make" },
    });
    const model = feature("model", {
      type: "ref_select",
      optionsRef: { vocabulary: "cars", level: "Model", parentFeature: "make" },
    });
    expect(visibleFeatures([make, model], {}).map((one) => one.slug)).toEqual(["make"]);
    expect(visibleFeatures([make, model], { make: ["bmw"] }).map((one) => one.slug)).toEqual(
      ["make", "model"]
    );
  });

  it("the groups it reports are the sections the skin draws", () => {
    const values = { contents: ["box"] };
    const drawn = featureSections(visibleFeatures(sheet, values))
      .filter((section) => section.rows.length > 0)
      .map((section) => section.group);
    expect(visibleFeatureGroups(sheet, values).map((one) => one.group)).toEqual(drawn);
  });
});
