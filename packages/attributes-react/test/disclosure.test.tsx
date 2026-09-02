/**
 * Progressive disclosure of dependent fields — the owner's ruling on the car
 * composer: a chained field does not RENDER until its parent has a value.
 * Make/model/generation/modification used to sit on screen at once, and an
 * orphan modification dropdown offered 460–1300 hp with no car chosen.
 *
 * The dependency edge is `config.optionsRef.parentFeature` (ref_select and
 * the vocabulary-backed int alike). Rules `show`/`hide` keep working exactly
 * as before — this is a second gate, not a rewrite of the first.
 */
import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach } from "vitest";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";

import { FeatureFields, featureRowTestId } from "../src/default/index.js";
import { VocabularyClientProvider } from "../src/vocabulary.js";
import type { VocabularyClient } from "../src/vocabulary.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { toFeaturesDto } from "../src/dto.js";
import { undisclosedSlugs } from "../src/disclosure.js";
import type { FeatureDef } from "../src/types.js";
import { feature } from "./fixtures.js";

afterEach(() => cleanup());

const MAKE = feature("make", {
  type: "ref_select",
  optionsRef: { vocabulary: "cars", level: "Make" },
});
const MODEL = feature("model", {
  type: "ref_select",
  optionsRef: { vocabulary: "cars", level: "Model", parentFeature: "make" },
});
const YEAR = feature("year", {
  type: "int",
  min: 1900,
  max: 2027,
  optionsRef: { vocabulary: "cars", level: "Year", parentFeature: "model" },
});
const PRICE = feature("price", { type: "int", min: 0 });
const CAR = [MAKE, MODEL, YEAR, PRICE];

function client(): VocabularyClient {
  return {
    search: async () => [],
    resolve: async () => ({}),
  };
}

function wrap(node: ReactElement): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  return (
    <I18nProvider i18n={i18n}>
      <VocabularyClientProvider value={client()}>{node}</VocabularyClientProvider>
    </I18nProvider>
  );
}

function renderCar(values: Record<string, unknown>) {
  const onChange = vi.fn();
  const view = render(
    wrap(<FeatureFields features={CAR} values={values} onChange={onChange} />)
  );
  const rerenderCar = (next: Record<string, unknown>): void =>
    view.rerender(
      wrap(<FeatureFields features={CAR} values={next} onChange={onChange} />)
    );
  return { onChange, rerenderCar };
}

describe("progressive disclosure", () => {
  it("renders only parentless fields while nothing is selected", () => {
    renderCar({});
    expect(screen.getByTestId(featureRowTestId("make"))).toBeTruthy();
    expect(screen.getByTestId(featureRowTestId("price"))).toBeTruthy();
    expect(screen.queryByTestId(featureRowTestId("model"))).toBeNull();
    expect(screen.queryByTestId(featureRowTestId("year"))).toBeNull();
  });

  it("reveals the child once the parent is answered, one rung at a time", () => {
    renderCar({ make: ["bmw"] });
    expect(screen.getByTestId(featureRowTestId("model"))).toBeTruthy();
    // year hangs off model, which is still empty
    expect(screen.queryByTestId(featureRowTestId("year"))).toBeNull();
  });

  it("hides the child again and drops its value when the parent is cleared", async () => {
    const { onChange, rerenderCar } = renderCar({ make: ["bmw"], model: ["m3"] });
    expect(screen.getByTestId(featureRowTestId("model"))).toBeTruthy();
    rerenderCar({ model: ["m3"] });
    expect(screen.queryByTestId(featureRowTestId("model"))).toBeNull();
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("model", undefined);
    });
  });

  it("resets the child when the parent MOVES, not only when it empties", async () => {
    const { onChange, rerenderCar } = renderCar({ make: ["bmw"], model: ["m3"] });
    rerenderCar({ make: ["audi"], model: ["m3"] });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("model", undefined);
    });
  });

  it("does not gate on a parent slug the feature set does not define", () => {
    const stray = feature("stray", {
      type: "ref_select",
      optionsRef: { vocabulary: "cars", level: "Make", parentFeature: "nope" },
    });
    const onChange = vi.fn();
    render(wrap(<FeatureFields features={[stray]} values={{}} onChange={onChange} />));
    expect(screen.getByTestId(featureRowTestId("stray"))).toBeTruthy();
  });
});

describe("undisclosedSlugs", () => {
  it("names exactly the dependents whose parent is blank", () => {
    expect([...undisclosedSlugs(CAR, {})].sort()).toEqual(["model", "year"]);
    expect([...undisclosedSlugs(CAR, { make: ["bmw"] })]).toEqual(["year"]);
    expect([
      ...undisclosedSlugs(CAR, { make: ["bmw"], model: ["m3"] }),
    ]).toEqual([]);
  });

  it("treats an empty list and an empty string as blank", () => {
    expect(undisclosedSlugs(CAR, { make: [] }).has("model")).toBe(true);
    expect(undisclosedSlugs(CAR, { make: "" }).has("model")).toBe(true);
  });
});

describe("payload", () => {
  it("drops the value of an undisclosed field from the DTO", () => {
    const dto = toFeaturesDto(CAR as readonly FeatureDef[], {
      model: ["m3"],
      price: 100,
    });
    expect(Object.keys(dto)).toEqual(["price"]);
  });

  it("keeps the value once the parent is filled", () => {
    const dto = toFeaturesDto(CAR as readonly FeatureDef[], {
      make: ["bmw"],
      model: ["m3"],
    });
    expect(Object.keys(dto).sort()).toEqual(["make", "model"]);
  });
});
