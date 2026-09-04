/**
 * The BOUNDED int — a year, and every other integer a catalogue or a `limit`
 * rule puts a floor and a ceiling under.
 *
 * The founder's verdict on what this replaces: *the prose was removed but the
 * mechanism for the person was not delivered.* The range was a placeholder
 * and a grey line over a bare text box; a seller could type 1899 into a year
 * scoped to one generation and learn about it from the server. What is pinned
 * here is the mechanism:
 *
 *  - the numeric keypad stays, and nothing typed is ever clamped;
 *  - a dropdown of the allowed values rides along while the range is listable
 *    — typing a valid value hides it, typing an out-of-bounds one opens the
 *    whole set with the bound in words;
 *  - the hint NAMES the answers that set the bound when a `limit` rule did;
 *  - the steppers grey at the ends;
 *  - a bound that moves under an answer CLEARS it, never coerces it;
 *  - one allowed value bakes;
 *  - and the mirror refuses exactly what the control refuses to offer, out of
 *    the same `narrowFeature` call — one source, both sides.
 */
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";

import { FeatureFields, featureControlId } from "../src/default/index.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { featureBounds } from "../src/bounds.js";
import { mirrorValidate } from "../src/validate.js";
import type { FeatureDef } from "../src/types.js";
import { feature } from "./fixtures.js";

afterEach(() => cleanup());

const GENERATION: FeatureDef = feature("generation", {
  type: "select",
  maxSelected: 1,
  translatable_options: false,
  options: [
    { value: "g20", label: "G20" },
    { value: "e90", label: "E90" },
  ],
});

/** The year of a car: the catalogue's own century-wide bound, tightened to
 * the chosen generation's span by a `limit` rule. */
const YEAR: FeatureDef = feature("year", { type: "int", min: 1900, max: 2030 }, {
  rules: [
    {
      effect: "limit",
      min: 2018,
      max: 2024,
      when: { all: [{ feature: "generation", op: "in", values: ["g20"] }] },
    },
    {
      effect: "limit",
      min: 2005,
      max: 2013,
      when: { all: [{ feature: "generation", op: "in", values: ["e90"] }] },
    },
  ],
});

/** One allowed value — the bake. */
const PINNED_YEAR: FeatureDef = feature("year", { type: "int", min: 1900, max: 2030 }, {
  rules: [
    {
      effect: "limit",
      min: 2020,
      max: 2020,
      when: { all: [{ feature: "generation", op: "in", values: ["g20"] }] },
    },
  ],
});

/** Too many values to be a list: keypad and steppers, no dropdown. */
const MILEAGE: FeatureDef = feature("mileage", { type: "int", min: 0, max: 1000000 });

function renderFields(features: readonly FeatureDef[], values: Record<string, unknown>) {
  const onChange = vi.fn();
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  const tree = (next: Record<string, unknown>): ReactElement => (
    <I18nProvider i18n={i18n}>
      <FeatureFields features={features} values={next} onChange={onChange} />
    </I18nProvider>
  );
  const view = render(tree(values));
  return {
    onChange,
    rerenderWith: (next: Record<string, unknown>) => view.rerender(tree(next)),
  };
}

function box(slug: string): HTMLInputElement {
  return document.getElementById(featureControlId(slug)) as HTMLInputElement;
}

function suggestions(): readonly string[] {
  const panel = screen.queryByTestId("attributes-int-suggestions");
  if (panel === null) return [];
  return [...panel.querySelectorAll("[data-int-suggestion]")].map(
    (row) => row.textContent ?? ""
  );
}

describe("the bound as a mechanism, not as prose", () => {
  it("keeps the numeric keypad", () => {
    renderFields([GENERATION, YEAR], {});
    expect(box("year").getAttribute("inputmode")).toBe("numeric");
  });

  it("offers the allowed values as a dropdown beside the keypad", () => {
    renderFields([GENERATION, YEAR], { generation: ["g20"] });
    expect(suggestions()).toEqual([]);
    fireEvent.click(screen.getByTestId("attributes-int-open"));
    expect(suggestions()).toEqual(["2018", "2019", "2020", "2021", "2022", "2023", "2024"]);
  });

  it("typing a valid value commits it and hides the dropdown", () => {
    const { onChange } = renderFields([GENERATION, YEAR], { generation: ["g20"] });
    fireEvent.click(screen.getByTestId("attributes-int-open"));
    expect(suggestions().length).toBe(7);
    fireEvent.change(box("year"), { target: { value: "2021" } });
    expect(onChange).toHaveBeenCalledWith("year", 2021);
    expect(suggestions()).toEqual([]);
    expect(screen.queryByTestId("attributes-int-out-of-range")).toBeNull();
  });

  it("a typed prefix filters the dropdown instead of refusing", () => {
    renderFields([GENERATION, YEAR], { generation: ["g20"] });
    fireEvent.change(box("year"), { target: { value: "202" } });
    expect(suggestions()).toEqual(["2020", "2021", "2022", "2023", "2024"]);
  });

  it("picking a value from the dropdown commits it", () => {
    const { onChange } = renderFields([GENERATION, YEAR], { generation: ["g20"] });
    fireEvent.change(box("year"), { target: { value: "202" } });
    const row = [...document.querySelectorAll("[data-int-suggestion]")].find(
      (one) => one.textContent === "2022"
    ) as HTMLElement;
    fireEvent.click(row);
    expect(onChange).toHaveBeenLastCalledWith("year", 2022);
  });

  it("an out-of-bounds value opens the FULL set and names the answers that set the bound", () => {
    const { onChange } = renderFields([GENERATION, YEAR], { generation: ["g20"] });
    fireEvent.change(box("year"), { target: { value: "1995" } });
    expect(suggestions()).toEqual(["2018", "2019", "2020", "2021", "2022", "2023", "2024"]);
    const hint = screen.getByTestId("attributes-int-out-of-range");
    expect(hint.textContent).toBe("For G20 the value is from 2018 to 2024.");
    // Said, never enforced: what was typed is what the caller is told.
    expect(onChange).toHaveBeenLastCalledWith("year", 1995);
    expect(box("year").value).toBe("1995");
  });

  it("says the range plainly when no rule set it", () => {
    renderFields([MILEAGE], {});
    fireEvent.change(box("mileage"), { target: { value: "2000000" } });
    expect(screen.getByTestId("attributes-int-out-of-range").textContent).toBe(
      "Outside the allowed range — from 0 to 1000000."
    );
  });

  it("draws no dropdown for a range too long to be a list", () => {
    renderFields([MILEAGE], {});
    expect(screen.queryByTestId("attributes-int-open")).toBeNull();
    fireEvent.change(box("mileage"), { target: { value: "2000000" } });
    expect(suggestions()).toEqual([]);
    // …but the steppers and the keypad are still there.
    expect(screen.getByTestId("attributes-int-step-up")).toBeTruthy();
  });

  it("steppers walk by one and grey out at the bounds", () => {
    const { onChange, rerenderWith } = renderFields([GENERATION, YEAR], {
      generation: ["g20"],
      year: 2023,
    });
    const up = screen.getByTestId("attributes-int-step-up");
    expect(up.hasAttribute("disabled")).toBe(false);
    fireEvent.click(up);
    expect(onChange).toHaveBeenLastCalledWith("year", 2024);

    rerenderWith({ generation: ["g20"], year: 2024 });
    expect(screen.getByTestId("attributes-int-step-up").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("attributes-int-step-down").hasAttribute("disabled")).toBe(false);

    rerenderWith({ generation: ["g20"], year: 2018 });
    expect(screen.getByTestId("attributes-int-step-down").hasAttribute("disabled")).toBe(true);
  });

  it("bakes when the bound leaves exactly one value: committed, grey, non-editable", async () => {
    const { onChange } = renderFields([GENERATION, PINNED_YEAR], { generation: ["g20"] });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("year", 2020);
    });
    expect(screen.getByTestId("attributes-baked-year")).toBeTruthy();
    expect(box("year").hasAttribute("disabled")).toBe(true);
    expect(screen.queryByTestId("attributes-int-open")).toBeNull();
  });

  it("CLEARS an answer the moved bound no longer admits — never coerces it", async () => {
    const { onChange, rerenderWith } = renderFields([GENERATION, YEAR], {
      generation: ["e90"],
      year: 2010,
    });
    expect(onChange).not.toHaveBeenCalled();
    rerenderWith({ generation: ["g20"], year: 2010 });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("year", undefined);
    });
    // Not 2018, not 2024, not 2010 kept: cleared, with the reason on screen.
    for (const call of onChange.mock.calls) expect(call).toEqual(["year", undefined]);
    expect(screen.getByTestId("attributes-int-out-of-range").textContent).toBe(
      "For G20 the value is from 2018 to 2024."
    );
  });

  it("keeps an answer the moved bound still admits", async () => {
    const { onChange, rerenderWith } = renderFields([GENERATION, YEAR], {
      generation: ["e90"],
      year: 2010,
    });
    rerenderWith({ generation: [], year: 2010 });
    await waitFor(() => {
      expect(box("year").value).toBe("2010");
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("attributes-int-out-of-range")).toBeNull();
  });

  it("says the bound under the box while the answer fits, and only then", () => {
    renderFields([GENERATION, YEAR], { generation: ["g20"], year: 2020 });
    expect(screen.getByText("From 2018 to 2024.")).toBeTruthy();
    fireEvent.change(box("year"), { target: { value: "1995" } });
    expect(screen.queryByText("From 2018 to 2024.")).toBeNull();
    expect(screen.getByTestId("attributes-int-out-of-range")).toBeTruthy();
  });
});

describe("a dependent field waits for its parent", () => {
  const SHOWN_YEAR: FeatureDef = feature("year", { type: "int", min: 1900, max: 2030 }, {
    rules: [
      {
        effect: "show",
        when: { all: [{ feature: "generation", op: "filled" }] },
      },
    ],
  });

  it("is not drawn at all until the parent is answered", () => {
    const { rerenderWith } = renderFields([GENERATION, SHOWN_YEAR], {});
    expect(box("year")).toBeNull();
    rerenderWith({ generation: ["g20"] });
    expect(box("year")).toBeTruthy();
  });
});

describe("one bound, both sides of the wire", () => {
  it("the mirror refuses exactly what the control would not offer", () => {
    const values = { generation: ["g20"], year: 2010 };
    const { min, max, sources } = featureBounds(YEAR, values);
    expect([min, max]).toEqual([2018, 2024]);
    expect(sources).toEqual(["generation"]);

    const result = mirrorValidate([GENERATION, YEAR], {
      generation: { type: "select", value: ["g20"] },
      year: { type: "int", value: 2010 },
    });
    const year = result.results.find((row) => row.slug === "year");
    expect(year?.error).toBe("below_minimum");

    // …and accepts the value the control does offer.
    const ok = mirrorValidate([GENERATION, YEAR], {
      generation: { type: "select", value: ["g20"] },
      year: { type: "int", value: 2020 },
    });
    expect(ok.valid).toBe(true);
  });

  it("a bound the config never declared is not invented by a rule", () => {
    const open = feature("count", { type: "int", min: 1 }, {
      rules: [
        {
          effect: "limit",
          min: 3,
          max: 9,
          when: { all: [{ feature: "generation", op: "filled" }] },
        },
      ],
    });
    // `max` is not in the config, so the rule cannot introduce one — the same
    // law `narrowConfig` obeys on both sides of the wire.
    expect(featureBounds(open, { generation: ["g20"] })).toEqual({
      min: 3,
      max: undefined,
      sources: ["generation"],
    });
  });

  it("attributes nothing to a rule that did not match", () => {
    expect(featureBounds(YEAR, {})).toEqual({ min: 1900, max: 2030, sources: [] });
  });
});
