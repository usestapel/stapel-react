/**
 * D473 — THE PINNED TOOLBAR IS OUTRANKED BY THE CARDS THAT SCROLL UNDER IT.
 *
 * Measured on a live classified stand at 1440, on a category page, scrolled
 * 900px:
 *
 *     [data-testid="search-results-toolbar"]  position: sticky, top 64,
 *                                             height 40, opaque, z-index 1
 *     a card's favourite overlay              position: absolute, z-index 2
 *     a card's "1 of N" photo counter         position: absolute, z-index 1
 *
 * So the heart painted OVER the pinned bar, and the counter pill tied with it
 * and won on document order — the bar reading "105 listings / List / Sort"
 * was sliced by a card mid-price at 390, 768 and 1440, in both themes.
 *
 * The card's own layers are CORRECT relative to their card (the heart is above
 * the counter, and the two never meet) and belong to `@stapel/listings-react`.
 * What was wrong is the band: a sticky piece of CHROME has to outrank the
 * content that scrolls beneath it, while still passing under the host's header
 * (`z-index: 1000` from `<PublicShell>`) and under antd's popups, so the sort
 * select still opens over its own bar.
 *
 * ## What these tests assert
 *
 * The RESOLVED stacking relationship — `getComputedStyle(toolbar).zIndex`
 * against `getComputedStyle(overlay).zIndex`, both read off real elements on a
 * rendered page — and not that a constant was passed somewhere. jsdom lays
 * nothing out, but it DOES run the cascade for inline styles and for
 * stylesheet rules whose media it can evaluate, which is exactly the question
 * here: which of two boxes declares the higher layer.
 *
 * The overlay numbers are the ones measured on the stand and are written here
 * as the stand-ins for a feed card's own overlays: this package renders no
 * `listings-react` card and must not depend on one, so the card slot is filled
 * with two absolutely positioned boxes carrying the measured layers.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  RESULTS_TOOLBAR_STICKY_CLASS,
  RESULTS_TOOLBAR_Z_INDEX,
  SearchPage,
  toolbarStickyCss,
} from "../src/default/index.js";
import type { SearchToolbarPin } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

/** The layer a feed card's favourite overlay paints on (measured on the stand,
 * `[data-testid="listings-serp-favorite-overlay"]`). */
const CARD_FAVOURITE_Z = 2;
/** …and its photo counter pill (`listings-serp-photos-counter`). */
const CARD_COUNTER_Z = 1;
/** The shell header the band must still pass UNDER (`<PublicShell>`, measured
 * `z-index: 1000`). */
const SHELL_HEADER_Z = 1000;

const TOOLBAR_ID = "search-results-toolbar";

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

function server() {
  return mockServer({
    "/query": {
      body: searchResponse({ count: 25, facets: { brand: { bosch: 12 } } }),
    },
  });
}

/** A feed card with the two overlays the stand measured, at their own layers. */
function Card(): ReactElement {
  return (
    <div style={{ position: "relative" }} data-testid="feed-card">
      <span
        data-testid="card-favourite"
        style={{ position: "absolute", zIndex: CARD_FAVOURITE_Z }}
      />
      <span
        data-testid="card-counter"
        style={{ position: "absolute", zIndex: CARD_COUNTER_Z }}
      />
    </div>
  );
}

function Page(props: { readonly stickyToolbar?: SearchToolbarPin }): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      railFrom={1024}
      renderCard={() => <Card />}
      {...(props.stickyToolbar !== undefined
        ? { stickyToolbar: props.stickyToolbar }
        : {})}
    />
  );
}

async function mount(props: Parameters<typeof Page>[0] = {}): Promise<void> {
  setViewport(1440);
  render(
    <TestProviders server={server()}>
      <Page {...props} />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getAllByTestId("feed-card").length).toBeGreaterThan(0);
  });
}

/** The resolved layer of an element on the page — the number the browser would
 * sort by, whatever wrote it. */
function layerOf(testId: string): number {
  const [node] = screen.getAllByTestId(testId);
  expect(node, `${testId} is not on this page`).toBeTruthy();
  const value = getComputedStyle(node as HTMLElement).zIndex;
  expect(value, `${testId} declares no z-index`).not.toBe("");
  return Number(value);
}

/**
 * The default pin's rules AS A FINE-POINTER DEVICE APPLIES THEM.
 *
 * jsdom's cascade does not evaluate `(pointer: fine)` (verified: a rule inside
 * that block resolves to nothing, while the same rule under `@media screen`
 * resolves), so the gate is satisfied here by unwrapping the media block —
 * the rules themselves, their selectors and their declarations are the shipped
 * ones, and the selector still has to match the element the page rendered.
 */
function finePointerRules(): string {
  const css = toolbarStickyCss();
  const open = css.indexOf("{");
  expect(css.slice(0, open)).toBe("@media (pointer:fine)");
  return css.slice(open + 1, css.lastIndexOf("}"));
}

describe("the sticky toolbar outranks the cards that scroll under it", () => {
  it("paints above a card's favourite overlay and its counter (host pin)", async () => {
    await mount({ stickyToolbar: { top: 64 } });
    const toolbar = layerOf(TOOLBAR_ID);
    // The defect, stated as the relationship: the heart tied at 2 and won on
    // document order, the counter tied at 1 and won the same way.
    expect(toolbar).toBeGreaterThan(layerOf("card-favourite"));
    expect(toolbar).toBeGreaterThan(layerOf("card-counter"));
  });

  it("still passes UNDER the host's header", async () => {
    await mount({ stickyToolbar: { top: 64 } });
    // A band that outranks the page's own chrome is the same defect upside
    // down: the sort row would then paint over the header it is pinned below.
    expect(layerOf(TOOLBAR_ID)).toBeLessThan(SHELL_HEADER_Z);
  });

  it("paints above them in the DEFAULT pin too, which is a rule and not inline", async () => {
    await mount();
    const toolbar = screen.getByTestId(TOOLBAR_ID);
    expect(toolbar.classList.contains(RESULTS_TOOLBAR_STICKY_CLASS)).toBe(true);
    // The shipped rules, with the device gate satisfied (see `finePointerRules`).
    const sheet = document.createElement("style");
    sheet.textContent = finePointerRules();
    document.head.append(sheet);
    try {
      const resolved = Number(getComputedStyle(toolbar).zIndex);
      expect(resolved).toBeGreaterThan(layerOf("card-favourite"));
      expect(resolved).toBeGreaterThan(layerOf("card-counter"));
      expect(resolved).toBeLessThan(SHELL_HEADER_Z);
    } finally {
      sheet.remove();
    }
  });

  it("publishes the layer it uses, so a host can place its own chrome around it", () => {
    // One number for both arms — the inline pin and the rule set cannot drift
    // apart into a bar that is above the feed on a mouse and under it on a
    // host-supplied pin.
    expect(RESULTS_TOOLBAR_Z_INDEX).toBeGreaterThan(CARD_FAVOURITE_Z);
    expect(RESULTS_TOOLBAR_Z_INDEX).toBeLessThan(SHELL_HEADER_Z);
    expect(toolbarStickyCss()).toContain(`z-index:${String(RESULTS_TOOLBAR_Z_INDEX)}`);
  });
});
