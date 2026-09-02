/**
 * The POPULAR band of a reference picker — `stapel-vocabularies` 0.2.0.
 *
 * A live stand's phone catalogue holds 529 vendors and the picker opened on
 * `3Q, 4Good, 8848, A1, Aceline, Acer`. The server now leads each page with a
 * short band and says where it ends; this file is the other half — the
 * rendering — and the claims it pins are the ones that break quietly:
 *
 *  1. the boundary is the page's `popular_count`, NOT a scan of the rows' own
 *     `band` tag. Under `q` the server ranks by prefix first and the band
 *     second, so a tagged row can legitimately sit below an untagged one and
 *     filtering on the tag would reorder the typeahead;
 *  2. a level with no band — `popular_count: 0`, or a client older than the
 *     page shape that still answers with a bare array — draws ONE plain list:
 *     no heading, no rule, no empty band;
 *  3. search re-reads the boundary from whatever the server returned, and a
 *     band with nothing in it takes its heading with it;
 *  4. a term in the band that is also the field's answer is still selected.
 *
 * The client is stubbed at the SEAM (two functions), as everywhere else in
 * this package — see `test/vocabulary.test.tsx`.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { PICKER_SEARCH_TESTID } from "@stapel/tokens-antd/skin";
import { VocabularyClientProvider, splitPopularBand, termPageOf } from "../src/index.js";
import type {
  VocabularyClient,
  VocabularyTerm,
  VocabularyTermPage,
} from "../src/index.js";
import { ATTRIBUTES_I18N_KEYS, registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields } from "../src/default/FeatureFields.js";
import { REF_SELECT_FEATURE } from "./fixtures.js";

afterEach(() => cleanup());

/** A level the server ranked: two popular rows lead, then the alphabet. The
 * popular pair is NOT alphabetically first, which is the point of the band. */
const RANKED: readonly VocabularyTerm[] = [
  { code: "samsung", label: "Samsung", band: "popular" },
  { code: "xiaomi", label: "Xiaomi", band: "popular" },
  { code: "alcatel", label: "Alcatel", band: "all" },
  { code: "blackview", label: "Blackview", band: "all" },
  { code: "sony", label: "Sony", band: "all" },
];

/** The same level with nothing ranked — every `popularity` is 0. */
const UNRANKED: readonly VocabularyTerm[] = RANKED.map(({ code, label }) => ({
  code,
  label,
  band: "all" as const,
}));

/**
 * A client that answers with the endpoint's page shape, counting the leading
 * run exactly as `_leading_popular` does upstream.
 */
function clientOver(rows: readonly VocabularyTerm[]): VocabularyClient {
  return {
    async search(_vocabulary: string, _level: string, query: string) {
      const needle = query.trim().toLowerCase();
      const results = rows.filter((row) => row.label.toLowerCase().includes(needle));
      let popular = 0;
      while (results[popular]?.band === "popular") popular += 1;
      return { results, total: results.length, popular_count: popular };
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

/** A client that answers with a fixed page, whatever is asked — for pinning
 * the boundary against a body the caller writes by hand. */
function clientAnswering(page: VocabularyTermPage | readonly VocabularyTerm[]): VocabularyClient {
  return {
    async search() {
      return page;
    },
    async resolve() {
      return {};
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

/** Mount the ref field over `client` and open its sheet. */
async function openSheet(
  client: VocabularyClient,
  values: Readonly<Record<string, unknown>> = {}
): Promise<void> {
  render(
    wrap(
      <FeatureFields features={[REF_SELECT_FEATURE]} values={values} onChange={() => {}} />,
      client
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

function band(name: "popular" | "all"): HTMLElement | null {
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

describe("termPageOf reads the boundary the server published", () => {
  it("takes popular_count over the rows' own band tag", () => {
    // The shape a `q` search produces: prefix rank outranks the band, so the
    // tagged Samsung at index 2 is BELOW an untagged prefix match on purpose.
    // Scanning the tag would lift it over Alcatel and break the typeahead.
    const page: VocabularyTermPage = {
      results: [
        { code: "aceline", label: "Aceline", band: "popular" },
        { code: "alcatel", label: "Alcatel", band: "all" },
        { code: "samsung", label: "Samsung", band: "popular" },
      ],
      popular_count: 1,
    };
    const { terms, popularCount } = termPageOf(page);
    expect(popularCount).toBe(1);
    const { popular, rest } = splitPopularBand(terms, popularCount);
    expect(popular.map((term) => term.code)).toEqual(["aceline"]);
    expect(rest.map((term) => term.code)).toEqual(["alcatel", "samsung"]);
  });

  it("forces a count off the wire into an index the rows can carry", () => {
    const rows = RANKED.slice(0, 3);
    for (const bad of [-1, 1.5, Number.NaN, "2", null, undefined]) {
      const page = { results: rows, popular_count: bad } as unknown as VocabularyTermPage;
      // `undefined` is the one that falls through to the leading run (2);
      // every other malformed value is refused outright.
      expect(termPageOf(page).popularCount).toBe(bad === undefined ? 2 : 0);
    }
    // A count longer than the page cannot slice past its end.
    expect(termPageOf({ results: rows, popular_count: 99 }).popularCount).toBe(3);
  });

  it("falls back to the LEADING RUN when the answer carries no count", () => {
    // A bare array — a host with an in-memory table, or a client older than
    // the page shape. The leading run is the server's own algorithm: it can
    // under-report a band, it can never reorder one.
    expect(termPageOf(RANKED).popularCount).toBe(2);
    expect(termPageOf(UNRANKED).popularCount).toBe(0);
    expect(termPageOf([{ code: "a", label: "A" }]).popularCount).toBe(0);
    // Tagged but not leading: no run, so no band — never a reordering.
    expect(
      termPageOf([
        { code: "a", label: "A", band: "all" },
        { code: "b", label: "B", band: "popular" },
      ]).popularCount
    ).toBe(0);
  });

  it("survives a body that is not the shape it claims", () => {
    expect(termPageOf({} as VocabularyTermPage)).toEqual({ terms: [], popularCount: 0 });
    expect(
      termPageOf({ results: "nope" } as unknown as VocabularyTermPage)
    ).toEqual({ terms: [], popularCount: 0 });
  });
});

describe("splitPopularBand cuts, never filters", () => {
  it("slices at the boundary and keeps both orders", () => {
    const { popular, rest } = splitPopularBand(RANKED, 2);
    expect(popular.map((term) => term.code)).toEqual(["samsung", "xiaomi"]);
    expect(rest.map((term) => term.code)).toEqual(["alcatel", "blackview", "sony"]);
  });

  it("at zero the whole level is the rest — which is the plain list", () => {
    expect(splitPopularBand(RANKED, 0).popular).toEqual([]);
    expect(splitPopularBand(RANKED, 0).rest).toHaveLength(RANKED.length);
  });
});

describe("a level with no band renders exactly as it did before", () => {
  it("is one plain list — no heading, no rule, no empty band", async () => {
    await openSheet(clientOver(UNRANKED));
    expect(rowCodes()).toEqual(["samsung", "xiaomi", "alcatel", "blackview", "sony"]);
    expect(bands()).toEqual([]);
  });

  it("likewise for a client that still answers with a bare array", async () => {
    await openSheet(clientAnswering(UNRANKED));
    expect(rowCodes()).toEqual(["samsung", "xiaomi", "alcatel", "blackview", "sony"]);
    expect(bands()).toEqual([]);
  });
});

describe("a ranked level renders as two bands", () => {
  it("puts the band first, under its own heading", async () => {
    await openSheet(clientOver(RANKED));
    expect(bands()).toEqual(["popular", "all"]);
    expect(band("popular")?.textContent).toBe("Recommended");
    expect(band("all")?.textContent).toBe("All options");
    expect(rowCodes()).toEqual(["samsung", "xiaomi", "alcatel", "blackview", "sony"]);
  });

  it("draws a visible rule above the second band and nowhere else", async () => {
    await openSheet(clientOver(RANKED));
    expect(band("all")?.style.borderTopWidth).toBe("1px");
    // From the skin's own neutral border variable, so the rule follows the
    // host's light and dark palettes rather than a literal colour.
    expect(band("all")?.style.borderTopColor).toContain("--stapel-border-subtle");
    expect(band("popular")?.style.borderTopWidth).toBe("");
  });

  it("does not head an empty band — a page that is all band is one band", async () => {
    await openSheet(clientOver(RANKED.filter((term) => term.band === "popular")));
    expect(bands()).toEqual(["popular"]);
    expect(rowCodes()).toEqual(["samsung", "xiaomi"]);
  });

  it("obeys popular_count even when the tags disagree with it", async () => {
    // The server ranked one row into the band; the second tagged row is a
    // deliberate prefix hit below an untagged one. The sheet draws what the
    // count says and leaves every row where the server put it.
    await openSheet(
      clientAnswering({
        results: [
          { code: "aceline", label: "Aceline", band: "popular" },
          { code: "alcatel", label: "Alcatel", band: "all" },
          { code: "samsung", label: "Samsung", band: "popular" },
        ],
        popular_count: 1,
      })
    );
    expect(bands()).toEqual(["popular", "all"]);
    expect(rowCodes()).toEqual(["aceline", "alcatel", "samsung"]);
  });

  it("puts the headings inside the sheet's own groups, unfocusable and unpickable", async () => {
    await openSheet(clientOver(RANKED));
    const heading = band("popular");
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

describe("search re-reads the boundary from the response", () => {
  it("keeps the two-band shape when the band survives the query", async () => {
    await openSheet(clientOver(RANKED));
    typeQuery("a");
    // Samsung and Xiaomi still lead, so the server counts two; Sony is the
    // only term without an "a".
    await settled(["samsung", "xiaomi", "alcatel", "blackview"]);
    expect(bands()).toEqual(["popular", "all"]);
  });

  it("drops the second heading when only the band survives", async () => {
    await openSheet(clientOver(RANKED));
    typeQuery("xia");
    await settled(["xiaomi"]);
    expect(bands()).toEqual(["popular"]);
  });

  it("still shows terms that match only outside the band", async () => {
    await openSheet(clientOver(RANKED));
    typeQuery("son");
    await settled(["sony"]);
    // `popular_count: 0` — the answer's leading rows are plain matches. No
    // rule and no heading over what is left; a lone "All options" band would
    // be a heading over the whole list and a separator above nothing.
    expect(bands()).toEqual([]);
  });
});

describe("paging through the boundary", () => {
  // The server caps the band well inside the first page, so this is 0 in
  // practice — but a host on a small `limit` can page THROUGH it, and the
  // band of a concatenation is a leading run, not a sum.
  const PAGE = 50;
  const LEVEL: readonly VocabularyTerm[] = Array.from({ length: 60 }, (_, index) => ({
    code: `term-${String(index).padStart(2, "0")}`,
    label: `Term ${String(index).padStart(2, "0")}`,
    band: index < 55 ? ("popular" as const) : ("all" as const),
  }));

  function pagedClient(): VocabularyClient {
    return {
      async search(_vocabulary, _level, _query, _parent, _signal, offset) {
        const start = offset ?? 0;
        const results = LEVEL.slice(start, start + PAGE);
        let popular = 0;
        while (results[popular]?.band === "popular") popular += 1;
        return { results, total: LEVEL.length, popular_count: popular };
      },
      async resolve() {
        return {};
      },
    };
  }

  it("extends the band with a later page's leading run instead of restarting it", async () => {
    await openSheet(pagedClient());
    // Page one is entirely band, so there is no second heading yet.
    expect(bands()).toEqual(["popular"]);
    expect(rowCodes()).toHaveLength(PAGE);

    const list = document.querySelector("[data-stapel-picker-list]");
    if (list === null) throw new Error("no picker list on screen");
    // In jsdom every element measures 0, so any scroll reads as "at the end".
    fireEvent.scroll(list.parentElement ?? list);
    await waitFor(() => {
      expect(rowCodes()).toHaveLength(LEVEL.length);
    });

    // 50 + the next page's leading run of 5 — the five rows that were still
    // inside the band. The last five land under the rule, not above it.
    expect(bands()).toEqual(["popular", "all"]);
    const popularRows = band("popular")
      ?.closest("[role='radiogroup']")
      ?.querySelectorAll("[data-stapel-picker-row]");
    expect(popularRows).toHaveLength(55);
    expect(rowCodes()).toEqual(LEVEL.map((term) => term.code));
  });
});

describe("the current answer", () => {
  it("is drawn selected inside the band when it is a banded term", async () => {
    await openSheet(clientOver(RANKED), { [REF_SELECT_FEATURE.slug]: ["xiaomi"] });
    expect(bands()).toEqual(["popular", "all"]);
    const chosen = document.querySelector("[data-stapel-picker-row='xiaomi']");
    expect(chosen?.getAttribute("aria-checked")).toBe("true");
    expect(chosen?.closest("[role='radiogroup']")?.contains(band("popular"))).toBe(true);
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
    await openSheet(clientOver(RANKED));
    expect(band("popular")?.textContent).toBe(i18n.t(ATTRIBUTES_I18N_KEYS.pickerRecommended));
    expect(band("all")?.textContent).toBe(i18n.t(ATTRIBUTES_I18N_KEYS.pickerAllOptions));
  });
});
