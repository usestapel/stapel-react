/**
 * THE TWO COLUMNS CAN BOTH BE TOLD WHERE THE PAGE'S CHROME ENDS.
 *
 * Every deployment with a fixed header has the same two problems with this page
 * and neither of them could be stated:
 *
 *  1. the filter rail is `position: sticky; top: 0` written INLINE, and an
 *     inline declaration is beaten by nothing but `!important` — so the first
 *     56-64px of the rail (its heading and its first control) sat behind the
 *     header, and the fleet's storefront carried the one `!important` in its
 *     repo aimed at a pair's own geometry to move it;
 *  2. the results TOOLBAR had no element of its own — no class, no
 *     `data-testid` — and in the compact header it was one child of a ~112px
 *     vertical stack. Pinning it cost a `:has()` on the heading beside it, a
 *     `display: contents` to drop the stack's box, and this pair's own rail
 *     breakpoint restated in a media query: three rules aimed at a shape the
 *     pane could change under them at any release.
 *
 * `railTop` and `stickyToolbar` are those two sentences, said by the component
 * that owns the geometry.
 *
 * jsdom lays NOTHING out — every `getBoundingClientRect` is a zero box — so a
 * test here that compared two rects would compare `0,0,0,0` with `0,0,0,0` and
 * pass on a page that overlapped everywhere. What is asserted instead is what
 * the pane DECLARES: the inline styles it writes and the boxes it writes them
 * on, which is where both defects lived.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { RAIL_CLASS, RESULTS_TOOLBAR_CLASS, SearchPage, railStyle } from "../src/default/index.js";
import type { SearchToolbarPin } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

/** The width this page draws the rail at, and the one it draws the sheet at. */
const RAIL_WIDTH = 1024;

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

function server(count: number | null = 25) {
  return mockServer({
    "/query": {
      body: searchResponse({
        count,
        ...(count === null ? { exact_total: false } : {}),
        facets: { brand: { bosch: 12 } },
      }),
    },
  });
}

function Page(props: {
  readonly railTop?: number | string;
  readonly stickyToolbar?: SearchToolbarPin;
}): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      railFrom={RAIL_WIDTH}
      {...(props.railTop !== undefined ? { railTop: props.railTop } : {})}
      {...(props.stickyToolbar !== undefined
        ? { stickyToolbar: props.stickyToolbar }
        : {})}
    />
  );
}

async function mount(
  width: number,
  props: Parameters<typeof Page>[0] = {},
  count: number | null = 25
): Promise<void> {
  setViewport(width);
  render(
    <TestProviders server={server(count)}>
      <Page {...props} />
    </TestProviders>
  );
  // The RESULTS, not just the toolbar: the count arrives with the answer, and
  // half of what this suite asserts is about the frame the count landed in.
  await waitFor(() => {
    expect(screen.getByTestId("search-results")).toBeTruthy();
  });
}

/** The rail element, by the pair's own published class. */
function rail(): HTMLElement {
  const node = document.querySelector<HTMLElement>(`.${RAIL_CLASS}`);
  expect(node, "the rail is not on this page").not.toBeNull();
  return node as HTMLElement;
}

describe("<SearchPage railTop> — the rail starts below the host's chrome", () => {
  it("starts at the top of the window when nothing says otherwise", async () => {
    await mount(RAIL_WIDTH);
    expect(rail().style.top).toBe("0px");
    expect(rail().style.maxHeight).toBe("100dvh");
  });

  it("takes a number as pixels, and moves the height cap with it", async () => {
    await mount(RAIL_WIDTH, { railTop: 64 });
    expect(rail().style.top).toBe("64px");
    /* The cap moves TOGETHER with the offset, and that is the load-bearing
       half: a rail pushed 64px down the window whose cap is still `100dvh`
       ends 64px past the foot of the screen, so its last control is
       unreachable — the internal scroll has scrolled past the window. */
    expect(rail().style.maxHeight).toBe("calc(100dvh - 64px)");
  });

  it("takes a custom property as written, so the height is never restated", async () => {
    // The point of the string arm: `<PublicShell>` publishes its header height
    // as `--stapel-header-height`, and a host that can pass it here types the
    // number in neither place.
    await mount(RAIL_WIDTH, { railTop: "var(--stapel-header-height)" });
    expect(rail().style.top).toBe("var(--stapel-header-height)");
    expect(rail().style.maxHeight).toBe(
      "calc(100dvh - var(--stapel-header-height))"
    );
  });

  it("keeps everything else about the rail exactly as it was", () => {
    // `railStyle` is a copy of the one rail declaration with two properties
    // moved: a sticky rail that lost `alignSelf: flex-start` has nothing to
    // stick to, and one that lost its scrollbar gutter jumps when it appears.
    const moved = railStyle(64);
    const base = railStyle(undefined);
    for (const [key, value] of Object.entries(base)) {
      if (key === "top" || key === "maxHeight") continue;
      expect(moved[key as keyof typeof moved]).toBe(value);
    }
    expect(railStyle("4rem").maxHeight).toBe("calc(100dvh - 4rem)");
  });
});

describe("the results toolbar has an element of its own", () => {
  it("draws it in the WIDE shape, as a direct child of the results column", async () => {
    await mount(RAIL_WIDTH);
    const toolbar = screen.getByTestId("search-results-toolbar");
    expect(toolbar.classList.contains(RESULTS_TOOLBAR_CLASS)).toBe(true);
    /* The column is what a sticky box travels in, and it has to be as tall as
       the feed: the toolbar's own parent holds the results themselves. */
    const column = toolbar.parentElement;
    expect(column).not.toBeNull();
    expect(column?.contains(screen.getByTestId("search-results"))).toBe(true);
    // In this shape the row IS the header block — heading at one end, count
    // and controls at the other — so the heading is inside it.
    expect(toolbar.contains(screen.getByTestId("search-results-heading"))).toBe(
      true
    );
  });

  it("draws it in the COMPACT shape, in a stack with no box of its own", async () => {
    await mount(PHONE_WIDTH);
    const toolbar = screen.getByTestId("search-results-toolbar");
    expect(toolbar.classList.contains(RESULTS_TOOLBAR_CLASS)).toBe(true);
    const stack = screen.getByTestId("search-results-header-compact");
    expect(toolbar.parentElement).toBe(stack);
    /* `display: contents` is the whole trick: the stack generates no box, so
       its three rows are items of the results COLUMN. Without it a sticky
       toolbar can travel ~112px and no further, which on a 390px screen is
       four cards. */
    expect(getComputedStyle(stack).display).toBe("contents");
    expect(stack.parentElement?.contains(screen.getByTestId("search-results"))).toBe(
      true
    );
    // And in this shape the heading is NOT in the row: what pins is one line
    // the height of one phone control, not a slab of chrome.
    expect(toolbar.contains(screen.getByTestId("search-results-heading"))).toBe(
      false
    );
  });
});

describe("<SearchPage stickyToolbar> — the row pins where it stands", () => {
  it("pins the wide shape's row at the offset it was given", async () => {
    await mount(RAIL_WIDTH, {
      stickyToolbar: { top: "var(--stapel-header-height)" },
    });
    const toolbar = screen.getByTestId("search-results-toolbar");
    expect(toolbar.style.position).toBe("sticky");
    expect(toolbar.style.top).toBe("var(--stapel-header-height)");
    // Opaque, or the cards scroll THROUGH the bar — the theme's own surface
    // role, so it follows the brand and the dark side.
    expect(toolbar.style.background).toBe("var(--stapel-surface)");
  });

  it("pins the compact shape's row too, at the same offset", async () => {
    await mount(PHONE_WIDTH, { stickyToolbar: { top: 56 } });
    const toolbar = screen.getByTestId("search-results-toolbar");
    expect(toolbar.style.position).toBe("sticky");
    expect(toolbar.style.top).toBe("56px");
  });

  it("defaults the offset to the top of the window", async () => {
    await mount(RAIL_WIDTH, { stickyToolbar: {} });
    expect(screen.getByTestId("search-results-toolbar").style.top).toBe("0px");
  });

  it("pins nothing at all when nobody asked", async () => {
    await mount(RAIL_WIDTH);
    expect(screen.getByTestId("search-results-toolbar").style.position).toBe("");
  });

  it("costs the column NOTHING in flow", async () => {
    /* A pinned bar that grows padding to breathe over the cards has to give
       the same room back as negative margin, and which spacing that is belongs
       to the host. A row that occupies exactly the box it already occupied
       cannot shift anything, so the pin writes no padding and no margin. */
    await mount(RAIL_WIDTH, { stickyToolbar: { top: 64 } });
    const style = screen.getByTestId("search-results-toolbar").style;
    expect(style.padding).toBe("");
    expect(style.paddingBlock).toBe("");
    expect(style.margin).toBe("");
    expect(style.marginBlock).toBe("");
  });
});

describe("the pinned row cannot change height when the count lands", () => {
  /**
   * The count arrives WITH the answer, one render after the toolbar is already
   * on screen. A row that can wrap grows a second line at that moment, and a
   * bar that grows while it is pinned pushes the first cards of the feed down
   * under the reader's eye. `nowrap` makes the height a constant; the overflow
   * becomes the scroll strip every phone sort row already is.
   */
  function controlsRow(): HTMLElement {
    const toolbar = screen.getByTestId("search-results-toolbar");
    const heading = screen.queryByTestId("search-results-heading");
    // WIDE: the controls are the box after the heading, inside the row.
    // COMPACT: the row IS the controls.
    const wide = heading !== null && toolbar.contains(heading);
    const node = wide ? heading.nextElementSibling : toolbar;
    expect(node).not.toBeNull();
    return node as HTMLElement;
  }

  it("declares one line in the WIDE shape, with and without a count", async () => {
    await mount(RAIL_WIDTH, {}, 25);
    expect(screen.getByTestId("search-count")).toBeTruthy();
    const withCount = getComputedStyle(controlsRow());
    expect(withCount.flexWrap).toBe("nowrap");
    expect(withCount.overflowX).toBe("auto");
    expect(withCount.minInlineSize).toBe("0");
    // Thin and only when there is something to scroll to: an invisible scroll
    // port is indistinguishable from a row that ends where it was cut.
    expect(withCount.scrollbarWidth).toBe("thin");
    cleanup();

    // `count: null` is the server saying it cannot say, and the pane draws no
    // count line at all — the row's OTHER height, and it must be the same one.
    await mount(RAIL_WIDTH, {}, null);
    expect(screen.queryByTestId("search-count")).toBeNull();
    const without = getComputedStyle(controlsRow());
    expect(without.flexWrap).toBe(withCount.flexWrap);
    expect(without.overflowX).toBe(withCount.overflowX);
    expect(without.minInlineSize).toBe(withCount.minInlineSize);
  });

  it("declares one line in the COMPACT shape too", async () => {
    await mount(PHONE_WIDTH, {}, 25);
    const row = getComputedStyle(controlsRow());
    expect(row.flexWrap).toBe("nowrap");
    expect(row.overflowX).toBe("auto");
    expect(row.minInlineSize).toBe("0");
  });
});

describe("there is exactly one sort control on a results page", () => {
  it("in both header shapes — the row that pins is the row the pair drew", async () => {
    /* The temptation with a pair-owned control is for a host to draw a second
       copy in a bar of its own, which is two sort controls over one search and
       the one you press is whichever the layout put under your thumb. Pinning
       the existing row is what makes that unnecessary, so the count is the
       proof the approach held. */
    await mount(RAIL_WIDTH, { stickyToolbar: { top: 64 } });
    expect(screen.getAllByTestId("search-sort")).toHaveLength(1);
    const toolbar = screen.getByTestId("search-results-toolbar");
    expect(toolbar.contains(screen.getByTestId("search-sort"))).toBe(true);
    cleanup();

    await mount(PHONE_WIDTH, { stickyToolbar: { top: 56 } });
    expect(screen.getAllByTestId("search-sort")).toHaveLength(1);
    expect(
      screen
        .getByTestId("search-results-toolbar")
        .contains(screen.getByTestId("search-sort"))
    ).toBe(true);
  });
});
