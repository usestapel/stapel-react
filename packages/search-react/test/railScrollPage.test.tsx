/**
 * THE RAIL CAN SCROLL WITH THE PAGE — `railScroll="page"`.
 *
 * The rail has been its own scroll container since it became sticky, and for
 * the surface that asked for it that is the right answer. It is not the only
 * one: a storefront's owner reads a second scrollbar standing beside the
 * results as a second page, and wants the filter column to travel with the
 * feed in one gesture. That is a HOST's decision about its own surface, so it
 * is a prop — and the default does not move, because every other deployment
 * was measured on the arm it has.
 *
 * What `"page"` is NOT is "sticky off". A rail shorter than the room under the
 * host's chrome still pins at `railTop`; only a rail TALLER than the window
 * goes static, because a stuck box that tall is cut off at the foot of the
 * screen and the page scroll — now the only scroll on the surface — cannot
 * reach its last controls. That test is a MEASUREMENT and it is driven here:
 * jsdom lays nothing out, so every box is a zero box and a suite that trusted
 * the layout would assert "unmeasured" twice and pass on a page that pins a
 * 3000px rail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  RAIL_CLASS,
  RAIL_SCROLLBAR_CLASS,
  RAIL_STYLE_HREF,
  SearchPage,
  railStyle,
} from "../src/default/index.js";
import type { SearchRailScroll } from "../src/default/index.js";
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
/** jsdom's own window height, and the room a short rail fits into. */
const WINDOW_HEIGHT = 768;

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
  setWindowHeight(WINDOW_HEIGHT);
});

/* A hoisted sheet OUTLIVES the tree that asked for it — React puts it in the
   document and `cleanup()` unmounts the tree, not the head. Without this the
   "page" arm would be asserted against a sheet an earlier test mounted, and
   would pass on a page that mounts one itself. */
beforeEach(() => {
  document
    .querySelector(`style[data-href="${RAIL_STYLE_HREF}"]`)
    ?.remove();
});

function setWindowHeight(height: number): void {
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
    writable: true,
  });
}

/**
 * Give ONE element a height, the way a browser would.
 *
 * The hook reads `getBoundingClientRect().height` and jsdom answers 0 to every
 * box, which is the answer the hook refuses to act on ("zero is not a
 * measurement"). Stating the height on the rail alone is the whole measurement
 * this arm turns on, so the suite states it explicitly rather than asserting
 * against a layout nobody performed.
 */
function giveHeight(element: HTMLElement, height: number): void {
  element.getBoundingClientRect = () =>
    ({ ...new DOMRect(0, 0, 280, height), height, width: 280 }) as DOMRect;
}

/** Put a function where the environment has none, and take it away again. */
function install(host: object, name: string, fn: () => void): void {
  Object.defineProperty(host, name, {
    value: fn,
    configurable: true,
    writable: true,
  });
}

function uninstall(host: object, name: string): void {
  Reflect.deleteProperty(host, name);
}

function server() {
  return mockServer({
    "/query": { body: searchResponse({ facets: { brand: { bosch: 12, makita: 9 } } }) },
  });
}

function Page(props: {
  readonly railScroll?: SearchRailScroll;
  readonly railTop?: number | string;
}): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      railFrom={RAIL_WIDTH}
      {...(props.railScroll !== undefined ? { railScroll: props.railScroll } : {})}
      {...(props.railTop !== undefined ? { railTop: props.railTop } : {})}
    />
  );
}

async function mount(props: Parameters<typeof Page>[0] = {}): Promise<HTMLElement> {
  setViewport(RAIL_WIDTH);
  setWindowHeight(WINDOW_HEIGHT);
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

/** Re-measure the way a browser does when the window changes. */
async function remeasure(rail: HTMLElement, sticky: boolean): Promise<void> {
  fireEvent(window, new Event("resize"));
  await waitFor(() => {
    expect(rail.dataset["railSticky"]).toBe(String(sticky));
  });
}

describe("the default arm is untouched", () => {
  it("is the same declaration it has always been", () => {
    /* A SNAPSHOT, written out rather than derived: this is the object every
       other deployment's rail is, and the point of the test is that adding an
       arm to `railStyle` did not move one property of it. */
    expect(railStyle(undefined)).toEqual({
      flex: "0 0 280px",
      minWidth: 280,
      maxWidth: 280,
      position: "sticky",
      top: 0,
      alignSelf: "flex-start",
      maxHeight: "100dvh",
      overflowY: "auto",
      overscrollBehavior: "contain",
      scrollbarGutter: "stable",
      paddingBlockEnd: 8,
    });
    // …and the offset arm on top of it, which is what a host with a header has.
    expect(railStyle("var(--stapel-header-height)")).toEqual({
      ...railStyle(undefined),
      top: "var(--stapel-header-height)",
      maxHeight: "calc(100dvh - var(--stapel-header-height))",
    });
    // Saying the default out loud is the same object again.
    expect(railStyle(64, "internal")).toEqual(railStyle(64));
  });

  it("still mounts the scroll port and its bar on a page that says nothing", async () => {
    const rail = await mount();
    expect(rail.style.overflowY).toBe("auto");
    expect(rail.style.maxHeight).toBe("100dvh");
    expect(rail.classList.contains(RAIL_SCROLLBAR_CLASS)).toBe(true);
    expect(rail.dataset["railScroll"]).toBeUndefined();
  });
});

describe('<SearchPage railScroll="page"> — the page is the only scroll', () => {
  it("declares no scroll port of its own", async () => {
    const rail = await mount({ railScroll: "page" });
    expect(rail.style.overflowY).toBe("");
    expect(rail.style.maxHeight).toBe("");
    expect(rail.style.scrollbarGutter).toBe("");
    expect(rail.style.overscrollBehavior).toBe("");
    // Nor a bar to dress a port it does not have.
    expect(rail.classList.contains(RAIL_SCROLLBAR_CLASS)).toBe(false);
    expect(
      document.querySelector(`style[data-href="${RAIL_STYLE_HREF}"]`)
    ).toBeNull();
    // The column is still a column: fixed width, and able to stick at all.
    expect(rail.style.flex).toBe("0 0 280px");
    expect(rail.style.alignSelf).toBe("flex-start");
  });

  it("pins a SHORT rail and releases a TALL one, by measurement", async () => {
    const rail = await mount({ railScroll: "page" });
    /* Before anything has been measured the rail is static: an unmeasured
       frame degrades to the arm that cannot hide a control. */
    expect(rail.style.position).toBe("static");

    // Short: it fits under the chrome, so it pins exactly like the other arm.
    giveHeight(rail, 600);
    await remeasure(rail, true);
    expect(rail.style.position).toBe("sticky");
    expect(rail.style.top).toBe("0px");
    // …and still no port.
    expect(rail.style.overflowY).toBe("");
    expect(rail.style.maxHeight).toBe("");

    // Tall: a stuck box this tall is cut off at the foot of the screen with no
    // scroll of its own, so it stands in flow and travels with the page.
    giveHeight(rail, 3000);
    await remeasure(rail, false);
    expect(rail.style.position).toBe("static");
    expect(rail.style.top).toBe("");

    // And back, because the height of a rail is a property of the LEAF.
    giveHeight(rail, 400);
    await remeasure(rail, true);
    expect(rail.style.position).toBe("sticky");
  });

  it("counts the host's chrome as room the rail does not have", async () => {
    /* The offset is written twice on purpose: `top` is what sticky uses, and
       `scroll-margin-top` is the one property that MEANS "this much of the top
       of the scrollport is covered" — which is what the fit test reads back,
       resolved to pixels by the engine whether the host wrote a number, a
       `var()` or a `rem`. */
    const rail = await mount({ railScroll: "page", railTop: 64 });
    expect(rail.style.scrollMarginTop).toBe("64px");

    // 720 fits in a 768px window and does NOT fit under a 64px header.
    giveHeight(rail, 720);
    await remeasure(rail, false);
    expect(rail.style.position).toBe("static");

    giveHeight(rail, 700);
    await remeasure(rail, true);
    expect(rail.style.position).toBe("sticky");
    expect(rail.style.top).toBe("64px");
  });

  it("takes the offset as written, so a host's header height is never restated", async () => {
    const rail = await mount({
      railScroll: "page",
      railTop: "var(--stapel-header-height)",
    });
    expect(rail.style.scrollMarginTop).toBe("var(--stapel-header-height)");
    giveHeight(rail, 500);
    await remeasure(rail, true);
    expect(rail.style.top).toBe("var(--stapel-header-height)");
  });

  it("loses the window's room when the window loses it", async () => {
    const rail = await mount({ railScroll: "page" });
    giveHeight(rail, 700);
    await remeasure(rail, true);
    // The window's own height is not the element's: a rotation or a resized
    // window changes the room without changing the rail, which is why there is
    // a window listener beside the element observer.
    setWindowHeight(500);
    await remeasure(rail, false);
    expect(rail.style.position).toBe("static");
  });
});

describe("changing a filter does not move the page", () => {
  it("scrolls nothing and keeps the rail's own element", async () => {
    const rail = await mount({ railScroll: "page" });
    giveHeight(rail, 600);
    await remeasure(rail, true);

    /* jsdom implements none of the three scroll APIs, so they are INSTALLED
       rather than spied on: a call from the page would land on the spy either
       way, and without them a call would throw somewhere in the tree instead
       of being counted here. */
    const pageScroll = vi.fn();
    const intoView = vi.fn();
    const elementScroll = vi.fn();
    install(window, "scrollTo", pageScroll);
    install(Element.prototype, "scrollIntoView", intoView);
    install(Element.prototype, "scrollTo", elementScroll);

    const option = screen.getByTestId("facet-option-brand-bosch");
    fireEvent.click(option);
    await waitFor(() => {
      expect(
        (screen.getByTestId("facet-option-brand-bosch") as HTMLInputElement).checked
      ).toBe(true);
    });

    expect(pageScroll).not.toHaveBeenCalled();
    expect(intoView).not.toHaveBeenCalled();
    expect(elementScroll).not.toHaveBeenCalled();
    /* The rail is the SAME element across the change. A remounted column is
       put at the top of its flow by the browser, which throws a person three
       screens into the results back up the page — the very thing this arm
       exists to prevent, and a thing no `position` assertion would catch. */
    expect(document.querySelector(`.${RAIL_CLASS}`)).toBe(rail);
    expect(rail.style.position).toBe("sticky");

    uninstall(window, "scrollTo");
    uninstall(Element.prototype, "scrollIntoView");
    uninstall(Element.prototype, "scrollTo");
  });
});
