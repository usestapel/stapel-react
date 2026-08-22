import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { countIsEstimate, parseDegradations } from "../src/index.js";
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
    expect(text).toContain("Typos were not corrected");
    expect(text).toContain("Subcategories may be missing");
    expect(text).toContain("geo_decay");
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
