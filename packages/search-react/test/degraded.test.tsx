import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  countIsEstimate,
  countKind,
  isCountNuanceOnly,
  parseDegradations,
} from "../src/index.js";
import { SearchResultsPane } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

describe("degraded[] is parsed, not glanced at", () => {
  it("names every literal the backend can emit", () => {
    const parsed = parseDegradations([
      "typo_tolerance",
      "phrase_synonyms",
      "exact_total",
      "exact_facet_counts",
      "category_rollup",
      "scorer:geo_decay",
    ]);
    expect(parsed.map((d) => d.kind)).toEqual([
      "typo_tolerance",
      "phrase_synonyms",
      "exact_total",
      "exact_facet_counts",
      "category_rollup",
      "scorer",
    ]);
    expect(parsed[5]?.scorer).toBe("geo_decay");
    expect(parsed[4]?.messageKey).toBe("search.degraded.category_rollup");
  });

  it("de-duplicates, because the backend does not", () => {
    // `services.py` concatenates its own list with the backend's and the
    // facet counter's without de-duplicating, so the same literal genuinely
    // arrives twice.
    const parsed = parseDegradations(["typo_tolerance", "typo_tolerance"]);
    expect(parsed).toHaveLength(1);
  });

  it("keeps an unrecognised literal instead of dropping it", () => {
    const parsed = parseDegradations(["vector_rerank"]);
    expect(parsed).toEqual([
      {
        kind: "unknown",
        raw: "vector_rerank",
        messageKey: "search.degraded.unknown",
      },
    ]);
  });

  it("treats either signal of an estimated total as decisive", () => {
    expect(countIsEstimate(false, [])).toBe(true);
    expect(countIsEstimate(true, parseDegradations(["exact_total"]))).toBe(true);
    expect(countIsEstimate(true, [])).toBe(false);
  });

  it("reads the envelope's three count states as one decision", () => {
    expect(countKind(25, false, true, [])).toBe("exact");
    expect(countKind(1200, true, false, parseDegradations(["exact_total"]))).toBe(
      "at_least"
    );
    // No `count_is_lower_bound` from a server that predates it: still a floor.
    expect(countKind(42, false, false, [])).toBe("at_least");
    expect(countKind(null, false, false, [])).toBe("unknown");
    // The state that produced the live defect: unknown is never zero.
    expect(countKind(0, false, true, [])).toBe("exact");
  });

  it("knows an exact_total-only degradation is a count nuance", () => {
    expect(isCountNuanceOnly(parseDegradations(["exact_total"]))).toBe(true);
    expect(isCountNuanceOnly(parseDegradations([]))).toBe(false);
    expect(
      isCountNuanceOnly(parseDegradations(["exact_total", "typo_tolerance"]))
    ).toBe(false);
  });
});

describe("the banner says what the engine could not do", () => {
  it("renders one line per degradation, with the scorer named", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({
          degraded: ["typo_tolerance", "category_rollup", "scorer:geo_decay"],
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-degraded")).toBeTruthy();
    });
    const text = screen.getByTestId("search-degraded").textContent ?? "";
    expect(text).toContain("Subcategories may be missing");
    expect(text).toContain("geo_decay");
    // `typo_tolerance` arrived in the same list and is NOT here: it names a
    // capability of the engine somebody licensed, not a property of this
    // answer, and it is the same sentence on every query forever. See
    // `readerFacing` — and `serpAxes.test.tsx` for the live board where its
    // twin, `phrase_synonyms`, occupied a screen between the sort control
    // and the first card on every search.
    expect(text).not.toContain("Typos were not corrected");
  });

  it("renders the raw literal for a degradation this build has no wording for", async () => {
    const server = mockServer({
      "/query": { body: searchResponse({ degraded: ["vector_rerank"] }) },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-degraded").textContent).toContain(
        "vector_rerank"
      );
    });
  });

  it("does NOT raise a banner when exact_total is the only degradation", async () => {
    // A count nuance, not a failed search: the rows are right and the count
    // already says "N+". A warning box here teaches the reader that a good
    // page is broken — and a banner that cries wolf on every landing page is
    // one nobody reads on the day `category_rollup` shows up in it.
    const server = mockServer({
      "/query": {
        body: searchResponse({
          degraded: ["exact_total"],
          count: 1200,
          count_is_lower_bound: true,
          exact_total: false,
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-degraded")).toBeNull();
    // …and the nuance is still SAID, by the count itself.
    expect(screen.getByTestId("search-count").textContent).toBe("1200+ results");
  });

  it("raises it again when exact_total arrives beside a real degradation", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({
          degraded: ["exact_total", "category_rollup"],
          count_is_lower_bound: true,
          exact_total: false,
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-degraded")).toBeTruthy();
    });
    expect(screen.getByTestId("search-degraded").textContent).toContain(
      "Subcategories may be missing"
    );
  });

  it("renders nothing when the container passes degradationNotice='off'", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({ degraded: ["typo_tolerance", "category_rollup"] }),
      },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane degradationNotice="off" />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-degraded")).toBeNull();
  });

  it("says the same sentences quietly under degradationNotice='inline'", async () => {
    const server = mockServer({
      "/query": { body: searchResponse({ degraded: ["category_rollup"] }) },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane degradationNotice="inline" />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-degraded")).toBeTruthy();
    });
    const notice = screen.getByTestId("search-degraded");
    expect(notice.getAttribute("data-variant")).toBe("inline");
    expect(notice.textContent).toContain("Subcategories may be missing");
  });

  it("shows no banner at all when the engine did everything asked of it", async () => {
    const server = mockServer({ "/query": { body: searchResponse({ degraded: [] }) } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-degraded")).toBeNull();
  });
});
