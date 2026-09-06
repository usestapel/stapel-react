/**
 * A chip is NAMED by the words on it — never by the code underneath them.
 *
 * The walker read the deployed composer's accessibility tree and found five
 * chips across two categories announcing their STORAGE CODE while the screen
 * showed a word: the steering-side toggle read out as `levyy` where the
 * screen said "left-hand drive" in Russian, and the same on `sim-esim`,
 * `ne-rabotaet-vspyshka`, `vosstanovlennyy` and `korobka`. Nothing on screen
 * showed it, which is why it survived five passes.
 *
 * `chipOptions` states `ariaLabel` from the resolved label on every chip, and
 * this file is the gate that keeps it stated: it holds a chip's accessible
 * name against its label for every control in this package that draws chips —
 * the single `select`, the multiple one, the required `bool`'s tristate and
 * the closed integer — with options whose label differs from their value in
 * every character, so a fallback to the code cannot pass by looking similar.
 */
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";

import { FeatureFields } from "../src/default/index.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import type { FeatureDef } from "../src/types.js";
import { feature } from "./fixtures.js";

afterEach(() => cleanup());

/**
 * The narrow COLUMN, mocked where `useElementWidth` reads it. The touch floor
 * is `<FeatureFields>`'s own measurement of the column it draws in — an outer
 * provider cannot stand in for it, because the component publishes its own
 * answer over any it was handed.
 */
const realRect = Element.prototype.getBoundingClientRect;

function installColumnWidth(width: number): void {
  Element.prototype.getBoundingClientRect = function rect(): DOMRect {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: width,
      width,
      height: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
});

/** The car walk's own field: two options whose labels share no character with
 * their codes, so "the name is the label" and "the name is the code" cannot
 * be confused for one another. */
const WHEEL: FeatureDef = feature("wheel_type", {
  type: "select",
  maxSelected: 1,
  translatable_options: false,
  options: [
    { value: "levyy", label: "Левый" },
    { value: "pravyy", label: "Правый" },
  ],
});

/** The phone walk's: a multiple choice whose first option is the one the
 * report caught (`sim-esim` announced over "SIM + eSIM"). */
const SIM: FeatureDef = feature("sim_config", {
  type: "select",
  translatable_options: false,
  options: [
    { value: "sim-esim", label: "SIM + eSIM" },
    { value: "2-sim", label: "2 SIM" },
    { value: "1-sim", label: "1 SIM" },
  ],
});

/** A required bool is two chips, and its captions are translation KEYS. */
const REFURBISHED: FeatureDef = feature(
  "refurbished",
  { type: "bool", trueLabel: "feature.refurbished.yes", falseLabel: "feature.refurbished.no" },
  { mandatory: true }
);

/** A closed integer list: chips again, with a prefix and a unit around the
 * label — the name follows what is DRAWN, affixes and all. */
const DOORS: FeatureDef = feature("doors", {
  type: "int",
  allowCustom: false,
  translatable_options: false,
  options: [
    { value: "3", label: "три" },
    { value: "5", label: "пять" },
  ],
});

function renderFields(features: readonly FeatureDef[], values: Record<string, unknown> = {}) {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  i18n.registerBundle("en", {
    "feature.refurbished.yes": "Восстановленный",
    "feature.refurbished.no": "Как новый",
  });
  const tree: ReactElement = (
    <I18nProvider i18n={i18n}>
      <FeatureFields features={features} values={values} onChange={() => undefined} />
    </I18nProvider>
  );
  return render(tree);
}

/** Every chip of ONE FIELD, as `[stored code, accessible name]`. Addressed by
 * the field's row rather than by the chips' own test id, because two select
 * fields on a form carry the same one — and the defect this file gates is a
 * per-FIELD fact. The name is `aria-label` where there is one and the chip's
 * own text where there is not: the accname computation's own order, for the
 * two rungs that can apply to a `<button>` holding text. */
function chipNames(slug: string): readonly (readonly [string, string])[] {
  const row = screen.getByTestId(`attributes-row-${slug}`);
  return [...row.querySelectorAll<HTMLElement>("[data-stapel-chip]")].map(
    (chip) =>
      [
        chip.getAttribute("data-stapel-chip") ?? "",
        chip.getAttribute("aria-label") ?? chip.textContent ?? "",
      ] as const
  );
}

describe("a chip's accessible name is its label, never its slug", () => {
  it("names every chip of a single select — the walker's own field", () => {
    renderFields([WHEEL]);
    expect(chipNames("wheel_type")).toEqual([
      ["levyy", "Левый"],
      ["pravyy", "Правый"],
    ]);
  });

  it("names every chip of a multiple select", () => {
    renderFields([SIM]);
    expect(chipNames("sim_config")).toEqual([
      ["sim-esim", "SIM + eSIM"],
      ["2-sim", "2 SIM"],
      ["1-sim", "1 SIM"],
    ]);
  });

  it("names the two chips of a required bool through the catalogue", () => {
    renderFields([REFURBISHED]);
    expect(chipNames("refurbished")).toEqual([
      ["yes", "Восстановленный"],
      ["no", "Как новый"],
    ]);
  });

  it("names the chips of a closed integer list", () => {
    renderFields([DOORS]);
    expect(chipNames("doors")).toEqual([
      ["3", "три"],
      ["5", "пять"],
    ]);
  });

  /**
   * The rung the defect actually came down: the chip carrying the field's
   * `id` is the one whose name a `<label htmlFor>` would otherwise take over,
   * so it is the one the substrate names from `option.value` when the caller
   * states nothing. It must be named like every other chip.
   */
  it("names the id-carrying chip too, and never after the code", () => {
    renderFields([WHEEL]);
    const first = screen
      .getByTestId("attributes-select-chips")
      .querySelector<HTMLElement>("[data-stapel-chip]");
    expect(first?.getAttribute("data-stapel-chip")).toBe("levyy");
    expect(first?.hasAttribute("id")).toBe(true);
    expect(first?.getAttribute("aria-label")).toBe("Левый");
  });

  /**
   * The shape the defect came in. Inside a narrow column `chipOptions` wraps
   * every label in a `<span>` for the 44px tap target — and a label that is a
   * NODE has no string form the substrate is entitled to invent, so the chip
   * carrying the field's `id` fell through to `option.value`. The words are
   * still on screen either way; only the name changes, which is why five
   * passes walked past it.
   */
  it("names the chips of a narrow column, where the label is a node", async () => {
    installColumnWidth(360);
    renderFields([WHEEL]);
    const row = screen.getByTestId("attributes-row-wheel_type");
    await waitFor(() =>
      expect(row.querySelector("[data-attributes-touch-floor]")).not.toBeNull()
    );
    expect(chipNames("wheel_type")).toEqual([
      ["levyy", "Левый"],
      ["pravyy", "Правый"],
    ]);
    // …and the words are on screen as well as in the name.
    expect(
      [...row.querySelectorAll("[data-stapel-chip]")].map((chip) => chip.textContent)
    ).toEqual(["Левый", "Правый"]);
  });

  it("puts no storage code anywhere a reader can meet it", () => {
    renderFields([WHEEL, SIM, REFURBISHED, DOORS]);
    for (const [code, name] of [
      ...chipNames("wheel_type"),
      ...chipNames("sim_config"),
      ...chipNames("refurbished"),
      ...chipNames("doors"),
    ]) {
      expect(name).not.toBe(code);
    }
  });
});
