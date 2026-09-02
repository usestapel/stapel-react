/**
 * The RECOMMENDED band of a reference picker.
 *
 * A fifty-row manufacturer level in alphabetical order buries the six makes
 * almost every listing carries. The server decides WHICH terms lead and in
 * what order; this file is the other half — the rendering — and the claims it
 * pins are the ones that break quietly:
 *
 *  1. today's payload carries no flag at all, and must keep drawing ONE plain
 *     list: no heading, no rule, no empty band;
 *  2. a flagged payload draws two bands, recommended first, with a visible
 *     rule between them;
 *  3. search crosses BOTH bands, and a band with no surviving match takes its
 *     heading with it — including the case where only unflagged terms match,
 *     which collapses back to the plain list rather than heading the whole
 *     level "All options";
 *  4. a flagged term that is the field's current answer is still drawn
 *     selected, in its band.
 *
 * The client is stubbed at the SEAM (two functions), as everywhere else in
 * this package — see `test/vocabulary.test.tsx`.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { PICKER_SEARCH_TESTID } from "@stapel/tokens-antd/skin";
import { VocabularyClientProvider, partitionRecommended } from "../src/index.js";
import type { VocabularyClient, VocabularyTerm } from "../src/index.js";
import { ATTRIBUTES_I18N_KEYS, registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields } from "../src/default/FeatureFields.js";
import { REF_SELECT_FEATURE } from "./fixtures.js";

afterEach(() => cleanup());

/** A level whose few leading terms are flagged, in the order the server sent
 * them — the flagged ones are NOT alphabetically first, which is the whole
 * point of the flag. */
const FLAGGED: readonly VocabularyTerm[] = [
  { code: "samsung", label: "Samsung", recommended: true },
  { code: "xiaomi", label: "Xiaomi", recommended: true },
  { code: "alcatel", label: "Alcatel" },
  { code: "blackview", label: "Blackview" },
  { code: "sony", label: "Sony" },
];

/** The same level as every response ships it today: no flag anywhere. */
const UNFLAGGED: readonly VocabularyTerm[] = FLAGGED.map(({ code, label }) => ({
  code,
  label,
}));

function clientOver(rows: readonly VocabularyTerm[]): VocabularyClient {
  return {
    async search(_vocabulary: string, _level: string, query: string) {
      const needle = query.trim().toLowerCase();
      return rows.filter((row) => row.label.toLowerCase().includes(needle));
    },
    async resolve(_vocabulary: string, _level: string, codes: readonly string[]) {
      const found: Record<string, string> = {};
      for (const code of codes) {
        const row = rows.find((one) => one.code === code);
        if (row !== undefined) found[code] = row.label;
      }
      return found;
    },
  };
}

function wrap(node: ReactElement, client: VocabularyClient): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  return (
    <I18nProvider i18n={i18n}>
      <VocabularyClientProvider value={client}>{node}</VocabularyClientProvider>
    </I18nProvider>
  );
}

/** Mount the ref field over `rows` and open its sheet. */
async function openSheet(
  rows: readonly VocabularyTerm[],
  values: Readonly<Record<string, unknown>> = {}
): Promise<void> {
  render(
    wrap(
      <FeatureFields features={[REF_SELECT_FEATURE]} values={values} onChange={() => {}} />,
      clientOver(rows)
    )
  );
  fireEvent.click(screen.getAllByTestId("attributes-ref-trigger")[0] as HTMLElement);
  await waitFor(() => {
    expect(document.querySelectorAll("[data-stapel-picker-row]").length).toBeGreaterThan(0);
  });
}

/** Every row on screen, in the order a thumb meets it. */
function rowCodes(): readonly string[] {
  return [...document.querySelectorAll("[data-stapel-picker-row]")].map(
    (row) => row.getAttribute("data-stapel-picker-row") ?? ""
  );
}

/** The band headings on screen, in order — `[]` when the list is plain. */
function bands(): readonly string[] {
  return [...document.querySelectorAll("[data-attributes-band]")].map(
    (node) => node.getAttribute("data-attributes-band") ?? ""
  );
}

function band(name: "recommended" | "rest"): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-attributes-band="${name}"]`);
}

function typeQuery(query: string): void {
  fireEvent.change(screen.getByTestId(PICKER_SEARCH_TESTID), { target: { value: query } });
}

/** Wait for the sheet to answer the query in its box — the rows are inert
 * (and the old ones still on screen) until it does. */
async function settled(expected: readonly string[]): Promise<void> {
  await waitFor(() => {
    expect(rowCodes()).toEqual(expected);
  });
}

describe("partitionRecommended", () => {
  it("keeps the server's order inside each band", () => {
    const { recommended, rest } = partitionRecommended(FLAGGED);
    expect(recommended.map((term) => term.code)).toEqual(["samsung", "xiaomi"]);
    expect(rest.map((term) => term.code)).toEqual(["alcatel", "blackview", "sony"]);
  });

  it("reads the flag strictly — an unflagged level has no recommended band", () => {
    expect(partitionRecommended(UNFLAGGED).recommended).toEqual([]);
    // Off the wire the field can be anything. Only `true` promotes a term;
    // otherwise a level sending `0` or `null` for "no" would put every row in
    // the top band.
    const loose = [
      { code: "a", label: "A", recommended: 0 },
      { code: "b", label: "B", recommended: null },
    ] as unknown as readonly VocabularyTerm[];
    expect(partitionRecommended(loose).recommended).toEqual([]);
  });
});

describe("a payload that flags nothing renders exactly as it does today", () => {
  it("is one plain list — no heading, no rule, no empty band", async () => {
    await openSheet(UNFLAGGED);
    expect(rowCodes()).toEqual(["samsung", "xiaomi", "alcatel", "blackview", "sony"]);
    expect(bands()).toEqual([]);
  });
});

describe("a payload that flags some terms renders as two bands", () => {
  it("puts the recommended ones first, under their own heading", async () => {
    await openSheet(FLAGGED);
    expect(bands()).toEqual(["recommended", "rest"]);
    expect(band("recommended")?.textContent).toBe("Recommended");
    expect(band("rest")?.textContent).toBe("All options");
    expect(rowCodes()).toEqual(["samsung", "xiaomi", "alcatel", "blackview", "sony"]);
  });

  it("draws a visible rule above the second band and nowhere else", async () => {
    await openSheet(FLAGGED);
    expect(band("rest")?.style.borderTopWidth).toBe("1px");
    // From the skin's own neutral border variable, so the rule follows the
    // host's light and dark palettes rather than a literal colour.
    expect(band("rest")?.style.borderTopColor).toContain("--stapel-border-subtle");
    expect(band("recommended")?.style.borderTopWidth).toBe("");
  });

  it("does not head an empty band — everything flagged is one band, not two", async () => {
    await openSheet(FLAGGED.filter((term) => term.recommended === true));
    expect(bands()).toEqual(["recommended"]);
    expect(rowCodes()).toEqual(["samsung", "xiaomi"]);
  });

  it("puts the headings inside the sheet's own groups, unfocusable and unpickable", async () => {
    await openSheet(FLAGGED);
    const heading = band("recommended");
    expect(heading?.closest("[role='radiogroup']")).not.toBeNull();
    expect(heading?.tagName).toBe("SPAN");
    expect(heading?.hasAttribute("tabindex")).toBe(false);
    expect(heading?.closest("button")).toBeNull();
    // Every row stays a reachable option on both sides of the rule.
    for (const row of document.querySelectorAll<HTMLButtonElement>("[data-stapel-picker-row]")) {
      expect(row.tagName).toBe("BUTTON");
      expect(row.disabled).toBe(false);
    }
  });
});

describe("search crosses both bands", () => {
  it("keeps the two-band shape when both bands survive", async () => {
    await openSheet(FLAGGED);
    typeQuery("a");
    // Samsung and Xiaomi from the flagged band, Alcatel and Blackview from
    // the rest — Sony is the only term without an "a".
    await settled(["samsung", "xiaomi", "alcatel", "blackview"]);
    expect(bands()).toEqual(["recommended", "rest"]);
  });

  it("drops the other band's heading when only the recommended ones match", async () => {
    await openSheet(FLAGGED);
    typeQuery("xia");
    await settled(["xiaomi"]);
    expect(bands()).toEqual(["recommended"]);
  });

  it("still shows terms that match only outside the recommended band", async () => {
    await openSheet(FLAGGED);
    typeQuery("son");
    await settled(["sony"]);
    // Nothing recommended survived, so there is no rule and no heading over
    // what is left — a lone "All options" band would be a heading over the
    // whole list and a separator with nothing above it.
    expect(bands()).toEqual([]);
  });
});

describe("the current answer", () => {
  it("is drawn selected in its band when it is a flagged term", async () => {
    await openSheet(FLAGGED, { [REF_SELECT_FEATURE.slug]: ["xiaomi"] });
    expect(bands()).toEqual(["recommended", "rest"]);
    const chosen = document.querySelector("[data-stapel-picker-row='xiaomi']");
    expect(chosen?.getAttribute("aria-checked")).toBe("true");
    expect(chosen?.closest("[role='radiogroup']")?.contains(band("recommended"))).toBe(true);
    // And it is drawn ONCE — the "what the field holds" section is for codes
    // the level did not list, not a second copy of a listed one.
    expect(rowCodes().filter((code) => code === "xiaomi")).toHaveLength(1);
  });
});

describe("the sheet's copy comes from the bundle", () => {
  it("renders the two headings through the package's own keys", async () => {
    const i18n = createI18n({ locale: "en" });
    registerAttributesI18n(i18n);
    expect(i18n.t(ATTRIBUTES_I18N_KEYS.pickerRecommended)).toBe("Recommended");
    expect(i18n.t(ATTRIBUTES_I18N_KEYS.pickerAllOptions)).toBe("All options");
    await openSheet(FLAGGED);
    expect(band("recommended")?.textContent).toBe(
      i18n.t(ATTRIBUTES_I18N_KEYS.pickerRecommended)
    );
    expect(band("rest")?.textContent).toBe(i18n.t(ATTRIBUTES_I18N_KEYS.pickerAllOptions));
  });
});
