/**
 * Paging through a vocabulary level — the cropped-picker defect.
 *
 * The terms endpoint pages (50 by default, `offset`/`limit`, a `total`), and
 * the picker used to fetch page one and stop: a 120-term level showed 50
 * rows and no way to reach the rest. Two guarantees pinned here:
 *
 *  - scrolling to the end of the sheet loads the NEXT page, until the level
 *    is exhausted;
 *  - the typeahead is a SERVER search (`q`), so a term on page three is
 *    reachable by typing it, never only by scrolling.
 */
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";

import { FeatureFields } from "../src/default/index.js";
import { VocabularyClientProvider } from "../src/vocabulary.js";
import type { VocabularyClient, VocabularyTerm } from "../src/vocabulary.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { feature } from "./fixtures.js";

afterEach(() => cleanup());

const PAGE = 50;
const LEVEL: readonly VocabularyTerm[] = Array.from({ length: 120 }, (_, index) => ({
  code: `term-${String(index).padStart(3, "0")}`,
  label: `Term ${String(index).padStart(3, "0")}`,
}));

const MAKE = feature("make", {
  type: "ref_select",
  optionsRef: { vocabulary: "cars", level: "Make" },
});

function pagedClient(): { client: VocabularyClient; search: ReturnType<typeof vi.fn> } {
  const search = vi.fn(
    async (
      _vocabulary: string,
      _level: string,
      query: string,
      _parent?: string,
      _signal?: AbortSignal,
      offset?: number
    ): Promise<readonly VocabularyTerm[]> => {
      const matched = LEVEL.filter((term) =>
        term.label.toLowerCase().includes(query.toLowerCase())
      );
      const start = offset ?? 0;
      return matched.slice(start, start + PAGE);
    }
  );
  return { search, client: { search, resolve: async () => ({}) } };
}

function renderMake(client: VocabularyClient) {
  const onChange = vi.fn();
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  render(
    <I18nProvider i18n={i18n}>
      <VocabularyClientProvider value={client}>
        <FeatureFields features={[MAKE]} values={{}} onChange={onChange} />
      </VocabularyClientProvider>
    </I18nProvider>
  );
  return { onChange };
}

function rows(): readonly string[] {
  return [...document.querySelectorAll("[data-stapel-picker-row]")].map(
    (row) => row.getAttribute("data-stapel-picker-row") ?? ""
  );
}

async function openSheet(): Promise<void> {
  fireEvent.click(screen.getByTestId("attributes-ref-trigger"));
  await waitFor(() => {
    expect(rows().length).toBeGreaterThan(0);
  });
}

function scrollList(): void {
  const list = document.querySelector("[data-stapel-picker-list]");
  if (list === null) throw new Error("no picker list on screen");
  // In jsdom every element measures 0, so any scroll event reads as "at the
  // bottom" — which is exactly the trigger under test.
  fireEvent.scroll(list.parentElement ?? list);
}

describe("picker paging", () => {
  it("loads the next page when scrolled to the end, until the level is exhausted", async () => {
    const { client } = pagedClient();
    renderMake(client);
    await openSheet();
    expect(rows().length).toBe(PAGE);

    scrollList();
    await waitFor(() => {
      expect(rows().length).toBe(2 * PAGE);
    });
    scrollList();
    await waitFor(() => {
      expect(rows().length).toBe(LEVEL.length);
    });
    expect(rows()).toContain("term-119");

    // Exhausted: another scroll asks for nothing more.
    const asked = pagedClientCalls(client);
    scrollList();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(pagedClientCalls(client)).toBe(asked);
  });

  it("finds a page-three term by typing — the search is the server's, not the first page's", async () => {
    const { client, search } = pagedClient();
    renderMake(client);
    await openSheet();
    fireEvent.change(screen.getByTestId("stapel-picker-search"), {
      target: { value: "Term 119" },
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    await waitFor(() => {
      expect(rows()).toContain("term-119");
    });
    // The query reached the client — server-side filtering, not a local
    // filter of page one.
    expect(
      search.mock.calls.some((call) => (call[2] as string).includes("Term 119"))
    ).toBe(true);
  });
});

function pagedClientCalls(client: VocabularyClient): number {
  return (client.search as ReturnType<typeof vi.fn>).mock.calls.length;
}
