/**
 * The vocabulary-backed int (`IntConfig.optionsRef`) — the year-of-make field
 * scoped by the chosen generation. The owner's ruling, final shape (together,
 * not instead): the keypad stays AND a dropdown of the allowed set rides along.
 *
 *  - typing filters the dropdown (autocomplete over the allowed set);
 *  - a typed number that IS allowed commits and the dropdown goes away;
 *  - a typed number that is NOT allowed shows the FULL set plus a bounds
 *    hint — the dropdown is the recovery path;
 *  - the steppers walk the ALLOWED set (skipping gaps) and grey out at the
 *    ends;
 *  - exactly one allowed value → baked (committed + grey), like any other
 *    single-option collapse;
 *  - the static `min`/`max` range hint is suppressed — the control itself
 *    enforces the live set, prose about it would be the defect again.
 */
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";

import { FeatureFields, featureControlId } from "../src/default/index.js";
import { VocabularyClientProvider } from "../src/vocabulary.js";
import type { VocabularyClient } from "../src/vocabulary.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { feature } from "./fixtures.js";

afterEach(() => cleanup());

const GENERATION = feature("generation", {
  type: "ref_select",
  optionsRef: { vocabulary: "cars", level: "Generation" },
});
const YEAR = feature("year", {
  type: "int",
  min: 1900,
  max: 2027,
  optionsRef: { vocabulary: "cars", level: "Year", parentFeature: "generation" },
});

const YEARS: Record<string, readonly string[]> = {
  g15: ["2008", "2009", "2010", "2011", "2012"],
  solo: ["2020"],
};

function client(): VocabularyClient {
  return {
    search: async (_vocabulary, level, _query, parent) => {
      if (level === "Generation") {
        return [
          { code: "g15", label: "G15 (2008—2012)" },
          { code: "solo", label: "Solo (2020)" },
        ];
      }
      return (YEARS[parent ?? ""] ?? []).map((code) => ({ code, label: code }));
    },
    resolve: async () => ({}),
  };
}

function renderYear(values: Record<string, unknown>) {
  const onChange = vi.fn();
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  const tree = (next: Record<string, unknown>): ReactElement => (
    <I18nProvider i18n={i18n}>
      <VocabularyClientProvider value={client()}>
        <FeatureFields
          features={[GENERATION, YEAR]}
          values={next}
          onChange={onChange}
        />
      </VocabularyClientProvider>
    </I18nProvider>
  );
  const view = render(tree(values));
  return {
    onChange,
    rerenderWith: (next: Record<string, unknown>) => view.rerender(tree(next)),
  };
}

function yearInput(): HTMLInputElement {
  return document.getElementById(featureControlId("year")) as HTMLInputElement;
}

describe("constrained int editor", () => {
  it("keeps the numeric keypad", async () => {
    renderYear({ generation: ["g15"] });
    await waitFor(() => {
      expect(yearInput()).toBeTruthy();
    });
    expect(yearInput().getAttribute("inputmode")).toBe("numeric");
  });

  it("suppresses the static range hint once the live set is on the control", async () => {
    renderYear({ generation: ["g15"] });
    await waitFor(() => expect(yearInput()).toBeTruthy());
    await waitFor(() => {
      expect(screen.getByTestId("attributes-int-step-up")).toBeTruthy();
    });
    expect(screen.queryByText(/1900\s*–\s*2027|1900\s*—\s*2027/)).toBeNull();
  });

  it("typing a prefix filters the dropdown to matching allowed values", async () => {
    renderYear({ generation: ["g15"] });
    await waitFor(() => expect(yearInput()).toBeTruthy());
    fireEvent.change(yearInput(), { target: { value: "201" } });
    const panel = await screen.findByTestId("attributes-int-suggestions");
    const rows = [...panel.querySelectorAll("[data-int-suggestion]")].map(
      (row) => row.textContent
    );
    expect(rows).toEqual(["2010", "2011", "2012"]);
  });

  it("a typed ALLOWED number commits and hides the dropdown", async () => {
    const { onChange } = renderYear({ generation: ["g15"] });
    await waitFor(() => expect(yearInput()).toBeTruthy());
    fireEvent.change(yearInput(), { target: { value: "2010" } });
    expect(onChange).toHaveBeenCalledWith("year", 2010);
    await waitFor(() => {
      expect(screen.queryByTestId("attributes-int-suggestions")).toBeNull();
    });
  });

  it("a typed DISALLOWED number opens the full set with a bounds hint", async () => {
    renderYear({ generation: ["g15"] });
    await waitFor(() => expect(yearInput()).toBeTruthy());
    fireEvent.change(yearInput(), { target: { value: "2013" } });
    const panel = await screen.findByTestId("attributes-int-suggestions");
    const rows = [...panel.querySelectorAll("[data-int-suggestion]")].map(
      (row) => row.textContent
    );
    expect(rows).toEqual(["2008", "2009", "2010", "2011", "2012"]);
    const hint = screen.getByTestId("attributes-int-out-of-set");
    expect(hint.textContent).toContain("2008");
    expect(hint.textContent).toContain("2012");
  });

  it("picking a suggestion commits it", async () => {
    const { onChange } = renderYear({ generation: ["g15"] });
    await waitFor(() => expect(yearInput()).toBeTruthy());
    fireEvent.change(yearInput(), { target: { value: "201" } });
    const panel = await screen.findByTestId("attributes-int-suggestions");
    const row = [...panel.querySelectorAll("[data-int-suggestion]")].find(
      (one) => one.textContent === "2011"
    ) as HTMLElement;
    fireEvent.click(row);
    expect(onChange).toHaveBeenCalledWith("year", 2011);
  });

  it("steppers walk the allowed set and grey out at the ends", async () => {
    const { onChange, rerenderWith } = renderYear({
      generation: ["g15"],
      year: 2010,
    });
    const up = await screen.findByTestId("attributes-int-step-up");
    const down = screen.getByTestId("attributes-int-step-down");
    expect(up.hasAttribute("disabled")).toBe(false);
    fireEvent.click(up);
    expect(onChange).toHaveBeenCalledWith("year", 2011);
    // The walk continues from where the person is, not from the stale prop.
    fireEvent.click(down);
    expect(onChange).toHaveBeenLastCalledWith("year", 2010);

    rerenderWith({ generation: ["g15"], year: 2012 });
    await waitFor(() => {
      expect(screen.getByTestId("attributes-int-step-up").hasAttribute("disabled")).toBe(
        true
      );
    });
    rerenderWith({ generation: ["g15"], year: 2008 });
    await waitFor(() => {
      expect(
        screen.getByTestId("attributes-int-step-down").hasAttribute("disabled")
      ).toBe(true);
    });
  });

  it("a single allowed value bakes: committed, grey, non-interactive", async () => {
    const { onChange } = renderYear({ generation: ["solo"] });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("year", 2020);
    });
    expect(screen.getByTestId("attributes-baked-year")).toBeTruthy();
    await waitFor(() => {
      expect(yearInput().hasAttribute("disabled")).toBe(true);
    });
  });

  it("resets the year when the generation moves", async () => {
    const { onChange, rerenderWith } = renderYear({
      generation: ["g15"],
      year: 2010,
    });
    await waitFor(() => expect(yearInput()).toBeTruthy());
    rerenderWith({ generation: ["solo"], year: 2010 });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("year", undefined);
    });
  });
});
