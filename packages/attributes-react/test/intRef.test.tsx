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

import {
  BUILTIN_VALUE_EDITORS,
  FeatureFields,
  featureControlId,
} from "../src/default/index.js";
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

/**
 * The two states that used to render as A BARE KEYPAD, and the refusal that
 * used to say only what was wrong.
 *
 * `allowed === null` covered three different situations and the editor drew
 * one control for all of them — a plain number box, no steppers, no list,
 * nothing said. Two of the three are not "there is no set": the fetch is in
 * flight (the steppers are about to appear under the hand), or the parent is
 * unanswered (there is no set to fetch, and the useful thing to say is which
 * field to fill in first). The third — no client, a failed fetch, a capped
 * answer — genuinely is "this side cannot know", and the keypad stays.
 */
describe("the constrained int says which state it is in", () => {
  /**
   * The editor MOUNTED DIRECTLY, which is the only way this state is reached:
   * `<FeatureFields>`' progressive disclosure keeps the year row unmounted
   * until the generation is answered, and this is the case the editor's own
   * comment calls "a host drawing rows itself may not gate".
   */
  function renderBare(props: {
    readonly value?: unknown;
    readonly siblings?: Record<string, unknown>;
    readonly error?: {
      readonly code: string;
      readonly params: Readonly<Record<string, unknown>>;
      readonly status: number | undefined;
      readonly message: string | undefined;
      readonly language: string | undefined;
    };
  }): void {
    const Editor = BUILTIN_VALUE_EDITORS["int"];
    if (Editor === undefined) throw new Error("no int editor");
    const i18n = createI18n({ locale: "en" });
    registerAttributesI18n(i18n);
    render(
      <I18nProvider i18n={i18n}>
        <VocabularyClientProvider value={client()}>
          <Editor
            id="year-control"
            feature={YEAR}
            value={props.value}
            siblings={props.siblings ?? {}}
            siblingNames={{ generation: "Generation", year: "Year" }}
            onChange={() => undefined}
            {...(props.error !== undefined ? { error: props.error } : {})}
          />
        </VocabularyClientProvider>
      </I18nProvider>
    );
  }

  it("switches the keypad off, with its reason, while the parent is unanswered", () => {
    renderBare({});
    const row = screen.getByTestId("attributes-int-ref");
    expect(row.getAttribute("data-state")).toBe("awaiting-parent");
    // The house rule: nothing is switched off silently.
    expect(
      (document.getElementById("year-control") as HTMLInputElement).hasAttribute(
        "disabled"
      )
    ).toBe(true);
    // And no steppers over a set that does not exist.
    expect(screen.queryByTestId("attributes-int-step-up")).toBeNull();
  });

  it("names the parent as a PERSON reads it, not as a slug", () => {
    renderBare({});
    // The sentence comes from the sibling's own NAME (`siblingNames`); the
    // slug `generation` in it would be storage printed at a person, which is
    // the defect class this package is careful about everywhere else.
    expect(
      screen.getByTestId("attributes-int-parent-first").textContent
    ).toBe("Choose Generation first.");
  });

  it("marks itself busy while the allowed set is in flight, then bounded", async () => {
    renderYear({ generation: ["g15"] });
    const row = screen.getByTestId("attributes-int-ref");
    // First frame: the box that is about to gain steppers and a list must not
    // claim to be a free-text number while the constraint is on its way.
    expect(row.getAttribute("data-state")).toBe("loading");
    expect(row.getAttribute("aria-busy")).toBe("true");
    await waitFor(() => {
      expect(
        screen.getByTestId("attributes-int-ref").getAttribute("data-state")
      ).toBe("bounded");
    });
    expect(
      screen.getByTestId("attributes-int-ref").hasAttribute("aria-busy")
    ).toBe(false);
  });

  it("a REFUSAL names the allowed range, not just the fact of being wrong", async () => {
    // The server refused a value this side believes is allowed — its set and
    // the one fetched here were resolved against different snapshots. The
    // refusal alone ("Value is not in allowed options for Year") says the
    // number is wrong and nothing about which number is right.
    renderBare({
      value: 2010,
      siblings: { generation: ["g15"] },
      error: {
        code: "error.400.feature_not_in_options",
        params: {},
        status: 400,
        message: undefined,
        language: undefined,
      },
    });
    const said = await screen.findByTestId("attributes-int-refusal-range");
    expect(said.textContent ?? "").toContain("2008");
    expect(said.textContent ?? "").toContain("2012");
  });

  it("says nothing extra when there is no refusal", async () => {
    renderBare({ value: 2010, siblings: { generation: ["g15"] } });
    await waitFor(() => {
      expect(
        screen.getByTestId("attributes-int-ref").getAttribute("data-state")
      ).toBe("bounded");
    });
    expect(screen.queryByTestId("attributes-int-refusal-range")).toBeNull();
  });
});
