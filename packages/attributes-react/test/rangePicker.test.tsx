/**
 * Owner, 2026-09-27 — two rulings on the number editors.
 *
 *  1. A year whose range is DERIVED from other answers (the generation's set
 *     from the vocabulary, or a `limit` rule naming its parents) is PICKED,
 *     not typed: a list of the years in range, newest first.
 *  2. On an EMPTY field that shows a number as its placeholder, the first
 *     press of + or − commits that number; later presses add or subtract from
 *     it (not from 0, not from the bound).
 *
 * Plus the AI-job marks on rows (`pendingSlugs` / `filledSlugs`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";

import { FeatureFields, featureControlId } from "../src/default/index.js";
import { placeholderNumber, stepTargets } from "../src/default/editorsNumber.js";
import { VocabularyClientProvider } from "../src/vocabulary.js";
import type { VocabularyClient } from "../src/vocabulary.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import type { FeatureDef } from "../src/types.js";
import { feature } from "./fixtures.js";

afterEach(() => cleanup());

const GENERATION: FeatureDef = feature("generation", {
  type: "select",
  maxSelected: 1,
  translatable_options: false,
  options: [{ value: "g20", label: "G20" }],
});
const RULE_YEAR: FeatureDef = feature(
  "year",
  { type: "int", min: 1900, max: 2030 },
  {
    rules: [
      {
        effect: "limit",
        min: 2018,
        max: 2024,
        when: { all: [{ feature: "generation", op: "in", values: ["g20"] }] },
      },
    ],
  }
);
const REF_GENERATION: FeatureDef = feature("generation", {
  type: "ref_select",
  optionsRef: { vocabulary: "cars", level: "Generation" },
});
const REF_YEAR: FeatureDef = feature(
  "year",
  {
    type: "int",
    min: 1900,
    max: 2027,
    optionsRef: { vocabulary: "cars", level: "Year", parentFeature: "generation" },
  },
  { example: "2010" }
);
const MILEAGE: FeatureDef = feature(
  "kilometrage",
  { type: "int", min: 1, max: 1000000, postfix: "km" },
  { example: "154000" }
);

function client(fail = false): VocabularyClient {
  return {
    search: async (_vocabulary, level) => {
      if (fail) throw new Error("down");
      if (level === "Generation") return [{ code: "g15", label: "G15" }];
      return ["2008", "2009", "2010", "2011", "2012"].map((code) => ({ code, label: code }));
    },
    resolve: async () => ({}),
  };
}

function renderFields(
  features: readonly FeatureDef[],
  values: Record<string, unknown>,
  extra: { readonly client?: VocabularyClient; readonly pending?: string[]; readonly filled?: string[] } = {}
) {
  const onChange = vi.fn();
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  const tree = (next: Record<string, unknown>): ReactElement => (
    <I18nProvider i18n={i18n}>
      <VocabularyClientProvider value={extra.client ?? client()}>
        <FeatureFields
          features={features}
          values={next}
          onChange={onChange}
          {...(extra.pending !== undefined ? { pendingSlugs: extra.pending } : {})}
          {...(extra.filled !== undefined ? { filledSlugs: extra.filled } : {})}
        />
      </VocabularyClientProvider>
    </I18nProvider>
  );
  const view = render(tree(values));
  return { onChange, rerenderWith: (next: Record<string, unknown>) => view.rerender(tree(next)) };
}

function sheetRows(): readonly string[] {
  return Array.from(document.querySelectorAll("[data-stapel-picker-row]")).map(
    (node) => (node.textContent ?? "").trim()
  );
}

describe("a derived year range is a picker, newest first", () => {
  it("a limit rule's range draws a picker instead of the keypad", () => {
    const { onChange } = renderFields([GENERATION, RULE_YEAR], { generation: ["g20"] });
    const picker = screen.getByTestId("attributes-int-picker");
    expect(picker.id).toBe(featureControlId("year"));
    expect(document.querySelector('[data-testid="attributes-number-field"] input')).toBeNull();
    expect(picker.textContent).toContain("2018–2024");
    fireEvent.click(picker);
    expect(sheetRows()).toEqual(["2024", "2023", "2022", "2021", "2020", "2019", "2018"]);
    fireEvent.click(
      Array.from(document.querySelectorAll("[data-stapel-picker-row]")).find(
        (node) => (node.textContent ?? "").trim() === "2021"
      ) as HTMLElement
    );
    expect(onChange).toHaveBeenLastCalledWith("year", 2021, "user");
  });

  it("the same year with NO derived range stays a keypad", () => {
    renderFields([GENERATION, RULE_YEAR], {});
    expect(screen.queryByTestId("attributes-int-picker")).toBeNull();
    expect(
      (document.getElementById(featureControlId("year")) as HTMLInputElement).getAttribute(
        "inputmode"
      )
    ).toBe("numeric");
  });

  it("the generation's vocabulary set draws a picker, newest first", async () => {
    renderFields([REF_GENERATION, REF_YEAR], { generation: ["g15"] });
    const picker = await screen.findByTestId("attributes-int-picker");
    fireEvent.click(picker);
    expect(sheetRows()).toEqual(["2012", "2011", "2010", "2009", "2008"]);
  });

  it("the picker's steppers start from the placeholder year when it is in the set", async () => {
    const { onChange } = renderFields([REF_GENERATION, REF_YEAR], { generation: ["g15"] });
    await screen.findByTestId("attributes-int-picker");
    fireEvent.click(screen.getByTestId("attributes-int-step-up"));
    expect(onChange).toHaveBeenLastCalledWith("year", 2010, "user");
    fireEvent.click(screen.getByTestId("attributes-int-step-up"));
    expect(onChange).toHaveBeenLastCalledWith("year", 2011, "user");
  });
});

describe("+ and − on an empty field start from its placeholder", () => {
  it("mileage: the first press commits the placeholder, the next adds to it", () => {
    const { onChange, rerenderWith } = renderFields([MILEAGE], {});
    const box = document.getElementById(featureControlId("kilometrage")) as HTMLInputElement;
    expect(box.getAttribute("placeholder")).toBe("154000");
    fireEvent.click(screen.getByTestId("attributes-int-step-up"));
    expect(onChange).toHaveBeenLastCalledWith("kilometrage", 154000, "user");
    fireEvent.click(screen.getByTestId("attributes-int-step-up"));
    expect(onChange).toHaveBeenLastCalledWith("kilometrage", 154001, "user");
    rerenderWith({ kilometrage: 154001 });
    fireEvent.click(screen.getByTestId("attributes-int-step-down"));
    expect(onChange).toHaveBeenLastCalledWith("kilometrage", 154000, "user");
  });

  it("− on an empty field commits the placeholder too, then subtracts", () => {
    const { onChange } = renderFields([MILEAGE], {});
    fireEvent.click(screen.getByTestId("attributes-int-step-down"));
    expect(onChange).toHaveBeenLastCalledWith("kilometrage", 154000, "user");
    fireEvent.click(screen.getByTestId("attributes-int-step-down"));
    expect(onChange).toHaveBeenLastCalledWith("kilometrage", 153999, "user");
  });

  it("a year with no set to walk gets steppers seeded from its placeholder", async () => {
    const { onChange } = renderFields([REF_GENERATION, REF_YEAR], { generation: ["g15"] }, {
      client: client(true),
    });
    await waitFor(() =>
      expect(screen.getByTestId("attributes-int-ref").getAttribute("data-state")).toBe(
        "unbounded"
      )
    );
    fireEvent.click(screen.getByTestId("attributes-int-step-down"));
    expect(onChange).toHaveBeenLastCalledWith("year", 2010, "user");
    fireEvent.click(screen.getByTestId("attributes-int-step-down"));
    expect(onChange).toHaveBeenLastCalledWith("year", 2009, "user");
  });

  it("reads only a single number out of a placeholder", () => {
    expect(placeholderNumber("154 000", true)).toBe(154000);
    expect(placeholderNumber("154 000", true)).toBe(154000);
    expect(placeholderNumber("1–1000000", true)).toBeUndefined();
    expect(placeholderNumber("e.g. 5", true)).toBeUndefined();
    expect(placeholderNumber("2.5", true)).toBeUndefined();
    expect(placeholderNumber("2,5", false)).toBe(2.5);
  });

  it("an out-of-bound placeholder falls back to the nearer end", () => {
    expect(stepTargets(undefined, 5, 10, 20)).toEqual({ up: 10, down: 20 });
    expect(stepTargets(undefined, 15, 10, 20)).toEqual({ up: 15, down: 15 });
    expect(stepTargets(20, 15, 10, 20)).toEqual({ up: undefined, down: 19 });
  });
});

describe("rows a background writer is filling", () => {
  it("marks pending rows busy and leaves them editable", () => {
    const { onChange } = renderFields([MILEAGE], {}, { pending: ["kilometrage"] });
    const row = screen.getByTestId("attributes-row-kilometrage");
    expect(row.hasAttribute("data-attributes-pending")).toBe(true);
    expect(row.getAttribute("aria-busy")).toBe("true");
    const box = document.getElementById(featureControlId("kilometrage")) as HTMLInputElement;
    expect(box.disabled).toBe(false);
    fireEvent.change(box, { target: { value: "90000" } });
    expect(onChange).toHaveBeenLastCalledWith("kilometrage", 90000, "user");
  });

  it("marks just-filled rows for the highlight, and nothing otherwise", () => {
    renderFields([MILEAGE], { kilometrage: 1000 }, { filled: ["kilometrage"] });
    const row = screen.getByTestId("attributes-row-kilometrage");
    expect(row.hasAttribute("data-attributes-filled")).toBe(true);
    expect(row.hasAttribute("data-attributes-pending")).toBe(false);
    cleanup();
    renderFields([MILEAGE], {});
    const plain = screen.getByTestId("attributes-row-kilometrage");
    expect(plain.hasAttribute("data-attributes-filled")).toBe(false);
    expect(plain.hasAttribute("aria-busy")).toBe(false);
  });
});
