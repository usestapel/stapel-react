/**
 * p43 — CLS 0.0586 ON A PARTITION PRESS, AND IT IS THE RAIL RESIZING UNDER
 * ITSELF.
 *
 * The rail SURVIVES the press: `placeholderData: keepPreviousData` has kept the
 * previous answer's groups on screen for three releases, so nothing unmounts.
 * What the reading measured is the window AFTER it — `facet-group-make` and
 * `facet-group-model` changing size as the new axis's facets land, each one
 * taking every group under it along.
 *
 * Two things close it, and neither is a spinner:
 *
 *  1. the panel now SAYS the answer in hand is the previous one
 *     (`FacetPanelBag.refreshing`, `loadStateFromQuery(…, { keepPrevious })`),
 *     and the rail declares it as `data-facets-refreshing` for a host;
 *  2. each group stands on the height it was last SETTLED at until the new
 *     answer lands — its own last measurement, held in a ref, applied as a
 *     `min-block-size` floor. A floor and not a height: a group that needs
 *     more room still takes it.
 *
 * jsdom lays nothing out, so `offsetHeight` is stubbed per group below — which
 * is the honest shape of the assertion anyway: what is checked is that the
 * group reserves THE NUMBER IT MEASURED, not a number this file chose.
 *
 * The wire is deliberately deferred rather than instant: the whole subject is a
 * state that exists only while a request is in flight, and a server that
 * answers inside the click is a server with no such window.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  FACET_HEADING_HEIGHT,
  FACET_OPTION_ROW_HEIGHT,
  FacetPanelPane,
} from "../src/default/index.js";
import { useSearchState } from "../src/index.js";
import type { MockServer, RecordedCall } from "./harness.js";
import { TestHarness } from "./harness.js";
import { searchResponse } from "./fixtures.js";

afterEach(cleanup);

/** The two leaves of one template — a partition, in catalogue terms. */
const LEAF_A = "tools/drills";
const LEAF_B = "tools/saws";

/** One answer's counted axes: slug → value → count. */
type FacetCounts = Record<string, Record<string, number>>;

/** Same axes on both sides, different option counts: the group SURVIVES the
 * press and changes size, which is the shift this file is about. */
const FACETS: Readonly<Record<string, FacetCounts>> = {
  [LEAF_A]: { brand: { bosch: 12, makita: 9 }, condition: { new: 7, used: 18 } },
  [LEAF_B]: {
    brand: { bosch: 3, makita: 2, hilti: 7, dewalt: 4 },
    condition: { new: 2, used: 5 },
  },
};

/** What each group's box measures once it has settled. Read back out of the
 * reservation, so the assertion is about the pair remembering rather than
 * about these numbers. */
const HEIGHTS: Readonly<Record<string, number>> = {
  "facet-group-brand": 132,
  "facet-group-condition": 84,
};

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement): number {
      return HEIGHTS[this.dataset["testid"] ?? ""] ?? 0;
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
});

/**
 * A wire that holds every request until the test lets it go.
 *
 * `mockServer` answers inside the call, which collapses the refreshing window
 * to nothing — there is no frame in which the previous answer is on screen and
 * a newer one is coming, and that frame is the entire subject here.
 */
function deferredServer(): MockServer & { settle: () => Promise<void> } {
  const calls: RecordedCall[] = [];
  let queue: (() => void)[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, method: (init?.method ?? "GET").toUpperCase() });
    const category = new URL(url).searchParams.get("category") ?? LEAF_A;
    const body = searchResponse({ facets: FACETS[category] ?? {} });
    return await new Promise<Response>((resolve) => {
      queue.push(() => {
        resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        );
      });
    });
  }) as typeof globalThis.fetch;
  return {
    fetch: fetchImpl,
    calls,
    lastQuery: (needle) => {
      for (let i = calls.length - 1; i >= 0; i -= 1) {
        const call = calls[i];
        if (call !== undefined && call.url.includes(needle)) {
          return new URL(call.url).searchParams;
        }
      }
      return null;
    },
    async settle(): Promise<void> {
      /* A whole turn of the loop per step: the request is raised in an effect,
         and the answer travels the fetch promise, the client's own parse and
         TanStack's cache before it reaches a render. Repeated because one
         answer can raise the next (a refetch on a key that moved under it). */
      const tick = async (): Promise<void> => {
        await act(async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 0);
          });
        });
      };
      for (let pass = 0; pass < 4; pass += 1) {
        await tick();
        if (queue.length === 0) break;
        const batch = queue;
        queue = [];
        await act(async () => {
          for (const release of batch) release();
        });
      }
      await tick();
    },
  };
}

/** The partition press, as the page performs it: a category change. */
function Partition(): ReactElement {
  const { setCategory } = useSearchState();
  return (
    <button
      type="button"
      data-testid="press-partition"
      onClick={() => {
        setCategory(LEAF_B);
      }}
    >
      saws
    </button>
  );
}

function mount(): MockServer & { settle: () => Promise<void> } {
  const server = deferredServer();
  render(
    <TestHarness server={server} initialSearch={`type=listing&category=${LEAF_A}`}>
      <Partition />
      <FacetPanelPane categoryFilter={false} />
    </TestHarness>
  );
  return server;
}

const rail = (): HTMLElement => screen.getByTestId("search-facets");

describe("the rail says when its answer is in flight", () => {
  it("is not refreshing on a FIRST load — there is nothing to hold still", async () => {
    const server = mount();
    // A skeleton, and the honest flag under it: `refreshing` means "the answer
    // on screen is the previous one", and on a first load there is none.
    expect(rail().dataset["facetsRefreshing"]).toBe("false");
    await server.settle();
    expect(rail().dataset["facetsRefreshing"]).toBe("false");
  });

  it("declares the refreshing attribute for exactly the swap", async () => {
    const server = mount();
    await server.settle();
    expect(await screen.findByTestId("facet-group-brand")).toBeTruthy();
    expect(rail().dataset["facetsRefreshing"]).toBe("false");

    fireEvent.click(screen.getByTestId("press-partition"));
    expect(rail().dataset["facetsRefreshing"]).toBe("true");

    await server.settle();
    expect(rail().dataset["facetsRefreshing"]).toBe("false");
  });

  it("keeps the groups MOUNTED across the swap — the same elements", async () => {
    const server = mount();
    await server.settle();
    const brand = screen.getByTestId("facet-group-brand");
    const condition = screen.getByTestId("facet-group-condition");

    fireEvent.click(screen.getByTestId("press-partition"));
    // Identity, not presence: an element re-created at the same position is a
    // remount, which loses focus, scroll and any open disclosure with it.
    expect(screen.getByTestId("facet-group-brand")).toBe(brand);
    expect(screen.getByTestId("facet-group-condition")).toBe(condition);

    await server.settle();
    expect(screen.getByTestId("facet-group-brand")).toBe(brand);
    // …and the new answer is the one on screen: four makes where there were
    // two, in the box that never moved.
    expect(brand.textContent).toContain("hilti");
  });
});

/** The box a two-option checkbox group DECLARES: its heading, two rows and the
 * gaps between them — see `facetGroupReservedHeight`. Stated here rather than
 * imported as an expression, so a change to the numbers has to be typed twice. */
const DECLARED_TWO_ROWS = FACET_HEADING_HEIGHT + 2 * FACET_OPTION_ROW_HEIGHT + 2 * 4;

describe("a group stands on a box from the first frame", () => {
  it("prefers the height it MEASURED once the answer is in flight", async () => {
    const server = mount();
    await server.settle();
    const brand = screen.getByTestId("facet-group-brand");
    const condition = screen.getByTestId("facet-group-condition");
    // Settled, and the box is the group's own DECLARED one: the measurement
    // lands in a ref and does not re-render, and a floor below the content is
    // invisible. What it buys is that the box is never nothing (p41).
    expect(brand.style.minBlockSize).toBe(`${String(DECLARED_TWO_ROWS)}px`);
    expect(brand.dataset["reservedSource"]).toBe("declared");

    fireEvent.click(screen.getByTestId("press-partition"));
    // Each group's OWN number, which is the whole point: this box was that
    // tall a moment ago, on this deployment, at this width. MEASURED beats
    // declared wherever there is a measurement to prefer.
    expect(brand.style.minBlockSize).toBe(`${String(HEIGHTS["facet-group-brand"])}px`);
    expect(brand.dataset["reserved"]).toBe(String(HEIGHTS["facet-group-brand"]));
    expect(brand.dataset["reservedSource"]).toBe("measured");
    expect(condition.style.minBlockSize).toBe(
      `${String(HEIGHTS["facet-group-condition"])}px`
    );
    expect(brand.dataset["refreshing"]).toBe("true");

    await server.settle();
    // The measured floor is released with the answer — a group that can never
    // shrink again is the ratchet this reserve is careful not to be — and the
    // declared one, which is under the content by construction, stays.
    expect(brand.dataset["reservedSource"]).toBe("declared");
    expect(condition.dataset["reservedSource"]).toBe("declared");
    expect(brand.hasAttribute("data-refreshing")).toBe(false);
  });

  it("falls back to the DECLARED box where nothing was measured", async () => {
    // A layout-free environment reports 0, and a floor of zero is not a
    // reservation. Before p41 that left the group with no box at all — which
    // is also every first mount in a real browser, where there is no previous
    // answer to have measured. The declaration stands in for it.
    Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
    const server = mount();
    await server.settle();
    const brand = screen.getByTestId("facet-group-brand");
    fireEvent.click(screen.getByTestId("press-partition"));
    expect(brand.style.minBlockSize).toBe(`${String(DECLARED_TWO_ROWS)}px`);
    expect(brand.dataset["reserved"]).toBe(String(DECLARED_TWO_ROWS));
    expect(brand.dataset["reservedSource"]).toBe("declared");
    // …and the rail still says what is happening: the attribute is the fact,
    // and the reservation is one skin's use of it.
    expect(rail().dataset["facetsRefreshing"]).toBe("true");
  });
});
