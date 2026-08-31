/**
 * `useSearchCount` — the count read that has no endpoint of its own.
 *
 * The assertions are on the WIRE and on the KIND, because those are the two
 * places this hook can be wrong in a way nothing else would catch: it must ask
 * the cheapest question the query endpoint accepts (one row, no facets, no
 * cursor, no sort), and it must never turn a floor or a `null` into a total.
 */
import { describe, expect, it } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import type { LoadState } from "@stapel/core";
import { SEARCH_COUNT_PAGE_SIZE, countQueryState, useSearchCount } from "../src/index.js";
import type { SearchCount, SearchCountState } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { searchResponse } from "./fixtures.js";
import type { MockServer } from "./harness.js";

function Probe(props: {
  readonly state: SearchCountState;
  readonly debounceMs?: number;
  readonly enabled?: boolean;
  readonly onState: (state: LoadState<SearchCount>) => void;
}): ReactElement {
  const state = useSearchCount(props.state, {
    ...(props.debounceMs !== undefined ? { debounceMs: props.debounceMs } : {}),
    ...(props.enabled !== undefined ? { enabled: props.enabled } : {}),
  });
  props.onState(state);
  return <span data-testid="probe" />;
}

function mount(
  server: MockServer,
  state: SearchCountState,
  options: { readonly debounceMs?: number; readonly enabled?: boolean } = {}
) {
  const seen: LoadState<SearchCount>[] = [];
  const result = render(
    <TestProviders server={server}>
      <Probe
        state={state}
        onState={(s) => seen.push(s)}
        {...(options.debounceMs !== undefined ? { debounceMs: options.debounceMs } : {})}
        {...(options.enabled !== undefined ? { enabled: options.enabled } : {})}
      />
    </TestProviders>
  );
  return { ...result, seen, last: () => seen[seen.length - 1] };
}

const LISTING: SearchCountState = { type: "listing" };

describe("countQueryState — what is asked and what is dropped", () => {
  it("asks for the smallest page with facet counting off", () => {
    const asked = countQueryState(LISTING);
    expect(asked.limit).toBe(SEARCH_COUNT_PAGE_SIZE);
    expect(asked.facets).toBe("off");
  });

  it("fills the required halves of a search state a caller left out", () => {
    const asked = countQueryState(LISTING);
    expect(asked.q).toBe("");
    expect(asked.filters).toEqual({});
    expect(asked.ranges).toEqual({});
  });

  it("drops the cursor and the sort — a count is about the whole set", () => {
    const asked = countQueryState({
      type: "listing",
      anchor: "page-2",
      direction: "next",
      sort: "price_asc",
    });
    expect(asked.anchor).toBeUndefined();
    expect(asked.direction).toBeUndefined();
    expect(asked.sort).toBeUndefined();
  });

  it("keeps everything that changes the ANSWER", () => {
    const asked = countQueryState({
      type: "listing",
      q: "drill",
      category: "tools/power",
      filters: { brand: ["bosch"] },
      ranges: { price: { from: "100" } },
      geo: { kind: "center", lat: 55.7, lon: 37.6, radiusKm: 20 },
      lang: "ru",
    });
    expect(asked.q).toBe("drill");
    expect(asked.category).toBe("tools/power");
    expect(asked.filters).toEqual({ brand: ["bosch"] });
    expect(asked.ranges).toEqual({ price: { from: "100" } });
    expect(asked.geo).toEqual({ kind: "center", lat: 55.7, lon: 37.6, radiusKm: 20 });
    expect(asked.lang).toBe("ru");
  });
});

describe("useSearchCount", () => {
  it("rides the ordinary query, and the wire says so", async () => {
    const server = mockServer({ "/query": { body: searchResponse({ count: 128 }) } });
    const probe = mount(server, { type: "listing", filters: { brand: ["bosch"] } });

    await waitFor(() => {
      expect(probe.last()?.status).toBe("ready");
    });
    const query = server.lastQuery("/query");
    expect(query?.get("type")).toBe("listing");
    expect(query?.get("limit")).toBe(String(SEARCH_COUNT_PAGE_SIZE));
    expect(query?.get("facets")).toBe("off");
    expect(query?.getAll("f.brand")).toEqual(["bosch"]);
    expect(query?.get("anchor")).toBeNull();
    expect(query?.get("sort")).toBeNull();
  });

  it("reads an exact total as exact", async () => {
    const server = mockServer({
      "/query": { body: searchResponse({ count: 128, exact_total: true }) },
    });
    const probe = mount(server, LISTING);
    await waitFor(() => {
      expect(probe.last()?.status).toBe("ready");
    });
    const state = probe.last();
    expect(state?.status === "ready" && state.data).toEqual({
      count: 128,
      kind: "exact",
    });
  });

  it("reads a lower bound as a floor, never as a total", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({ count: 500, count_is_lower_bound: true }),
      },
    });
    const probe = mount(server, LISTING);
    await waitFor(() => {
      expect(probe.last()?.status).toBe("ready");
    });
    const state = probe.last();
    expect(state?.status === "ready" && state.data.kind).toBe("at_least");
  });

  it("reads `count: null` as unknown, and NOT as zero", async () => {
    const server = mockServer({
      "/query": { body: searchResponse({ count: null }) },
    });
    const probe = mount(server, LISTING);
    await waitFor(() => {
      expect(probe.last()?.status).toBe("ready");
    });
    const state = probe.last();
    expect(state?.status === "ready" && state.data).toEqual({
      count: null,
      kind: "unknown",
    });
  });

  it("keeps a refusal a refusal", async () => {
    const server = mockServer({ "/query": { status: 503, body: {} } });
    const probe = mount(server, LISTING);
    await waitFor(() => {
      expect(probe.last()?.status).toBe("failed");
    });
  });

  it("asks nothing at all while disabled", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    const probe = mount(server, LISTING, { enabled: false });
    await waitFor(() => {
      expect(probe.last()?.status).toBe("loading");
    });
    expect(server.calls).toHaveLength(0);
  });

  it("asks the FIRST state immediately — an opening panel does not wait", async () => {
    const server = mockServer({ "/query": { body: searchResponse({ count: 7 }) } });
    const probe = mount(server, LISTING, { debounceMs: 10_000 });
    await waitFor(() => {
      expect(probe.last()?.status).toBe("ready");
    });
    expect(server.calls).toHaveLength(1);
  });

  it("coalesces a run of changes into one request, for the LAST of them", async () => {
    const server = mockServer({ "/query": { body: searchResponse({ count: 3 }) } });
    const control: { keyboard?: (next: string) => void } = {};
    render(
      <TestProviders server={server}>
        <TypingProbe
          debounceMs={300}
          bind={(setter) => {
            control.keyboard = setter;
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      // The first question goes out at once — an opening panel says its
      // number without waiting for a debounce nobody started.
      expect(server.calls).toHaveLength(1);
    });

    for (const next of ["ho", "hon", "hond", "honda"]) {
      await act(async () => {
        control.keyboard?.(next);
      });
    }
    // Still one: no intermediate prefix was ever asked about.
    expect(server.calls).toHaveLength(1);

    await waitFor(() => {
      expect(server.calls).toHaveLength(2);
    });
    expect(new URL(server.calls[1]?.url ?? "").searchParams.get("q")).toBe(
      "honda"
    );
  });
});

/** A probe whose question changes from the INSIDE, so the providers (and the
 * query cache underneath them) stay mounted across a run of edits. */
function TypingProbe(props: {
  readonly debounceMs: number;
  readonly bind: (setQ: (next: string) => void) => void;
}): ReactElement {
  const [q, setQ] = useState("h");
  props.bind(setQ);
  return (
    <Probe
      state={{ type: "listing", q }}
      debounceMs={props.debounceMs}
      onState={() => undefined}
    />
  );
}
