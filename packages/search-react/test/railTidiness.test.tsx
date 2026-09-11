/**
 * THREE FILLS AND A BOX THAT IS NOT THERE (owner's tidiness probe, dark theme).
 *
 * All three findings are the same mistake in three places: this pair drawing
 * something the page had already decided.
 *
 *  1. the filter panel's body painted the raised CONTAINER ground — a
 *     270 x 1539 filled slab with no radius and no border, standing on the
 *     page ground beside the feed. `railSurface` names the two arms and the
 *     default is now `"flat"`: the controls, and no box around them;
 *  2. the rail's footer bar painted antd's `colorBgContainer` in BOTH arms — a
 *     second opinion about a colour its parent had already taken, and, once
 *     the body went flat, a lighter strip across the foot of the rail. It now
 *     paints the panel's OWN token and only in the pinned arm, which is the
 *     one that has a scroll port under it;
 *  3. `resultsHeader` mounted a wrapper on the PROP, not on what the prop
 *     rendered, so a host whose header had nothing to say still put a
 *     1392 x 0 element in the block-rhythm column — and an empty child is
 *     charged a gap on both sides, so two real blocks stood 64px apart where
 *     32 is declared, on every feed page.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { RAIL_CLASS, SearchPage } from "../src/default/index.js";
import type { SearchRailSurface } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

/** The width this page draws the rail at. */
const RAIL_WIDTH = 1024;

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

function server() {
  return mockServer({
    "/query": { body: searchResponse({ facets: { brand: { bosch: 12 } } }) },
  });
}

function Page(props: {
  readonly railSurface?: SearchRailSurface;
  readonly resultsHeader?: ReactNode;
}): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      railFrom={RAIL_WIDTH}
      /* The bar says what the filters DID, so it needs a filter to have been
         applied — otherwise there is no bar to read the fill off. */
      footerBar="sticky"
      {...(props.railSurface !== undefined ? { railSurface: props.railSurface } : {})}
      {...(props.resultsHeader !== undefined
        ? { resultsHeader: props.resultsHeader }
        : {})}
    />
  );
}

async function mount(props: Parameters<typeof Page>[0] = {}): Promise<void> {
  setViewport(RAIL_WIDTH);
  render(
    <TestProviders server={server()}>
      <Page {...props} />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("search-results")).toBeTruthy();
  });
}

/** The panel's own themed root: the box inside the rail that paints (or does
 * not paint) the filters' ground. */
function panelRoot(): HTMLElement {
  const rail = document.querySelector<HTMLElement>(`.${RAIL_CLASS}`);
  expect(rail, "the rail is not on this page").not.toBeNull();
  const root = rail?.querySelector<HTMLElement>("[data-stapel-skin-surface]");
  expect(root, "the panel has no themed root").not.toBeNull();
  return root as HTMLElement;
}

describe("<SearchPage railSurface> — the filters are controls, not a slab", () => {
  it("paints NOTHING by default, and states the one colour a bare surface drops", async () => {
    await mount();
    const root = panelRoot();
    expect(root.getAttribute("data-stapel-skin-surface")).toBe("bare");
    /* The slab: a filled 270px column the height of the feed, with no radius
       and no border to make it a card. Nothing paints it now. */
    expect(root.style.backgroundColor).toBe("");
    expect(root.style.background).toBe("");
    /* `"bare"` paints no text colour either, so the panel states the one it
       needs — the theme's own property, resolved at paint time, so it follows
       the brand and the dark side rather than freezing a mode. */
    expect(root.style.color).toBe("var(--stapel-text)");
  });

  it('restores the old ground under railSurface="panel"', async () => {
    await mount({ railSurface: "panel" });
    const root = panelRoot();
    // The substrate's own raised arm, untouched — this is the escape hatch for
    // a page whose ground is an image, not a second implementation of it.
    expect(root.getAttribute("data-stapel-skin-surface")).toBe("raised");
    expect(root.style.backgroundColor).not.toBe("");
    expect(root.style.color).not.toBe("var(--stapel-text)");
  });
});

describe("the rail's footer bar decides no colour of its own", () => {
  /** The bar, once a filter has been applied — see `Page`. */
  async function bar(props: Parameters<typeof Page>[0] = {}): Promise<HTMLElement> {
    await mount(props);
    return screen.getByTestId("facets-footer-bar");
  }

  it("takes the SAME ground the panel takes when it is pinned", async () => {
    /* Pinned over the rail's own scroll port, so it has to be opaque — the
       options scrolling under a transparent floor read through it. What it may
       not do is choose a colour: it paints the token its parent paints, which
       on the flat default is the page's own ground and therefore invisible as
       a fill. It used to paint antd's `colorBgContainer` regardless. */
    const pinned = await bar();
    expect(pinned.getAttribute("data-position")).toBe("sticky");
    expect(pinned.style.background).toBe("var(--stapel-surface)");
    cleanup();

    const onPanel = await bar({ railSurface: "panel" });
    expect(onPanel.style.background).toBe("var(--stapel-surface-raised)");
  });

  it("paints nothing at all in the static arm", async () => {
    /* Nothing scrolls under a bar that sits after the last group, so there is
       no reason for it to have a ground — and a fill with no reason is the
       finding. */
    setViewport(RAIL_WIDTH);
    render(
      <TestProviders server={server()}>
        <StaticFooterPage />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    const row = screen.getByTestId("facets-footer-bar");
    expect(row.getAttribute("data-position")).toBe("static");
    expect(row.style.background).toBe("");
    expect(row.style.backgroundColor).toBe("");
    // …and it keeps the hairline that separates it from the last group: the
    // finding is the FILL, not the edge.
    expect(row.style.borderBlockStart).not.toBe("");
  });
});

function StaticFooterPage(): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      railFrom={RAIL_WIDTH}
      footerBar="static"
    />
  );
}

describe("the results-header slot occupies a box only when it fills one", () => {
  it("generates NO box of its own, so an empty header costs no gap", async () => {
    /* The slot is a node, and a node that renders nothing cannot be told from
       one that renders something until React has run it — so the wrapper is
       mounted on the prop and generates no box. With nothing inside there is
       no flex item and therefore no gap; the block rhythm charged one on each
       side of the empty element, which measured 64px between the two real
       blocks where 32 is declared. */
    await mount({ resultsHeader: null });
    const slot = screen.getByTestId("search-results-header");
    expect(slot.style.display).toBe("contents");
    expect(slot.childElementCount).toBe(0);
  });

  it("still names the slot when the host DOES fill it", async () => {
    await mount({ resultsHeader: <span data-testid="host-header">Kazan</span> });
    const slot = screen.getByTestId("search-results-header");
    expect(slot.style.display).toBe("contents");
    /* `display: contents` drops the wrapper's box, so the host's own element
       is the rhythm column's child and takes exactly one gap. The testid
       survives either way, which is what lets a consumer stylesheet delete its
       `:empty` stand-in rule. */
    expect(slot.contains(screen.getByTestId("host-header"))).toBe(true);
  });
});
