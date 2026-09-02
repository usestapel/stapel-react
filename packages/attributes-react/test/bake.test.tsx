/**
 * The auto-bake rule: when a live constraint leaves exactly ONE
 * allowed answer, the form commits it as if the person had picked it and the
 * control renders grey and non-interactive — regardless of `mandatory`.
 *
 * Covered collapses:
 *  - a single-choice `select` whose (narrowed) options are down to one —
 *    including a `forbid_option` rule doing the narrowing;
 *  - an `int` whose `limit` rule pins `min === max`;
 *  - a chained `ref_select` whose parent's children number exactly one.
 *
 * And the un-bake: when the collapse stops holding (the controlling value
 * moved), the baked value RESETS — it does not stick as if chosen.
 */
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";

import { FeatureFields } from "../src/default/index.js";
import { VocabularyClientProvider } from "../src/vocabulary.js";
import type { VocabularyClient, VocabularyTerm } from "../src/vocabulary.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import type { FeatureDef } from "../src/types.js";
import { feature } from "./fixtures.js";

afterEach(() => cleanup());

function wrap(node: ReactElement, client?: VocabularyClient): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  const inner =
    client === undefined ? (
      node
    ) : (
      <VocabularyClientProvider value={client}>{node}</VocabularyClientProvider>
    );
  return <I18nProvider i18n={i18n}>{inner}</I18nProvider>;
}

function renderFields(
  features: readonly FeatureDef[],
  values: Record<string, unknown>,
  client?: VocabularyClient
) {
  const onChange = vi.fn();
  const view = render(
    wrap(
      <FeatureFields features={features} values={values} onChange={onChange} />,
      client
    )
  );
  const rerenderWith = (next: Record<string, unknown>): void =>
    view.rerender(
      wrap(
        <FeatureFields features={features} values={next} onChange={onChange} />,
        client
      )
    );
  return { onChange, rerenderWith };
}

const CONDITION = feature("condition", {
  type: "select",
  options: [
    { value: "new", label: "New" },
    { value: "used", label: "Used" },
  ],
  maxSelected: 1,
});

// Under condition=new the "damaged" grade is forbidden, leaving exactly one.
const GRADE = feature(
  "grade",
  {
    type: "select",
    options: [
      { value: "perfect", label: "Perfect" },
      { value: "damaged", label: "Damaged" },
    ],
    maxSelected: 1,
  },
  {
    rules: [
      {
        effect: "forbid_option",
        option: "damaged",
        when: { all: [{ feature: "condition", op: "in", values: ["new"] }] },
      },
    ],
  }
);

describe("select auto-bake", () => {
  it("commits the sole remaining option and greys the control", async () => {
    const { onChange } = renderFields([CONDITION, GRADE], { condition: ["new"] });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("grade", ["perfect"]);
    });
    expect(screen.getByTestId("attributes-baked-grade")).toBeTruthy();
  });

  it("bakes a select that only ever had one option, mandatory or not", async () => {
    const solo = feature("solo", {
      type: "select",
      options: [{ value: "only", label: "Only" }],
      maxSelected: 1,
    });
    const { onChange } = renderFields([solo], {});
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("solo", ["only"]);
    });
  });

  it("never bakes a multi-select — one available option is not one answer", async () => {
    const multi = feature("extras", {
      type: "select",
      options: [{ value: "roof", label: "Roof rack" }],
      maxSelected: null,
    });
    const { onChange } = renderFields([multi], {});
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("un-bakes when the collapse stops holding: the value resets, it does not stick", async () => {
    const { onChange, rerenderWith } = renderFields([CONDITION, GRADE], {
      condition: ["new"],
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("grade", ["perfect"]);
    });
    // The host applied the bake, then the person changed the controller.
    rerenderWith({ condition: ["used"], grade: ["perfect"] });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("grade", undefined);
    });
  });

  it("leaves a value the person picked themselves alone when options widen", async () => {
    // grade was answered while both options stood — no bake ever happened —
    // so a controller change must NOT clear it.
    const { onChange, rerenderWith } = renderFields([CONDITION, GRADE], {
      condition: ["used"],
      grade: ["damaged"],
    });
    rerenderWith({ condition: [], grade: ["damaged"] });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onChange).not.toHaveBeenCalledWith("grade", undefined);
  });
});

describe("int limit collapse", () => {
  const YEAR = feature(
    "year",
    { type: "int", min: 1900, max: 2027 },
    {
      rules: [
        {
          effect: "limit",
          min: 2024,
          max: 2024,
          when: { all: [{ feature: "condition", op: "in", values: ["new"] }] },
        },
      ],
    }
  );

  it("bakes the pinned number", async () => {
    const { onChange } = renderFields([CONDITION, YEAR], { condition: ["new"] });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("year", 2024);
    });
    expect(screen.getByTestId("attributes-baked-year")).toBeTruthy();
  });

  it("un-bakes the pinned number when the limit lifts", async () => {
    const { onChange, rerenderWith } = renderFields([CONDITION, YEAR], {
      condition: ["new"],
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("year", 2024);
    });
    rerenderWith({ condition: ["used"], year: 2024 });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("year", undefined);
    });
  });
});

describe("chained ref_select single child", () => {
  const MAKE = feature("make", {
    type: "ref_select",
    optionsRef: { vocabulary: "cars", level: "Make" },
  });
  const MODEL = feature("model", {
    type: "ref_select",
    optionsRef: { vocabulary: "cars", level: "Model", parentFeature: "make" },
  });

  function carClient(children: Record<string, readonly VocabularyTerm[]>): VocabularyClient {
    return {
      search: async (_vocabulary, level, _query, parent) => {
        if (level === "Make") return [{ code: "lada", label: "Lada" }];
        return children[parent ?? ""] ?? [];
      },
      resolve: async () => ({}),
    };
  }

  it("probes the rung when the parent lands and bakes a single child", async () => {
    const { onChange } = renderFields(
      [MAKE, MODEL],
      { make: ["lada"] },
      carClient({ lada: [{ code: "granta", label: "Granta" }] })
    );
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("model", ["granta"]);
    });
    expect(screen.getByTestId("attributes-baked-model")).toBeTruthy();
  });

  it("offers the picker untouched when the parent has several children", async () => {
    const { onChange } = renderFields(
      [MAKE, MODEL],
      { make: ["lada"] },
      carClient({
        lada: [
          { code: "granta", label: "Granta" },
          { code: "vesta", label: "Vesta" },
        ],
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("attributes-baked-model")).toBeNull();
  });
});
