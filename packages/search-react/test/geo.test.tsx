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
 * 2. A LOCATION FILTER IS NEVER APPLIED WITHOUT THE PERSON ASKING. `geoOffer`
 *    is the host's guess about where the visitor is, and this pair does
 *    exactly nothing with it until a control is pressed: no write to the URL,
 *    no history entry, no `lat` on the wire, and — the hardest one to see —
 *    no second request superseding the first.
 *
 *    This replaces `defaultGeo`, which applied the guess under four rules
 *    about not overruling a person. All four held; the outcome was still a
 *    25 km wall around every category leaf that nobody chose, and leaves with
 *    stock reading "nothing found". The rules were not the defect. Applying
 *    at all was.
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

// ── 2. an offer is an offer: nothing is applied until it is pressed ────────

/** Reads the live location AND the standing offer out of the state, and
 * offers both ways to move it, so a test can watch the URL in every
 * direction. */
function GeoProbe(): ReactElement {
  const { state, geoOffer, setGeo, acceptGeoOffer } = useSearchState();
  return (
    <>
      <span data-testid="geo">{JSON.stringify(state.geo ?? null)}</span>
      <span data-testid="offer">{JSON.stringify(geoOffer ?? null)}</span>
      <button
        type="button"
        data-testid="geo-accept"
        data-analytics="none"
        data-analytics-reason="test double"
        onClick={acceptGeoOffer}
      >
        near me
      </button>
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

function offerNow(): SearchGeo | null {
  return JSON.parse(screen.getByTestId("offer").textContent ?? "null") as
    | SearchGeo
    | null;
}

/** The provider under a controllable URL, with the offer handed in from
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
    // Handed over unconditionally, `undefined` included: `geoOffer` is
    // declared `| undefined` precisely so a host still resolving a position
    // can pass what it has without a conditional spread.
    <SearchStateProvider
      adapter={adapter}
      defaultType="listing"
      geoOffer={props.value}
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

describe("a location filter is never applied without the person asking", () => {
  it("an offer does not reach the URL, the state, or the history", async () => {
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
      expect(screen.getByTestId("geo")).toBeTruthy();
    });
    await settle();

    expect(geoNow()).toBeNull();
    expect(latest.search).not.toContain("lat=");
    expect(latest.search).not.toContain("radius_km");
    // Not even a replaced one. The visitor performed no navigation, so the
    // history is still the single entry the page opened on.
    expect(latest.history).toHaveLength(1);
  });

  it("the offer is readable, so a control can invite instead of the pair deciding", async () => {
    render(<Frame value={MOSCOW} />);
    await waitFor(() => {
      expect(offerNow()).toEqual(MOSCOW);
    });
  });

  it("pressing the offer applies it — and PUSHES, so Back takes it off again", async () => {
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
      expect(offerNow()).toEqual(MOSCOW);
    });

    fireEvent.click(screen.getByTestId("geo-accept"));
    await waitFor(() => {
      expect(geoNow()).toEqual(MOSCOW);
    });
    expect(latest.search).toContain("lat=55.756");
    // PUSHED on top of the entry the page opened on: Back is the way off.
    expect(latest.history).toHaveLength(2);
  });

  it("an applied location retires the offer — nothing is offered twice", async () => {
    render(<Frame value={MOSCOW} />);
    await waitFor(() => {
      expect(offerNow()).toEqual(MOSCOW);
    });
    fireEvent.click(screen.getByTestId("geo-accept"));
    await waitFor(() => {
      expect(geoNow()).toEqual(MOSCOW);
    });
    expect(offerNow()).toBeNull();
  });

  it("a link that already carries a place is neither overwritten nor offered an alternative", async () => {
    render(<Frame initial={LINK_WITH_GEO} value={MOSCOW} />);
    await waitFor(() => {
      expect(geoNow()).toEqual({ ...BERLIN, radiusKm: 10 });
    });
    await settle();
    expect(geoNow()).toEqual({ ...BERLIN, radiusKm: 10 });
    expect(offerNow()).toBeNull();
  });

  it("A HAND-TYPED RADIUS IS THE PERSON'S WORD: it survives verbatim, offer or no offer", async () => {
    let latest: { search: string; history: readonly string[] } = {
      search: "",
      history: [],
    };
    render(
      <Frame
        initial="type=listing&lat=52.52&lon=13.405&radius_km=300"
        value={MOSCOW}
        onAdapter={(a) => {
          latest = a;
        }}
      />
    );
    await waitFor(() => {
      expect(geoNow()).toEqual({ ...BERLIN, radiusKm: 300 });
    });
    await settle();
    // Not widened, not narrowed, not replaced by the host's own number.
    expect(geoNow()).toEqual({ ...BERLIN, radiusKm: 300 });
    expect(latest.search).toContain("radius_km=300");
    expect(latest.history).toHaveLength(1);
  });

  it("a cleared location stays cleared, and the offer that comes back is only an offer", async () => {
    render(<Frame value={MOSCOW} />);
    await waitFor(() => {
      expect(offerNow()).toEqual(MOSCOW);
    });
    fireEvent.click(screen.getByTestId("geo-accept"));
    await waitFor(() => {
      expect(geoNow()).toEqual(MOSCOW);
    });

    fireEvent.click(screen.getByTestId("geo-clear"));
    await waitFor(() => {
      expect(geoNow()).toBeNull();
    });
    await settle();
    expect(geoNow()).toBeNull();
  });

  it("an offer that arrives LATE is still only an offer", async () => {
    render(<LateHost resolved={MOSCOW} />);
    await waitFor(() => {
      expect(screen.getByTestId("geo")).toBeTruthy();
    });
    expect(geoNow()).toBeNull();

    fireEvent.click(screen.getByTestId("resolve"));
    await waitFor(() => {
      expect(offerNow()).toEqual(MOSCOW);
    });
    await settle();
    expect(geoNow()).toBeNull();
  });

  it("THE WIRE: one request, and it carries no location the visitor did not ask for", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    function Page(): ReactElement {
      const adapter = useTestParams("type=listing");
      return (
        <SearchPage adapter={adapter} defaultType="listing" geoOffer={MOSCOW} />
      );
    }
    render(
      <TestProviders server={server}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(server.lastQuery("/query")).not.toBeNull();
    });
    await settle();

    expect(server.lastQuery("/query")?.get("lat")).toBeNull();
    expect(server.lastQuery("/query")?.get("radius_km")).toBeNull();
    // The double query, stated as a number. `defaultGeo` wrote the URL after
    // the first fetch had already left, so every leaf and every result page
    // issued two requests and aborted one — visible in a network log as a
    // permanent `ERR_ABORTED`, and invisible everywhere else.
    expect(server.calls.filter((c) => c.url.includes("/query"))).toHaveLength(1);
  });

  it("THE WIRE: the search a person narrowed themselves does carry it", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    function Page(): ReactElement {
      const adapter = useTestParams(
        "type=listing&lat=55.756&lon=37.617&radius_km=25"
      );
      return (
        <SearchPage adapter={adapter} defaultType="listing" geoOffer={MOSCOW} />
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
    expect(server.lastQuery("/query")?.get("radius_km")).toBe("25");
  });
});
