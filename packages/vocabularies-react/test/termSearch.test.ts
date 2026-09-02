/**
 * `useTermSearch` — the SECOND place the page can be thrown away.
 *
 * The client forwards the endpoint's envelope; this hook is what a control in
 * this package reads instead of the client, so `popular_count` has to survive
 * here too. The rest of the hook's behaviour (debounce, supersede, `matched`)
 * is asserted through the controls in `termSelect`/`termPicker`; what is here
 * is only the band.
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTermSearch } from "../src/model/useTermSearch.js";
import type { VocabularyClient, VocabularyTermAnswer } from "../src/client.js";

function answering(answer: VocabularyTermAnswer): VocabularyClient {
  return {
    search: () => Promise.resolve(answer),
    resolve: () => Promise.resolve({}),
  };
}

/** Opens the dropdown — the first page is fetched at once, undebounced. */
function opened(client: VocabularyClient): ReturnType<typeof renderHook<
  ReturnType<typeof useTermSearch>,
  undefined
>> {
  const view = renderHook(() =>
    useTermSearch(client, { vocabulary: "phone-models", level: "Vendor" })
  );
  view.result.current.open();
  return view;
}

describe("the popular band reaches a control", () => {
  it("reads the page's popular_count", async () => {
    const view = opened(
      answering({
        results: [
          { code: "apple", label: "Apple", band: "popular" },
          { code: "samsung", label: "Samsung", band: "popular" },
          { code: "alcatel", label: "Alcatel", band: "all" },
        ],
        popular_count: 2,
        total: 3,
      })
    );
    await waitFor(() => {
      expect(view.result.current.matched).toBe(true);
    });
    expect(view.result.current.popularCount).toBe(2);
    expect(view.result.current.terms.map((term) => term.code)).toEqual([
      "apple",
      "samsung",
      "alcatel",
    ]);
  });

  it("keeps an interleaved page in the server's order and slices at the count", async () => {
    // [popular+prefix, all+prefix, popular, all] — the shape a `q` search
    // legitimately has. Only the LEADING run is the band; a filter on `band`
    // would lift row three over row two.
    const view = opened(
      answering({
        results: [
          { code: "app-a", label: "Apple", band: "popular" },
          { code: "app-b", label: "Appo", band: "all" },
          { code: "sam", label: "Samsung", band: "popular" },
          { code: "alc", label: "Alcatel", band: "all" },
        ],
        popular_count: 1,
      })
    );
    await waitFor(() => {
      expect(view.result.current.matched).toBe(true);
    });
    expect(view.result.current.popularCount).toBe(1);
    expect(view.result.current.terms.map((term) => term.code)).toEqual([
      "app-a",
      "app-b",
      "sam",
      "alc",
    ]);
  });

  it("a page with neither band nor count is one plain list", async () => {
    const view = opened(
      answering({ results: [{ code: "apple", label: "Apple" }], total: 1 })
    );
    await waitFor(() => {
      expect(view.result.current.matched).toBe(true);
    });
    expect(view.result.current.popularCount).toBe(0);
    expect(view.result.current.terms).toHaveLength(1);
  });

  it("a host that answers with a bare array still works — leading run, or nothing", async () => {
    const plain = opened(answering([{ code: "apple", label: "Apple" }]));
    await waitFor(() => {
      expect(plain.result.current.matched).toBe(true);
    });
    expect(plain.result.current.popularCount).toBe(0);

    const tagged = opened(
      answering([
        { code: "apple", label: "Apple", band: "popular" },
        { code: "alcatel", label: "Alcatel", band: "all" },
      ])
    );
    await waitFor(() => {
      expect(tagged.result.current.matched).toBe(true);
    });
    expect(tagged.result.current.popularCount).toBe(1);
  });

  it("a count past the end of the page cannot slice past the rows", async () => {
    const view = opened(
      answering({ results: [{ code: "apple", label: "Apple", band: "popular" }], popular_count: 9 })
    );
    await waitFor(() => {
      expect(view.result.current.matched).toBe(true);
    });
    expect(view.result.current.popularCount).toBe(1);
  });
});
