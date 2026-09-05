/**
 * The PICKERS, one claim per kind — the half a screenshot cannot make.
 *
 * Every case here is a sentence the rework promised a person filling in a
 * form, asserted through the affordance they would actually use:
 *
 *  - a short closed list is chips, and a chip's answer is still a LIST;
 *  - a long one is a sheet whose commit button says how many are about to be
 *    kept;
 *  - a cap switches the remaining chips off WITH the reason, instead of
 *    letting a fourth answer through to a refusal;
 *  - an unanswered required bool is neither yes nor no;
 *  - a bound is a hint and nothing rewrites what was typed;
 *  - a pasted code loses its spaces at the paste, not at the refusal;
 *  - a chain's rung says which answer it is waiting for, and echoes the path
 *    that has been chosen;
 *  - the codes a person picks come back to the top of the next sheet;
 *  - a row cap keeps its button and states itself.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { COUNTER_TESTID, PICKER_DONE_TESTID, PICKER_SEARCH_TESTID } from "@stapel/tokens-antd/skin";
import type { FeatureDef } from "../src/types.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { VocabularyClientProvider } from "../src/vocabulary.js";
import type { VocabularyClient, VocabularyTerm } from "../src/vocabulary.js";
import { FeatureFields } from "../src/default/FeatureFields.js";
import { chipOptions } from "../src/default/editorKit.js";
import { pathEcho, recentsScope } from "../src/default/editorsRef.js";
import { looksLikeCode } from "../src/default/editorsText.js";
import {
  GROUP_FEATURE,
  INT_FEATURE,
  LONG_MULTI_FEATURE,
  LONG_SELECT_FEATURE,
  MULTI_SELECT_FEATURE,
  REQUIRED_BOOL_FEATURE,
  VIN_FEATURE,
  feature,
} from "./fixtures.js";

afterEach(() => cleanup());

function renderOne(
  f: FeatureDef,
  value?: unknown,
  client: VocabularyClient | null = null
): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  const node: ReactElement = (
    <I18nProvider i18n={i18n}>
      <VocabularyClientProvider value={client}>
        <FeatureFields
          features={[f]}
          values={value === undefined ? {} : { [f.slug]: value }}
          onChange={(slug, next) => onChange(slug, next)}
        />
      </VocabularyClientProvider>
    </I18nProvider>
  );
  render(node);
  return { onChange };
}

function rows(): readonly HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("[data-stapel-picker-row]"));
}

function row(label: string): HTMLButtonElement {
  const found = rows().find((node) => (node.textContent ?? "").includes(label));
  if (found === undefined) throw new Error(`no sheet row for ${label}`);
  return found;
}

/** The sheet's sections, in the order a thumb meets them. */
function sections(): readonly string[] {
  return Array.from(document.querySelectorAll("[data-stapel-picker-list] > div")).map(
    (node) => node.textContent ?? ""
  );
}

// ── select ──────────────────────────────────────────────────────────────────

describe("a short closed list is chips", () => {
  it("emits a LIST from one chip, and never opens anything", () => {
    const { onChange } = renderOne(MULTI_SELECT_FEATURE);
    expect(screen.queryByTestId("attributes-select-trigger")).toBeNull();
    fireEvent.click(screen.getByText("ABS"));
    expect(onChange).toHaveBeenCalledWith("extras", ["abs"]);
  });

  it("switches the remaining chips off AT the cap, with the reason as text", () => {
    // `maxSelected: 3`, three chosen. The fourth chip is not merely absent
    // from the answer — it cannot be pressed, and the row says why.
    const { onChange } = renderOne(MULTI_SELECT_FEATURE, ["abs", "esp", "ac"]);
    const spare = screen.getByText("Sunroof").closest("button") as HTMLButtonElement;
    // `aria-disabled` and alive: a chip at the cap keeps firing so the row's
    // sentence reaches a keyboard. The TAP is what is refused, below.
    expect(spare.getAttribute("aria-disabled")).toBe("true");
    expect(spare.disabled).toBe(false);
    expect(screen.getAllByText("Choose at most 3.").length).toBeGreaterThan(0);
    fireEvent.click(spare);
    expect(onChange).not.toHaveBeenCalled();
    // A chosen chip stays live: the cap must not trap a mis-tap.
    fireEvent.click(screen.getByText("ABS"));
    expect(onChange).toHaveBeenCalledWith("extras", ["esp", "ac"]);
  });
});

describe("a long closed list is a sheet", () => {
  it("opens on the field, answers on one tap, and closes", () => {
    const { onChange } = renderOne(LONG_SELECT_FEATURE);
    expect(rows()).toHaveLength(0);
    fireEvent.click(screen.getByTestId("attributes-select-trigger"));
    expect(rows().length).toBe(8);
    fireEvent.click(row("Harbour office"));
    expect(onChange).toHaveBeenCalledWith("city", ["harbour"]);
  });

  it("filters locally — every option is already here", () => {
    renderOne(LONG_SELECT_FEATURE);
    fireEvent.click(screen.getByTestId("attributes-select-trigger"));
    fireEvent.change(screen.getByTestId(PICKER_SEARCH_TESTID), { target: { value: "gate" } });
    expect(rows().map((node) => node.textContent)).toEqual(["North gate", "South gate"]);
  });

  it("carries the count of what is about to be kept on the commit button", () => {
    const { onChange } = renderOne(LONG_MULTI_FEATURE, ["north"]);
    fireEvent.click(screen.getByTestId("attributes-select-trigger"));
    const done = (): HTMLElement => screen.getByTestId(PICKER_DONE_TESTID);
    // Seeded with what the field holds, and counted honestly from there.
    expect(done().textContent).toBe("Done · 1");
    fireEvent.click(row("West yard"));
    expect(done().textContent).toBe("Done · 2");
    // Nothing is reported until the button is pressed: the draft is the
    // sheet's, and dismissing it discards the draft.
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(done());
    expect(onChange).toHaveBeenCalledWith("stops", ["north", "west"]);
  });
});

// ── bool ────────────────────────────────────────────────────────────────────

describe("an unanswered required bool is neither yes nor no", () => {
  it("presses neither chip until one is tapped", () => {
    const { onChange } = renderOne(REQUIRED_BOOL_FEATURE);
    const group = screen.getByTestId("attributes-bool-tristate");
    const chips = Array.from(group.querySelectorAll("button"));
    expect(chips.map((chip) => chip.getAttribute("aria-pressed"))).toEqual(["false", "false"]);
    fireEvent.click(screen.getByText("No"));
    expect(onChange).toHaveBeenCalledWith("roadworthy", false);
  });

  it("says so in one attribute, so unanswered and false are not one state", () => {
    renderOne(REQUIRED_BOOL_FEATURE);
    expect(document.querySelector("[data-attributes-bool]")?.getAttribute("data-attributes-bool")).toBe(
      "unanswered"
    );
    cleanup();
    renderOne(REQUIRED_BOOL_FEATURE, false);
    expect(document.querySelector("[data-attributes-bool]")?.getAttribute("data-attributes-bool")).toBe(
      "false"
    );
    expect(screen.getByText("No").getAttribute("aria-pressed")).toBe("true");
  });

  it("leaves an OPTIONAL bool on the switch — a false default is real there", () => {
    renderOne({ ...REQUIRED_BOOL_FEATURE, mandatory: false });
    expect(screen.getByRole("switch")).toBeDefined();
    expect(screen.queryByTestId("attributes-bool-tristate")).toBeNull();
  });
});

// ── numbers ─────────────────────────────────────────────────────────────────

describe("a bound is a hint, never a clamp", () => {
  it("keeps an out-of-range number exactly as typed", () => {
    const { onChange } = renderOne(INT_FEATURE);
    const box = screen.getByLabelText("year") as HTMLInputElement;
    // min 1900: typing towards 1950 passes through 1 and 19, and an
    // InputNumber would have rewritten both.
    fireEvent.change(box, { target: { value: "19" } });
    expect(onChange).toHaveBeenLastCalledWith("year", 19);
    expect(box.value).toBe("19");
    fireEvent.blur(box);
    expect(box.value).toBe("19");
    expect(onChange).toHaveBeenLastCalledWith("year", 19);
  });

  it("shows the range instead, as the empty box's placeholder", () => {
    renderOne(INT_FEATURE);
    expect(screen.getByLabelText("year").getAttribute("placeholder")).toBe("1900–2030");
    expect(screen.getByText("From 1900 to 2030.")).toBeDefined();
  });

  it("raises the numeric keypad on a phone", () => {
    renderOne(INT_FEATURE);
    expect(screen.getByLabelText("year").getAttribute("inputmode")).toBe("numeric");
  });
});

// ── string ──────────────────────────────────────────────────────────────────

describe("a code is counted, monospaced and stripped on paste", () => {
  it("recognises a code by its config, and prose by the absence of one", () => {
    // A pattern that cannot match a space; or a length that is exactly fixed.
    expect(looksLikeCode("[A-HJ-NPR-Z0-9]{17}", 17, 17, false)).toBe(true);
    expect(looksLikeCode("", 17, 17, false)).toBe(true);
    expect(looksLikeCode("", undefined, 60, false)).toBe(false);
    expect(looksLikeCode("", 4, 60, false)).toBe(false);
    // Prose with a pattern that admits spaces stays prose, and a textarea is
    // never a code.
    expect(looksLikeCode("[A-Za-z ]+", undefined, 32, false)).toBe(false);
    expect(looksLikeCode("", 17, 17, true)).toBe(false);
  });

  it("counts in CODE POINTS and never caps the box", () => {
    renderOne(VIN_FEATURE, "WVWZZZ");
    expect(screen.getByTestId(COUNTER_TESTID).textContent).toBe("6 / 17");
    expect(screen.getByLabelText("vin").getAttribute("maxlength")).toBeNull();
  });

  it("strips the spaces a document's copy brings with it, at the paste", () => {
    const { onChange } = renderOne(VIN_FEATURE);
    const box = screen.getByLabelText("vin");
    fireEvent.paste(box, {
      clipboardData: { getData: () => " WVW ZZZ1KZ AW000001\n" },
    });
    expect(onChange).toHaveBeenCalledWith("vin", "WVWZZZ1KZAW000001");
  });

  it("says the field is not published, at the field", () => {
    renderOne(VIN_FEATURE);
    // The plaque beside the label and the sentence naming the audience — the
    // two halves of what a seller is owed BEFORE typing an identifier.
    expect(screen.getByTestId("attributes-visibility-vin-tag").textContent).toBe("Not published");
    expect(screen.getByTestId("attributes-visibility-vin").textContent).toContain("moderators");
  });
});

// ── the composite ───────────────────────────────────────────────────────────

describe("a row cap keeps its button and states itself", () => {
  it("switches the add button off at repeat.max WITH the reason", () => {
    const full = [1, 2, 3, 4, 5].map((n) => ({ quantity: n * 10, discount: n }));
    renderOne(GROUP_FEATURE, full);
    const add = screen.getByRole("button", { name: "Add row" });
    // `aria-disabled` and alive: the cap's sentence is a thing to read, and a
    // control nobody can reach cannot be read from.
    expect(add.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByTestId("attributes-group-at-max")).toBeDefined();
    expect(screen.getByText("This detail takes at most 5 rows.")).toBeDefined();
  });

  it("says nothing while there is room", () => {
    renderOne(GROUP_FEATURE, [{ quantity: 10, discount: 5 }]);
    expect(
      screen.getByRole("button", { name: "Add row" }).getAttribute("aria-disabled")
    ).toBeNull();
    expect(screen.queryByTestId("attributes-group-at-max")).toBeNull();
  });
});

// ── help ────────────────────────────────────────────────────────────────────

describe("a long help is a disclosure, a short one is a line", () => {
  const long = "x".repeat(200);
  it("folds a paragraph and leaves a sentence alone", () => {
    renderOne(feature("width", { type: "int" }, { description: "Measured at the widest point." }));
    expect(screen.queryByTestId("attributes-help-more")).toBeNull();
    cleanup();
    renderOne(feature("width", { type: "int" }, { description: long }));
    const details = screen.getByTestId("attributes-help-more") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain("How to fill this in");
  });
});

// ── the chain ───────────────────────────────────────────────────────────────

const CAR_TERMS: Readonly<Record<string, readonly VocabularyTerm[]>> = {
  Make: [
    { code: "volkswagen", label: "Volkswagen", has_children: true },
    { code: "skoda", label: "Škoda", has_children: true },
  ],
  "Model:volkswagen": [{ code: "golf", label: "Golf", has_children: true }],
  "Generation:golf": [{ code: "mk7", label: "Mk7" }],
};

function carClient(): VocabularyClient {
  return {
    async search(_vocabulary, level, query, parent) {
      const list = CAR_TERMS[parent === undefined ? level : `${level}:${parent}`] ?? [];
      const needle = query.trim().toLowerCase();
      return needle.length === 0
        ? list
        : list.filter((term) => term.label.toLowerCase().includes(needle));
    },
    async resolve(_vocabulary, _level, codes) {
      const out: Record<string, string> = {};
      for (const list of Object.values(CAR_TERMS)) {
        for (const term of list) if (codes.includes(term.code)) out[term.code] = term.label;
      }
      return out;
    },
  };
}

const CHAIN: FeatureDef = feature("make_model", {
  type: "ref_hierarchical_select",
  vocabulary: "car-models",
  levels: ["Make", "Model", "Generation"],
  minDepth: 1,
  maxDepth: 3,
});

describe("a chain answers one rung at a time", () => {
  it("opens the rung below only once its parent holds an answer", async () => {
    const { onChange } = renderOne(CHAIN, undefined, carClient());
    expect(
      (screen.getByTestId("attributes-ref-rung-trigger-1") as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.click(screen.getByTestId("attributes-ref-rung-trigger-0"));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    fireEvent.click(row("Volkswagen"));
    expect(onChange).toHaveBeenCalledWith("make_model", ["volkswagen"]);
    await waitFor(() =>
      expect(
        (screen.getByTestId("attributes-ref-rung-trigger-1") as HTMLButtonElement).disabled
      ).toBe(false)
    );
    // …and the rung under THAT one is still waiting, on its own reason.
    expect(
      (screen.getByTestId("attributes-ref-rung-trigger-2") as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByText("Choose Model first.")).toBeDefined();
  });

  it("drops what hung under a rung that is answered again", async () => {
    const { onChange } = renderOne(CHAIN, ["volkswagen", "golf", "mk7"], carClient());
    await waitFor(() => expect(screen.getByTestId("attributes-ref-path")).toBeDefined());
    fireEvent.click(screen.getByTestId("attributes-ref-rung-trigger-0"));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    fireEvent.click(row("Škoda"));
    // The model and the generation belonged to the previous make; keeping
    // them would be a refusal waiting to happen at publish time.
    expect(onChange).toHaveBeenCalledWith("make_model", ["skoda"]);
  });

  it("echoes the chosen path in one line, elided in the MIDDLE when long", async () => {
    renderOne(CHAIN, ["volkswagen", "golf", "mk7"], carClient());
    await waitFor(() =>
      expect(screen.getByTestId("attributes-ref-path").textContent).toBe(
        "Volkswagen › Golf › Mk7"
      )
    );
    // Beyond three rungs the ENDS are what identify a path — the make and the
    // trim — so the middle is what goes.
    expect(pathEcho(["Volkswagen", "Golf", "Mk7", "1.6 TDI"])).toBe("Volkswagen › … › 1.6 TDI");
    expect(pathEcho(["Volkswagen"])).toBe("Volkswagen");
  });

  it("keeps a rung's recents apart from another parent's", () => {
    expect(recentsScope("car-models", "Make", undefined)).toBe("attributes.car-models.Make");
    expect(recentsScope("car-models", "Model", "skoda")).toBe(
      "attributes.car-models.Model.skoda"
    );
  });
});

// ── recents ─────────────────────────────────────────────────────────────────

/** A level whose first page does NOT contain the terms a query finds — the
 * only shape in which a recents section is a fact rather than a duplicate of
 * what is already on screen. A 14 962-row level is exactly this shape. */
function bigLevelClient(): VocabularyClient {
  const firstPage: readonly VocabularyTerm[] = [
    { code: "aaa", label: "Alpha" },
    { code: "bbb", label: "Beta" },
  ];
  const deep: readonly VocabularyTerm[] = [
    { code: "zzz", label: "Zeta" },
    { code: "yyy", label: "Yotta" },
  ];
  return {
    async search(_vocabulary, _level, query) {
      const needle = query.trim().toLowerCase();
      if (needle.length === 0) return firstPage;
      return deep.filter((term) => term.label.toLowerCase().includes(needle));
    },
    async resolve(_vocabulary, _level, codes) {
      const out: Record<string, string> = {};
      for (const term of [...firstPage, ...deep]) {
        if (codes.includes(term.code)) out[term.code] = term.label;
      }
      return out;
    },
  };
}

const REMOTE: FeatureDef = feature("vendor", {
  type: "ref_select",
  // A scope of its own, so this file's recents are nobody else's.
  optionsRef: { vocabulary: "recents-suite", level: "Vendor" },
  maxSelected: 1,
});

describe("the codes a person picks come back to the top", () => {
  it("offers them as their own section, most recent first, and only with an empty box", async () => {
    const { onChange } = renderOne(REMOTE, undefined, bigLevelClient());
    const open = async (): Promise<void> => {
      fireEvent.click(screen.getByTestId("attributes-ref-trigger"));
      await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    };
    const search = (query: string): void => {
      fireEvent.change(screen.getByTestId(PICKER_SEARCH_TESTID), { target: { value: query } });
    };

    await open();
    // Nothing picked yet: no section, because an empty one is a heading over
    // nothing.
    expect(sections().some((text) => text.startsWith("Recent"))).toBe(false);
    search("zeta");
    await waitFor(() => expect(rows().some((r) => r.textContent === "Zeta")).toBe(true));
    fireEvent.click(row("Zeta"));
    expect(onChange).toHaveBeenLastCalledWith("vendor", ["zzz"]);

    // Reopen: the pick is remembered, above the level's first page.
    await open();
    await waitFor(() =>
      expect(sections().some((text) => text.startsWith("Recent"))).toBe(true)
    );
    fireEvent.click(screen.getByTestId("attributes-ref-trigger"));
    search("yotta");
    await waitFor(() => expect(rows().some((r) => r.textContent === "Yotta")).toBe(true));
    // With a query in the box the section is gone: rows that do not answer
    // what is typed are the stale-list defect wearing a heading.
    expect(sections().some((text) => text.startsWith("Recent"))).toBe(false);
    fireEvent.click(row("Yotta"));
    expect(onChange).toHaveBeenLastCalledWith("vendor", ["yyy"]);

    await act(async () => {
      await Promise.resolve();
    });
  });
});

// ── ref_select affixes (stapel-attributes 0.9.1) ────────────────────────────

/** A numeric vocabulary level whose one term resolves to its own code as a
 * label — the shape a `Floor` level takes (`"3"` → `"3"`). */
function floorClient(): VocabularyClient {
  return {
    async search() {
      return [{ code: "3", label: "3" }];
    },
    async resolve(_vocabulary, _level, codes) {
      const out: Record<string, string> = {};
      for (const code of codes) out[code] = code;
      return out;
    },
  };
}

const FLOOR: FeatureDef = feature("floor", {
  type: "ref_select",
  optionsRef: { vocabulary: "buildings", level: "Floor" },
  postfix: "эт.",
  maxSelected: 1,
});

describe("ref_select's postfix rides beside the chosen value", () => {
  it("shows the postfix on the picker trigger once the code resolves", async () => {
    renderOne(FLOOR, ["3"], floorClient());
    await waitFor(() =>
      expect(screen.getByTestId("attributes-ref-trigger").textContent).toBe("3 эт.")
    );
  });

  it("shows no affix at all when the config carries none", async () => {
    const plain = feature("floor_plain", {
      type: "ref_select",
      optionsRef: { vocabulary: "buildings", level: "Floor" },
      maxSelected: 1,
    });
    renderOne(plain, ["3"], floorClient());
    await waitFor(() =>
      expect(screen.getByTestId("attributes-ref-trigger").textContent).toBe("3")
    );
  });
});

/**
 * THE CODE LEAKED INTO THE ACCESSIBLE NAME, and the two halves that did it.
 *
 * `chipOptions` wraps every label in a `<span>` under `touchFloor` so a chip
 * is a 44px tap target — which makes the label a NODE. The substrate has no
 * string form for a node, so the chip that carries the field's `id` (which
 * MUST have an explicit `aria-label`, or the row's `<label htmlFor>` overrides
 * its name and the first answer is announced as the question) fell through to
 * `option.value` and was read out as the STORAGE CODE: "b-u" where the screen
 * said "Estate", `4d-sedan` where it said "Sedan". Nothing visible showed it.
 *
 * The plain label is right there in `chipOptions` and nowhere else — it is the
 * one place holding both the words and the node built out of them — so it
 * states `ariaLabel` on every chip.
 */
describe("a chip is named by its LABEL, never by its code", () => {
  const CODED: FeatureDef = feature("body", {
    type: "select",
    translatable_options: false,
    options: [
      { value: "4d-sedan", label: "Sedan" },
      { value: "5d-hatch", label: "Hatchback" },
      { value: "b-u", label: "Estate" },
    ],
  });

  function chip(value: string): HTMLButtonElement {
    const found = document.querySelector(`[data-stapel-chip="${value}"]`);
    if (found === null) throw new Error(`no chip for ${value}`);
    return found as HTMLButtonElement;
  }

  it("names the FIRST chip — the one carrying the field's id — by its label", () => {
    renderOne(CODED);
    const first = chip("4d-sedan");
    // It is the id-carrying chip: without an explicit name the field's own
    // <label for> would override it.
    expect(first.hasAttribute("id")).toBe(true);
    expect(first.getAttribute("aria-label")).toBe("Sedan");
    expect(first.getAttribute("aria-label")).not.toBe("4d-sedan");
  });

  it("names a LATER chip the same way — position is not part of a name", () => {
    renderOne(CODED);
    expect(chip("b-u").getAttribute("aria-label")).toBe("Estate");
  });

  it("states the name where the LABEL BECOMES A NODE — the touch floor", () => {
    // Asserted on `chipOptions` itself, because this is the mechanism: under
    // the 44px floor each label is wrapped in a <span>, and from that moment
    // the plain words exist only here. A chip whose name had to be read off
    // the node is a chip announced as its storage code.
    const options = chipOptions(
      [
        { value: "4d-sedan", label: "Sedan" },
        { value: "b-u", label: "Estate" },
      ],
      { touchFloor: true }
    );
    expect(options.map((one) => one.ariaLabel)).toEqual(["Sedan", "Estate"]);
    // …and the label really is a node, not a string, in this mode.
    expect(typeof options[0]?.label).not.toBe("string");
  });
});
