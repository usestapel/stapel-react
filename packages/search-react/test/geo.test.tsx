/**
 * Two properties of the location filter, and neither of them is geography.
 *
 * 1. NOTHING on this surface ever prints a latitude or a longitude. The panel
 *    and the phone chip row both hold `state.geo`, and both used to render it
 *    — "Around 55.756, 37.617" — to a person who had just chosen a place. The
 *    last assertion here is written negatively on purpose: it looks for the
 *    DIGITS anywhere in the rendered page, because a future sentence that
 *    quietly re-introduces them under another key is the same defect.
 *
 * 2. `defaultGeo` centres a fresh search on the visitor without ever
 *    overruling one. The URL is the state, so every rule below is a rule about
 *    who may write to it: a shared link wins, the visitor wins, and the host's
 *    guess only fills a silence.
 *
 * The wire is mocked and nothing else is (`harness`'s `mockServer`): the
 * request the page issues is the observable that proves a centre was applied,
 * and a stubbed provider would have proved only that a stub was called.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SearchPage } from "../src/default/index.js";
import { SearchStateProvider, useSearchState } from "../src/index.js";
import type { SearchGeo } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestProviders, mockServer, useTestParams } from "./harness.js";

/** A point in Moscow — the very one the retired sentence used to print. */
const MOSCOW: SearchGeo = { kind: "center", lat: 55.756, lon: 37.617 };
/** A second point, so "the link won" can be told apart from "the default
 * applied". */
const BERLIN: SearchGeo = { kind: "center", lat: 52.52, lon: 13.405 };

/** A shared link that already means a place. */
const LINK_WITH_GEO = "type=listing&lat=52.52&lon=13.405&radius_km=10";

/** Lets the microtask the URL write schedules actually run, so a rule that
 * misfires on the NEXT commit has its chance to. */
async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// ── 1. the coordinate never reaches the screen ─────────────────────────────

describe("the location filter says where in words, never in coordinates", () => {
  function Page(props: {
    readonly search?: string;
    readonly geoLabel?: string;
    readonly phone?: boolean;
  }): ReactElement {
    const adapter = useTestParams(props.search ?? "type=listing");
    return (
      <SearchPage
        adapter={adapter}
        defaultType="listing"
        filtersLayout={props.phone === true ? "sheet" : "column"}
        {...(props.geoLabel !== undefined ? { geoLabel: props.geoLabel } : {})}
      />
    );
  }

  function mount(props: Parameters<typeof Page>[0] = {}): void {
    render(
      <TestProviders server={mockServer({ "/query": { body: searchResponse() } })}>
        <Page {...props} />
      </TestProviders>
    );
  }

  it("prints the host's name for the place instead of the point", async () => {
    mount({ search: LINK_WITH_GEO, geoLabel: "Berlin Mitte" });
    await waitFor(() => {
      expect(screen.getByTestId("search-geo-summary").textContent).toBe(
        "Berlin Mitte"
      );
    });
  });

  it("says a place is chosen when no host named one", async () => {
    mount({ search: LINK_WITH_GEO });
    await waitFor(() => {
      expect(screen.getByTestId("search-geo-summary").textContent).toBe(
        "A chosen place on the map"
      );
    });
  });

  it("keeps the bbox sentence, which describes an area without measuring it", async () => {
    mount({ search: "type=listing&bbox=52.4,13.3,52.6,13.5" });
    await waitFor(() => {
      expect(screen.getByTestId("search-geo-summary").textContent).toBe(
        "Inside the shown area"
      );
    });
  });

  it("the phone chip carries the same name, and so does the sheet under it", async () => {
    mount({ search: LINK_WITH_GEO, geoLabel: "Berlin Mitte", phone: true });
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-geo").textContent).toBe(
        "Berlin Mitte"
      );
    });
    fireEvent.click(screen.getByTestId("search-chip-geo"));
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-geo-summary").textContent).toBe(
        "Berlin Mitte"
      );
    });
  });

  for (const phone of [false, true]) {
    it(`no digit of the link's point appears anywhere on the ${
      phone ? "phone" : "desktop"
    } surface`, async () => {
      mount({ search: LINK_WITH_GEO, phone });
      await waitFor(() => {
        expect(screen.getByTestId("search-page")).toBeTruthy();
      });
      // The WHOLE rendered page, not the summary line: a coordinate that
      // moved into a chip, a heading or an aria-label is the same leak.
      const text = document.body.textContent ?? "";
      expect(text).not.toContain("52.52");
      expect(text).not.toContain("13.40");
    });
  }
});

// ── 2. defaultGeo fills a silence and nothing else ─────────────────────────

/** Reads the live location out of the state, and offers the way out of it, so
 * a test can watch the URL move in both directions. */
function GeoProbe(): ReactElement {
  const { state, setGeo } = useSearchState();
  return (
    <>
      <span data-testid="geo">{JSON.stringify(state.geo ?? null)}</span>
      <button
        type="button"
        data-testid="geo-clear"
        data-analytics="none"
        data-analytics-reason="test double"
        onClick={() => {
          setGeo(null);
        }}
      >
        anywhere
      </button>
    </>
  );
}

function geoNow(): SearchGeo | null {
  return JSON.parse(screen.getByTestId("geo").textContent ?? "null") as
    | SearchGeo
    | null;
}

/** The provider under a controllable URL, with the default handed in from
 * outside so a test can make it arrive late. */
function Frame(props: {
  readonly initial?: string;
  readonly value: SearchGeo | undefined;
  readonly onAdapter?: (a: {
    readonly search: string;
    readonly history: readonly string[];
  }) => void;
}): ReactElement {
  const adapter = useTestParams(props.initial ?? "type=listing");
  props.onAdapter?.({ search: adapter.search, history: adapter.history });
  return (
    // Handed over unconditionally, `undefined` included: `defaultGeo` is
    // declared `| undefined` precisely so a host still resolving a position
    // can pass what it has without a conditional spread.
    <SearchStateProvider
      adapter={adapter}
      defaultType="listing"
      defaultGeo={props.value}
    >
      <GeoProbe />
    </SearchStateProvider>
  );
}

/** A host whose position resolves on a button press instead of on mount —
 * the browser prompt and the IP round trip, in the only two frames that
 * matter. */
function LateHost(props: { readonly resolved: SearchGeo }): ReactElement {
  const [value, setValue] = useState<SearchGeo | undefined>(undefined);
  return (
    <>
      <button
        type="button"
        data-testid="resolve"
        data-analytics="none"
        data-analytics-reason="test double"
        onClick={() => {
          setValue(props.resolved);
        }}
      >
        resolved
      </button>
      <Frame value={value} />
    </>
  );
}

describe("defaultGeo centres a fresh search and overrules nobody", () => {
  it("applies to a URL that carries no location at all", async () => {
    let latest: { search: string; history: readonly string[] } = {
      search: "",
      history: [],
    };
    render(
      <Frame
        value={MOSCOW}
        onAdapter={(a) => {
          latest = a;
        }}
      />
    );
    await waitFor(() => {
      expect(geoNow()).toEqual(MOSCOW);
    });
    // In the URL, not only in the state — otherwise the link the visitor
    // shares means a different search than the page they are looking at.
    expect(latest.search).toContain("lat=55.756");
    expect(latest.search).toContain("lon=37.617");
  });

  it("REPLACES the history entry — Back leaves the page, it does not undo a centring nobody asked for", async () => {
    let latest: { search: string; history: readonly string[] } = {
      search: "",
      history: [],
    };
    render(
      <Frame
        value={MOSCOW}
        onAdapter={(a) => {
          latest = a;
        }}
      />
    );
    await waitFor(() => {
      expect(geoNow()).toEqual(MOSCOW);
    });
    expect(latest.history).toHaveLength(1);
  });

  it("the URL wins: a shared link's own location is not overwritten", async () => {
    render(<Frame initial={LINK_WITH_GEO} value={MOSCOW} />);
    await waitFor(() => {
      expect(geoNow()).toEqual({ ...BERLIN, radiusKm: 10 });
    });
    await settle();
    expect(geoNow()).toEqual({ ...BERLIN, radiusKm: 10 });
  });

  it("a default that arrives LATE still applies, because the browser prompt is slow", async () => {
    render(<LateHost resolved={MOSCOW} />);
    await waitFor(() => {
      expect(screen.getByTestId("geo")).toBeTruthy();
    });
    // Frame one: the host has nothing yet, and the search is not centred.
    expect(geoNow()).toBeNull();

    fireEvent.click(screen.getByTestId("resolve"));
    await waitFor(() => {
      expect(geoNow()).toEqual(MOSCOW);
    });
  });

  it("applies exactly once: a cleared location stays cleared", async () => {
    render(<Frame value={MOSCOW} />);
    await waitFor(() => {
      expect(geoNow()).toEqual(MOSCOW);
    });

    fireEvent.click(screen.getByTestId("geo-clear"));
    await waitFor(() => {
      expect(geoNow()).toBeNull();
    });
    // The effect re-runs on this very commit: the URL is empty of geo again
    // and `defaultGeo` is still the same value. Nothing in the VALUES tells
    // this apart from the first render, which is why the record of who spoke
    // is a ref and not a comparison.
    await settle();
    expect(geoNow()).toBeNull();
  });

  it("stays cleared even when the host then resolves a different position", async () => {
    render(<LateHost resolved={BERLIN} />);
    await waitFor(() => {
      expect(screen.getByTestId("geo")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("geo-clear"));
    await waitFor(() => {
      expect(geoNow()).toBeNull();
    });

    fireEvent.click(screen.getByTestId("resolve"));
    await settle();
    expect(geoNow()).toBeNull();
  });

  it("the centred search is what actually goes on the wire", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    function Page(): ReactElement {
      const adapter = useTestParams("type=listing");
      return (
        <SearchPage adapter={adapter} defaultType="listing" defaultGeo={MOSCOW} />
      );
    }
    render(
      <TestProviders server={server}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(server.lastQuery("/query")?.get("lat")).toBe("55.756");
    });
    expect(server.lastQuery("/query")?.get("lon")).toBe("37.617");
  });
});
