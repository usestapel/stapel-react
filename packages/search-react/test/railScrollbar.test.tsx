/**
 * THE RAIL SCROLLS. THE BAR THAT SAYS SO IS THE SKIN'S.
 *
 * The rail is and stays its own scroll container: a person who has scrolled
 * the filters and ticked one must not find the page has moved under them, and
 * scrolling back up to the controls is the defect the sticky rail was built to
 * end. What was never decided is the BAR — an `overflow-y: auto` box gets the
 * platform's, which on the walked storefront was a grey chrome strip standing
 * beside the filters in a dark theme.
 *
 * `railScrollbar` names the two, and `"styled"` is the default because the
 * system bar was the absence of a decision rather than one.
 *
 * jsdom lays nothing out and can enter no pseudo-class, so what is asserted is
 * what the page DECLARES: which class the rail carries, whether the sheet is
 * mounted at all, and what the rule set says — which is where every state of
 * this bar lives.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  RAIL_CLASS,
  RAIL_SCROLLBAR_CLASS,
  RAIL_STYLE_HREF,
  SearchPage,
  railScrollbarCss,
  railStyle,
} from "../src/default/index.js";
import type { SearchRailScrollbar } from "../src/default/index.js";
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

/* A hoisted sheet OUTLIVES the tree that asked for it — React puts it in the
   document, and `cleanup()` unmounts the tree, not the head. Without this the
   "system" arm would be asserted against a sheet the previous test mounted,
   and would pass on a page that never mounts one. */
beforeEach(() => {
  railSheet()?.remove();
});

function server() {
  return mockServer({
    "/query": { body: searchResponse({ facets: { brand: { bosch: 12 } } }) },
  });
}

function Page(props: {
  readonly railScrollbar?: SearchRailScrollbar;
}): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      railFrom={RAIL_WIDTH}
      {...(props.railScrollbar !== undefined
        ? { railScrollbar: props.railScrollbar }
        : {})}
    />
  );
}

async function mount(props: Parameters<typeof Page>[0] = {}): Promise<HTMLElement> {
  setViewport(RAIL_WIDTH);
  render(
    <TestProviders server={server()}>
      <Page {...props} />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("search-results")).toBeTruthy();
  });
  const node = document.querySelector<HTMLElement>(`.${RAIL_CLASS}`);
  expect(node, "the rail is not on this page").not.toBeNull();
  return node as HTMLElement;
}

/**
 * The rail's own hoisted sheet, wherever React put it.
 *
 * `data-href`, not `href`: React 19 hoists a `<style href precedence>` into the
 * document and renames both attributes on the way, which is exactly why a test
 * that looked for the prop it wrote finds nothing on a page that has the sheet.
 */
function railSheet(): HTMLStyleElement | null {
  return document.querySelector<HTMLStyleElement>(
    `style[data-href="${RAIL_STYLE_HREF}"]`
  );
}

describe("<SearchPage railScrollbar> — the skin's bar by default", () => {
  it("carries the styled-scrollbar class and mounts the rule set", async () => {
    const rail = await mount();
    expect(rail.classList.contains(RAIL_SCROLLBAR_CLASS)).toBe(true);
    expect(railSheet()).not.toBeNull();
  });

  it('leaves the platform bar alone under "system"', async () => {
    const rail = await mount({ railScrollbar: "system" });
    expect(rail.classList.contains(RAIL_CLASS)).toBe(true);
    expect(rail.classList.contains(RAIL_SCROLLBAR_CLASS)).toBe(false);
    // And the sheet is not in the document at all: a rule set whose only
    // selector is a class nothing carries is dead weight.
    expect(railSheet()).toBeNull();
  });

  it("is STILL its own scroll container, in both arms", async () => {
    for (const arm of ["styled", "system"] as const) {
      cleanup();
      const rail = await mount({ railScrollbar: arm });
      expect(rail.style.overflowY).toBe("auto");
      expect(rail.style.maxHeight).toBe("100dvh");
      expect(rail.style.position).toBe("sticky");
      // The gutter belongs to the rail whichever bar draws in it: reserved so
      // the panel's right edge does not move when the thumb arrives.
      expect(railStyle(undefined).scrollbarGutter).toBe("stable");
    }
  });
});

describe("the rule set states BOTH vendor forms", () => {
  it("says it in Firefox's properties and in WebKit's pseudo-elements", () => {
    const css = railScrollbarCss();
    // Firefox reads these two and nothing else.
    expect(css).toContain("scrollbar-width:thin");
    expect(css).toContain("scrollbar-color:");
    // WebKit and Chromium read these.
    expect(css).toContain("::-webkit-scrollbar{inline-size:6px");
    expect(css).toContain("::-webkit-scrollbar-track{background:transparent}");
    expect(css).toContain("::-webkit-scrollbar-thumb{background:transparent;");
  });

  it("keeps the thumb asleep until the rail is pointed at or focused", () => {
    const css = railScrollbarCss();
    const bar = `.${RAIL_SCROLLBAR_CLASS}`;
    // At rest: both vendor forms say transparent.
    expect(css).toContain(`${bar}{scrollbar-width:thin;scrollbar-gutter:stable;`);
    expect(css).toContain("scrollbar-color:transparent transparent}");
    // Awake: hover (a pointer scrolling inside it) and focus-within (a
    // keyboard doing the same).
    expect(css).toContain(
      `${bar}:hover,${bar}:focus-within{scrollbar-color:var(--stapel-border) transparent}`
    );
    expect(css).toContain(
      `${bar}:hover::-webkit-scrollbar-thumb,` +
        `${bar}:focus-within::-webkit-scrollbar-thumb{background:var(--stapel-border)}`
    );
    // A coarse pointer fires neither, so there the thumb stands: a touch
    // surface with an invisible scrollbar is a rail with no sign of its tail.
    expect(css).toContain("@media (pointer:coarse)");
  });

  it("has no track, no arrows and no literal colour", () => {
    const css = railScrollbarCss();
    expect(css).toContain("::-webkit-scrollbar-track{background:transparent}");
    expect(css).not.toContain("scrollbar-button");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/);
  });
});
