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
 *
 * ── And one that is a REGRESSION, not a feature ────────────────────────────
 *
 * A page must be asked for from the end of the list that is on screen. The
 * scroll trigger lives in the skin (`SkinPickerSheet` installs a capture-phase
 * window listener in an effect keyed on the `onEndReached` IDENTITY), so while
 * `more` was rebuilt on every landed page there was a window — between the
 * commit that painted page two and the passive effect that installed the
 * matching listener — in which a scroll ran the PREVIOUS closure. It asked for
 * offset 50 a second time and appended the fifty rows already on screen: the
 * level went 50 → 100 → 150 with page two duplicated and the last twenty
 * terms unreachable.
 *
 * That window is not something a test can widen honestly, and waiting longer
 * for it is what made this file flaky rather than what proved anything. So it
 * is pinned twice, both deterministically: the scenario below asserts the row
 * SET after every page (a duplicate is a failure, not a slow success), and
 * `useTermSearch` is driven directly with a deliberately stale `more` — the
 * exact call the gap used to let through — with no timing involved at all.
 */
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";

import { FeatureFields } from "../src/default/index.js";
// Not on the `/default` entry: `useTermSearch` is this file's internal, and the
// regression below drives it directly rather than through a sheet, because the
// defect is a call the sheet made and not anything the sheet renders.
import { useTermSearch } from "../src/default/editorsRef.js";
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

/**
 * The list has `count` rows AND has SETTLED on them: it answers the box
 * (`data-stapel-picker-list="fresh"`), nothing is in flight
 * (`data-vocabulary-busy="false"`), and no row appears twice.
 *
 * Every one of those is load-bearing against the defect this file guards. A
 * bare row count is true for one poll of `waitFor` at a moment the control is
 * still moving, and it is the reason "scroll, then assert the count" was a
 * coin toss on a loaded runner: the next scroll went out against a list the
 * component had not finished being.
 */
async function settledRows(count: number): Promise<void> {
  await waitFor(() => {
    expect(rows().length).toBe(count);
    expect(
      document
        .querySelector("[data-stapel-picker-list]")
        ?.getAttribute("data-stapel-picker-list")
    ).toBe("fresh");
    expect(
      screen.getByTestId("attributes-ref-select").getAttribute("data-vocabulary-busy")
    ).toBe("false");
  });
  // A duplicated page is the failure mode, and it passes a length check on its
  // way past: 50 → 100 is the same number whether page two is terms 50–99 or
  // terms 50–99 twice over half a level.
  expect(new Set(rows()).size).toBe(rows().length);
}

async function openSheet(): Promise<void> {
  fireEvent.click(screen.getByTestId("attributes-ref-trigger"));
  await settledRows(PAGE);
}

function scrollList(): void {
  const list = document.querySelector("[data-stapel-picker-list]");
  if (list === null) throw new Error("no picker list on screen");
  // In jsdom every element measures 0, so any scroll event reads as "at the
  // bottom" — which is exactly the trigger under test.
  fireEvent.scroll(list.parentElement ?? list);
}

/** Every pending promise callback and the effects they schedule, drained. No
 * duration: the thing being waited for is a settled React tree, not an
 * interval somebody guessed at. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("picker paging", () => {
  it("loads the next page when scrolled to the end, until the level is exhausted", async () => {
    const { client } = pagedClient();
    renderMake(client);
    await openSheet();

    scrollList();
    await settledRows(2 * PAGE);
    scrollList();
    await settledRows(LEVEL.length);
    expect(rows()).toContain("term-119");
    // The whole level, in order, each term exactly once.
    expect(rows()).toEqual(LEVEL.map((term) => term.code));

    // Exhausted: another scroll asks for nothing more. `more` calls the client
    // synchronously when it proceeds, so one flush is the entire window in
    // which a request could appear — no timer, and nothing to lose a race to.
    const asked = pagedClientCalls(client);
    scrollList();
    await flush();
    expect(pagedClientCalls(client)).toBe(asked);
    expect(rows().length).toBe(LEVEL.length);
  });

  it("finds a page-three term by typing — the search is the server's, not the first page's", async () => {
    const { client, search } = pagedClient();
    renderMake(client);
    await openSheet();
    fireEvent.change(screen.getByTestId("stapel-picker-search"), {
      target: { value: "Term 119" },
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

/**
 * The gap, made deterministic: `more` taken from an EARLIER render and called
 * after a page has landed, which is precisely what the skin's listener did
 * while it was still holding the previous identity.
 *
 * Pre-fix this appended page two on top of itself (100 rows, fifty of them
 * duplicates) and marked nothing exhausted, so the run that follows could
 * never reach 120. It is asserted here rather than through the DOM because
 * there is nothing to wait for — the stale call IS the defect, and a test that
 * waits for it to happen is a test that reports the load on the machine.
 */
describe("useTermSearch.more — asked from the end of the list on screen", () => {
  it("a `more` held from before page two lands adds nothing twice", async () => {
    const { client } = pagedClient();
    const { result } = renderHook(() =>
      useTermSearch(client, "cars", "Make", undefined)
    );

    await act(async () => {
      result.current.open();
    });
    await waitFor(() => {
      expect(result.current.terms.length).toBe(PAGE);
    });

    // The identity the sheet's listener would still be holding.
    const staleMore = result.current.more;

    await act(async () => {
      staleMore();
    });
    await flush();
    expect(result.current.terms.length).toBe(2 * PAGE);

    // THE CALL THE GAP LET THROUGH: the same held function, run after the page
    // it did not know about has landed. Pre-fix it asked for offset 50 again
    // and appended terms 50–99 on top of themselves — 150 rows, fifty of them
    // twice, and `exhausted` never reached, so the last twenty terms of the
    // level were unreachable by scrolling at all.
    await act(async () => {
      staleMore();
    });
    await flush();
    expect(result.current.terms.map((term) => term.code)).toEqual(
      LEVEL.map((term) => term.code)
    );
    expect(new Set(result.current.terms.map((term) => term.code)).size).toBe(
      result.current.terms.length
    );

    // And the identity itself, which is WHY there is nothing to land in: the
    // skin re-installs its window listener only when this changes.
    expect(result.current.more).toBe(staleMore);
  });

  it("stops at the end of the level however often it is asked", async () => {
    const { client, search } = pagedClient();
    const { result } = renderHook(() =>
      useTermSearch(client, "cars", "Make", undefined)
    );
    await act(async () => {
      result.current.open();
    });
    await waitFor(() => {
      expect(result.current.terms.length).toBe(PAGE);
    });

    for (let page = 0; page < 6; page += 1) {
      await act(async () => {
        result.current.more();
      });
      await flush();
    }

    expect(result.current.terms.map((term) => term.code)).toEqual(
      LEVEL.map((term) => term.code)
    );
    // Page one, page two, page three, and the short page that proved the end.
    // Six asks, at most four requests — the guard is the state, not the count
    // of scrolls a thumb produced.
    expect(search.mock.calls.length).toBeLessThanOrEqual(4);
  });
});

function pagedClientCalls(client: VocabularyClient): number {
  return (client.search as ReturnType<typeof vi.fn>).mock.calls.length;
}
