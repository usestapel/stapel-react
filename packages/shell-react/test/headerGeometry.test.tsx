/**
 * THE HEADER'S GEOMETRY IS PUBLISHED, AND THE PINNING IS A PROP.
 *
 * Everything a storefront pins under a fixed header — a filter rail, a sort
 * bar, a floating "back to top", a category strip — offsets itself by the
 * header's height, and this component owned that number privately. The fleet's
 * storefront answered the only way it could: it restated `56` and `64` in its
 * own sheet and then wrote a unit test that reads the INSTALLED `dist` as text
 * to hold them there. That gate exists because the geometry was private, not
 * because it should be checked.
 *
 * The same paragraph applies to `position: sticky`. The shell pinned its header
 * in `phoneChrome="dock"` and nowhere else, so a desktop storefront had a
 * header that scrolled away and a phone that did not — an inconsistency inside
 * one app — and the fix was a host sheet rule over
 * `[data-testid="public-shell-header"]`, i.e. a geometry decision taken outside
 * the component that owns the geometry.
 *
 * jsdom lays nothing out, and nothing here needs it: every claim below is about
 * what the component DECLARES — an exported number, a rule in the hoisted
 * sheet, an inline `position`, an attribute.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { breakpoints, spacing } from "@stapel/tokens";
import {
  DEFAULT_HEADER_SCROLL_THRESHOLDS,
  HEADER_HEIGHT_DESKTOP,
  HEADER_HEIGHT_PHONE,
  HEADER_HEIGHT_VAR,
  PUBLIC_HEADER_CLASS,
  PUBLIC_SHELL_CLASS,
  PublicShell,
  SCROLL_SENTINEL_HEIGHT,
  headerScrollThresholds,
  publicShellCss,
} from "../src/default/index.js";
import type { PublicShellProps } from "../src/default/index.js";
import { registerShellI18n } from "../src/i18n/keys.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  window.dispatchEvent(new Event("resize"));
}

const PHONE = 390;
const DESKTOP = 1440;

function wrap(props: Partial<PublicShellProps> = {}): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerShellI18n(i18n);
  return (
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<PublicShell nav={[]} {...props} />}>
            <Route path="/" element={<div>Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("the header height is the shell's to publish", () => {
  it("exports both numbers, in the spacing currency they are written in", () => {
    // The steps, not two typed pixel values: a scale change moves the header
    // and this assertion together, which is the whole point of the currency.
    expect(HEADER_HEIGHT_DESKTOP).toBe(spacing[8]);
    expect(HEADER_HEIGHT_PHONE).toBe(spacing[7] + spacing[2]);
  });

  it("is the number actually written on the header element", () => {
    setViewportWidth(DESKTOP);
    render(wrap());
    expect(screen.getByTestId("public-shell-header").style.height).toBe(
      `${String(HEADER_HEIGHT_DESKTOP)}px`
    );
    cleanup();
    setViewportWidth(PHONE);
    render(wrap({ phoneChrome: "dock" }));
    expect(screen.getByTestId("public-shell-header").style.height).toBe(
      `${String(HEADER_HEIGHT_PHONE)}px`
    );
  });

  it("publishes it as a custom property on the shell's own root", () => {
    setViewportWidth(DESKTOP);
    render(wrap());
    const root = screen.getByTestId("public-shell");
    // The class is the hook the sheet is hung on — on the shell's OWN root and
    // not on `:root`, so two shells on one page cannot fight over one name.
    expect(root.classList.contains(PUBLIC_SHELL_CLASS)).toBe(true);
    /* The rule itself is IN the document: React 19 hoists the `<style href>`
       into `<head>` and dedupes it, so a page with two shells carries one
       copy. (jsdom's cascade does not resolve custom properties, so what is
       checked is the declaration reaching the document rather than a computed
       value — the same reason the two rungs below are read off the sheet.) */
    const sheets = [...document.querySelectorAll("style")].filter((node) =>
      (node.textContent ?? "").includes(HEADER_HEIGHT_VAR)
    );
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.textContent).toBe(publicShellCss());
  });

  it("switches at the shell's own breakpoint, in a media query rather than a render", () => {
    const css = publicShellCss();
    expect(css).toContain(`@media (min-width:${String(breakpoints.desktop)}px)`);
    expect(css).toContain(
      `${HEADER_HEIGHT_VAR}:${String(HEADER_HEIGHT_DESKTOP)}px`
    );
    expect(css).toContain(`${HEADER_HEIGHT_VAR}:${String(HEADER_HEIGHT_PHONE)}px`);
  });

  it("declares the phone rung for the DOCK chrome only", () => {
    /* In `"drawer"` the phone header wraps to a second line for the search
       field and is `height: auto`. Publishing 56px there would be a wrong
       answer where no answer is the honest one — a host's own
       `var(--stapel-header-height, …)` fallback then stands. */
    expect(publicShellCss()).toContain(
      `.${PUBLIC_SHELL_CLASS}:where([data-phone-chrome="dock"])`
    );
    setViewportWidth(PHONE);
    render(wrap({ phoneChrome: "dock" }));
    expect(screen.getByTestId("public-shell").dataset["phoneChrome"]).toBe("dock");
    cleanup();
    render(wrap());
    expect(screen.getByTestId("public-shell").dataset["phoneChrome"]).toBe("drawer");
  });
});

/**
 * D449 — THE DESKTOP RUNG HAS TO WIN ABOVE THE BREAKPOINT, WHATEVER CHROME THE
 * PHONE WEARS.
 *
 * Measured on the stand at 1440 and at 1280: `--stapel-header-height` resolved
 * to **56px** while the header box was **64px**, and both pinned things on the
 * page read that variable — the filter rail and the results toolbar sat 8px
 * UNDER the header (`hiddenPx: 8` on `/s` and on `/c`, both widths).
 *
 * The cause is cascade, not arithmetic: a media query adds no specificity, so
 * `.stapel-public-shell[data-phone-chrome="dock"]` (0,2,0) outranked
 * `.stapel-public-shell` (0,1,0) inside `@media (min-width:1200px)` at every
 * width. The fix is `:where()` on the dock arm — zero specificity — which
 * leaves ORDER to decide, so the two facts below are the contract:
 *
 *  1. the dock arm's attribute is inside `:where()`, i.e. both rungs weigh the
 *     same;
 *  2. the desktop arm is declared LAST.
 *
 * jsdom resolves no media queries and no custom properties, so a computed
 * `getPropertyValue` here would read `""` at both widths and pass on the very
 * sheet that shipped the defect. What is asserted is the sheet's own
 * specificity and order, which is exactly what the browser decided on.
 */
describe("D449 — which rung wins is decided by order, not by an attribute", () => {
  /** The two HEIGHT rules, in the order the sheet declares them. The sheet also
   * carries the pinned header's seam rules (below), which say nothing about the
   * property and take no part in this cascade. */
  function rules(): readonly { readonly selector: string; readonly inMedia: boolean }[] {
    const css = publicShellCss();
    const out: { selector: string; inMedia: boolean }[] = [];
    for (const line of css.split("\n")) {
      if (!line.includes(HEADER_HEIGHT_VAR)) continue;
      const media = line.startsWith("@media");
      const body = media ? line.slice(line.indexOf("{") + 1) : line;
      const selector = body.slice(0, body.indexOf("{"));
      out.push({ selector, inMedia: media });
    }
    return out;
  }

  /**
   * Selector weight as the cascade counts it: `:where(…)` contributes nothing,
   * so its contents are removed before the classes and attributes are counted.
   * Ids would count too and none are used here — a shell sheet hung on an id
   * would be a different defect.
   */
  function weight(selector: string): number {
    const bare = selector.replace(/:where\([^)]*\)/g, "");
    return (bare.match(/[.[]/g) ?? []).length + (bare.match(/#/g) ?? []).length * 100;
  }

  it("gives the two rungs the same weight, so neither can outrank the other", () => {
    const [dock, desktop] = rules();
    expect(dock?.selector).toBe(
      `.${PUBLIC_SHELL_CLASS}:where([data-phone-chrome="dock"])`
    );
    expect(desktop?.selector).toBe(`.${PUBLIC_SHELL_CLASS}`);
    // (0,1,0) both: one class each, and the dock arm's attribute is inside
    // `:where()`. This is the assertion the shipped sheet failed — it read 2
    // against 1.
    expect(weight(dock?.selector ?? "")).toBe(1);
    expect(weight(desktop?.selector ?? "")).toBe(weight(dock?.selector ?? ""));
  });

  it("declares the desktop rung last, which is what then decides it", () => {
    const list = rules();
    expect(list).toHaveLength(2);
    // Equal weight makes ORDER load-bearing: the desktop arm is the later
    // rule, so above 1200px it is the one that applies — on `dock` and on
    // `drawer` alike.
    expect(list[1]?.inMedia).toBe(true);
    expect(list[0]?.inMedia).toBe(false);
    const css = publicShellCss();
    expect(css.indexOf(String(HEADER_HEIGHT_PHONE))).toBeLessThan(
      css.indexOf(String(HEADER_HEIGHT_DESKTOP))
    );
  });

  it("renders that sheet through the same selector pair at both widths", () => {
    /* The rules are only a contract if the element they are hung on carries
       both hooks — the class and the attribute — at every width, which is what
       made the desktop page match the phone rung in the first place. */
    for (const [width, chrome] of [
      [DESKTOP, "dock"],
      [PHONE, "dock"],
      [DESKTOP, "drawer"],
    ] as const) {
      setViewportWidth(width);
      render(wrap({ phoneChrome: chrome }));
      const root = screen.getByTestId("public-shell");
      expect(root.classList.contains(PUBLIC_SHELL_CLASS)).toBe(true);
      expect(root.dataset["phoneChrome"]).toBe(chrome);
      // …and the sheet in the document is the one asserted above, not a copy
      // some other render produced.
      const sheet = [...document.querySelectorAll("style")].find((node) =>
        (node.textContent ?? "").includes(HEADER_HEIGHT_VAR)
      );
      expect(sheet?.textContent).toBe(publicShellCss());
      cleanup();
    }
  });
});

describe("headerSticky", () => {
  /** The header's own inline `position` — the only declaration in play. */
  function headerPosition(): string {
    return screen.getByTestId("public-shell-header").style.position;
  }

  it("defaults to exactly what the shell did before it existed", () => {
    setViewportWidth(DESKTOP);
    render(wrap());
    expect(headerPosition()).toBe("");
    cleanup();
    setViewportWidth(PHONE);
    render(wrap({ phoneChrome: "dock" }));
    expect(headerPosition()).toBe("sticky");
    cleanup();
    render(wrap());
    expect(headerPosition()).toBe("");
  });

  it('pins the DESKTOP header with "desktop", and only there', () => {
    setViewportWidth(DESKTOP);
    render(wrap({ headerSticky: "desktop" }));
    expect(headerPosition()).toBe("sticky");
    expect(screen.getByTestId("public-shell-header").style.top).toBe("0px");
    cleanup();
    // …and below the edge it says nothing, even in the chrome that used to pin
    // itself: the host named a side.
    setViewportWidth(PHONE);
    render(wrap({ headerSticky: "desktop", phoneChrome: "dock" }));
    expect(headerPosition()).toBe("");
  });

  it("pins both sides with `true` and neither with `false`", () => {
    setViewportWidth(DESKTOP);
    render(wrap({ headerSticky: true }));
    expect(headerPosition()).toBe("sticky");
    cleanup();
    setViewportWidth(PHONE);
    render(wrap({ headerSticky: true }));
    expect(headerPosition()).toBe("sticky");
    cleanup();
    render(wrap({ headerSticky: false, phoneChrome: "dock" }));
    expect(headerPosition()).toBe("");
  });

  it('pins the phone with "phone" and leaves the desktop alone', () => {
    setViewportWidth(PHONE);
    render(wrap({ headerSticky: "phone" }));
    expect(headerPosition()).toBe("sticky");
    cleanup();
    setViewportWidth(DESKTOP);
    render(wrap({ headerSticky: "phone" }));
    expect(headerPosition()).toBe("");
  });
});

describe("the scroll flag", () => {
  /**
   * A stand-in observer whose callbacks the test drives — jsdom ships none.
   *
   * The shell puts TWO observers on one sentinel, one per edge of the
   * hysteresis, and they are told apart the way the browser tells them apart:
   * by their `rootMargin`. The ON edge is the observer with none.
   */
  function stubObserver(): {
    fire: (edge: "on" | "off", intersecting: boolean) => void;
    readonly margins: readonly string[];
  } {
    const registered: { margin: string; cb: IntersectionObserverCallback }[] = [];
    class Stub {
      constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        registered.push({ margin: options?.rootMargin ?? "", cb });
      }
      observe(): void {
        /* the test fires by hand */
      }
      disconnect(): void {
        /* nothing to release */
      }
      unobserve(): void {
        /* nothing to release */
      }
      takeRecords(): [] {
        return [];
      }
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", Stub);
    return {
      get margins() {
        return registered.map((entry) => entry.margin);
      },
      fire(edge, intersecting): void {
        act(() => {
          for (const entry of registered) {
            const isOn = entry.margin === "";
            if (isOn !== (edge === "on")) continue;
            entry.cb(
              [{ isIntersecting: intersecting } as IntersectionObserverEntry],
              {} as IntersectionObserver
            );
          }
        });
      },
    };
  }

  it("is absent entirely until a host asks for it", () => {
    stubObserver();
    setViewportWidth(DESKTOP);
    render(wrap({ headerSticky: true }));
    // Not `"false"`: a host that never asked for the observer must not be able
    // to write a rule that silently never fires.
    expect(
      screen.getByTestId("public-shell-header").hasAttribute("data-scrolled")
    ).toBe(false);
    expect(screen.queryByTestId("public-shell-scroll-sentinel")).toBeNull();
  });

  it("turns the sentinel leaving the viewport into `data-scrolled` on the header", () => {
    const observer = stubObserver();
    setViewportWidth(DESKTOP);
    render(wrap({ headerSticky: true, headerScrollFlag: true }));
    const header = screen.getByTestId("public-shell-header");
    expect(header.dataset["scrolled"]).toBe("false");
    observer.fire("on", false);
    expect(header.dataset["scrolled"]).toBe("true");
    observer.fire("off", true);
    expect(header.dataset["scrolled"]).toBe("false");
  });

  it("costs the document no room for its sentinel", () => {
    stubObserver();
    setViewportWidth(DESKTOP);
    render(wrap({ headerScrollFlag: true }));
    // Taken and given straight back: a sentinel that reserved height would be
    // the shift the whole mechanism exists to avoid. The height is the ON edge
    // now rather than one pixel — the box is what measures the threshold.
    const sentinel = screen.getByTestId("public-shell-scroll-sentinel");
    const on = DEFAULT_HEADER_SCROLL_THRESHOLDS.on;
    expect(sentinel.style.blockSize).toBe(`${String(on)}px`);
    expect(sentinel.style.marginBlockEnd).toBe(`-${String(on)}px`);
    // Above the header in the DOM, so "the page has moved" is measured at the
    // document's first pixel rather than at the header's own.
    expect(
      sentinel.compareDocumentPosition(screen.getByTestId("public-shell-header")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("answers the flag with an observer and no scroll listener of its own", () => {
    stubObserver();
    const add = vi.spyOn(window, "addEventListener");
    setViewportWidth(DESKTOP);
    // `scrollRestoration={false}` is what narrows this to the FLAG. The shell
    // does register one `scroll` listener now — `useRouteScrollReset` needs
    // an offset, and no observer reports one — and that listener is
    // deliberate, passive, and argued in `routeScroll.ts`. The claim here is
    // the one it was always about: the header's "has the page moved" is a
    // THRESHOLD, and a threshold is an `IntersectionObserver`'s to answer off
    // the main thread rather than a handler's to recompute every frame.
    render(wrap({ headerScrollFlag: true, scrollRestoration: false }));
    expect(add.mock.calls.filter(([type]) => type === "scroll")).toEqual([]);
    add.mockRestore();
  });
});

/**
 * D459 — ONE EDGE IS A THRESHOLD, NOT A HYSTERESIS.
 *
 * The flag flipped off a single 1px sentinel, and a trackpad's rubber-band
 * around the top of a page crosses that edge repeatedly inside ONE gesture: the
 * attribute strobed, and with it whatever a brand hung on it. The fleet's
 * storefront was fading its hairline over 120ms so a crossing would at least
 * read as a crossing rather than a flicker — a paint covering for a fact that
 * was wrong.
 *
 * Two edges. On at {@link DEFAULT_HEADER_SCROLL_THRESHOLDS}`.on`, off only back
 * at `.off`, and NOTHING in between — which is what makes the region a person's
 * finger lives in during a rubber-band a region where the flag does not move.
 *
 * jsdom lays nothing out and scrolls nothing, so what is driven here is the
 * observers themselves: each edge is a callback, and the assertion is that
 * neither of them writes the other's answer.
 */
describe("D459 — the scroll flag has two edges", () => {
  function stub(): {
    fire: (edge: "on" | "off", intersecting: boolean) => void;
    readonly margins: readonly string[];
  } {
    const registered: { margin: string; cb: IntersectionObserverCallback }[] = [];
    class Stub {
      constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        registered.push({ margin: options?.rootMargin ?? "", cb });
      }
      observe(): void {
        /* driven by hand */
      }
      disconnect(): void {
        /* nothing to release */
      }
      unobserve(): void {
        /* nothing to release */
      }
      takeRecords(): [] {
        return [];
      }
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", Stub);
    return {
      get margins() {
        return registered.map((entry) => entry.margin);
      },
      fire(edge, intersecting): void {
        act(() => {
          for (const entry of registered) {
            if ((entry.margin === "") !== (edge === "on")) continue;
            entry.cb(
              [{ isIntersecting: intersecting } as IntersectionObserverEntry],
              {} as IntersectionObserver
            );
          }
        });
      },
    };
  }

  it("normalises what a host asks for, and never lets the edges cross", () => {
    expect(headerScrollThresholds(undefined)).toBeNull();
    expect(headerScrollThresholds(false)).toBeNull();
    expect(headerScrollThresholds(true)).toEqual(DEFAULT_HEADER_SCROLL_THRESHOLDS);
    expect(headerScrollThresholds({ on: 24, off: 4 })).toEqual({ on: 24, off: 4 });
    // A negative `off` is a scroll position that does not exist, and an `on`
    // under `off` is not a hysteresis — it is two edges in the wrong order,
    // which would flip the flag both ways inside one pixel.
    expect(headerScrollThresholds({ on: 3, off: -10 })).toEqual({ on: 3, off: 0 });
    expect(headerScrollThresholds({ on: 2, off: 9 })).toEqual({ on: 9, off: 9 });
    // Whole pixels: the sentinel's own height is one of these numbers, and a
    // fractional box is the rounding this mechanism is hardened against.
    expect(headerScrollThresholds({ on: 8.7, off: 0.9 })).toEqual({ on: 8, off: 0 });
  });

  it("does not flip while a rubber-band crosses the OFF edge over and over", () => {
    const observer = stub();
    setViewportWidth(DESKTOP);
    render(wrap({ headerSticky: true, headerScrollFlag: { on: 8, off: 0 } }));
    const header = screen.getByTestId("public-shell-header");
    const seen: string[] = [header.dataset["scrolled"] ?? ""];
    // The gesture: 0 → 1 → 0 → 1 → 0 px. The ON edge (8px) is never reached,
    // so its observer keeps reporting the sentinel as intersecting; the OFF
    // edge's observer toggles with every pixel.
    for (let pass = 0; pass < 3; pass += 1) {
      observer.fire("off", false);
      observer.fire("on", true);
      seen.push(header.dataset["scrolled"] ?? "");
      observer.fire("off", true);
      observer.fire("on", true);
      seen.push(header.dataset["scrolled"] ?? "");
    }
    // Not one flip in six crossings.
    expect(new Set(seen)).toEqual(new Set(["false"]));
  });

  it("flips on at the ON edge and off again only at the OFF edge", () => {
    const observer = stub();
    setViewportWidth(DESKTOP);
    render(wrap({ headerSticky: true, headerScrollFlag: true }));
    const header = screen.getByTestId("public-shell-header");
    // Past 8px: the sentinel is above the window and the flag comes on.
    observer.fire("on", false);
    expect(header.dataset["scrolled"]).toBe("true");
    // Back into the band between the edges — 4px, say. The ON observer sees
    // the sentinel again; the flag must NOT follow it back.
    observer.fire("on", true);
    expect(header.dataset["scrolled"]).toBe("true");
    // …and only the OFF edge puts it back.
    observer.fire("off", true);
    expect(header.dataset["scrolled"]).toBe("false");
  });

  it("measures both edges off ONE sentinel, with the OFF root shifted", () => {
    const observer = stub();
    setViewportWidth(DESKTOP);
    render(wrap({ headerScrollFlag: { on: 8, off: 0 } }));
    expect(screen.getAllByTestId("public-shell-scroll-sentinel")).toHaveLength(1);
    // The ON observer takes the viewport as it is; the OFF observer's root top
    // is moved to `height - off - 1`, so it reports the sentinel as intersecting
    // exactly while the page is at `off` px or less.
    expect([...observer.margins].sort()).toEqual(["", "-7px 0px 0px 0px"]);
    const sentinel = screen.getByTestId("public-shell-scroll-sentinel");
    expect(sentinel.dataset["scrollOn"]).toBe("8");
    expect(sentinel.dataset["scrollOff"]).toBe("0");
  });

  it("gives a host back the single 1px edge with `{ on: 0, off: 0 }`", () => {
    const observer = stub();
    setViewportWidth(DESKTOP);
    render(wrap({ headerScrollFlag: { on: 0, off: 0 } }));
    // The sentinel never goes under one pixel — a zero-area box is not
    // reliably reported as intersecting anything — and with both edges at the
    // document's first pixel the OFF root needs no shift at all.
    const sentinel = screen.getByTestId("public-shell-scroll-sentinel");
    expect(sentinel.style.blockSize).toBe(`${String(SCROLL_SENTINEL_HEIGHT)}px`);
    expect([...observer.margins].sort()).toEqual(["", "0px 0px 0px 0px"]);
  });
});

/**
 * D458 — THE PINNED HEADER PAINTS ITS OWN SEAM.
 *
 * At a fractional scroll offset a one-pixel row of the page showed above the
 * pinned header: the sticky box and the content under it snap to device pixels
 * independently, so at 0.5px there is a device row belonging to neither. The
 * stand's frame-synced scan says the header does not move (`top` 0 and a
 * constant height at every integer step from 0 to 300, at 1570 and at 390), so
 * this is paint and not layout — and paint belongs with the declaration that
 * causes it, which is this component's `position: sticky`.
 *
 * The fleet's storefront was carrying all three rules in its own sheet, over
 * `[data-testid="public-shell-header"]`, with a note saying so.
 *
 * jsdom composites nothing; what is checkable is what the sheet DECLARES and
 * what the header is handed, which is exactly where the defect lived.
 */
describe("D458 — the sticky header's seam", () => {
  const header = `.${PUBLIC_HEADER_CLASS}[data-sticky="true"]`;

  it("paints one pixel above its own box, in its own background", () => {
    const css = publicShellCss();
    const rule = css
      .split("\n")
      .find((line) => line.startsWith(`${header}::before`));
    expect(rule).toBeDefined();
    expect(rule).toContain('content:""');
    expect(rule).toContain("position:absolute");
    expect(rule).toContain("inset-block-start:-1px");
    expect(rule).toContain("block-size:1px");
    expect(rule).toContain("inset-inline:0");
    // `inherit` and never a colour or a token: the header's background is the
    // theme's container role resolved per theme AND per brand, so a second
    // answer here would be right on one deployment and wrong on the next.
    expect(rule).toContain("background:inherit");
    expect(rule).not.toContain("var(--stapel");
    expect(rule).not.toMatch(/#[0-9a-f]{3}/i);
    // Out of flow: it may not cost the box a pixel of height, because
    // `--stapel-header-height` is what four other surfaces pin against.
    for (const property of ["margin", "padding", "min-block-size", "height"]) {
      expect(rule, property).not.toContain(`${property}:`);
    }
  });

  it("does NOT promote the header to its own layer by default", () => {
    /* The field note, and the reason the promotion is a prop: on the owner's
       own Chrome — headed, dark theme, a listing page — a screenshot at ~30px
       of scroll shows the header VISUALLY ABSENT while the DOM reports
       `top: 0`, height 56, opaque, `z-index: 1000`. Reproduced three times,
       and no headless probe ever saw it. A sticky element handed its own layer
       is the suspect, and a header that is not there is a worse defect than a
       hairline — so the strip closes the seam on its own and the layer is
       something a deployment turns on after looking at it.

       `will-change` exists in the sheet exactly once, behind `data-layer`. */
    const css = publicShellCss();
    expect(css).toContain(`${header}[data-layer="true"]{will-change:transform}`);
    expect(css.match(/will-change/g)).toHaveLength(1);
    expect(css).toContain(`${header}{transition:box-shadow`);
    // An actual `transform` would also make the header a containing block for
    // every `position: fixed` descendant, which is a second effect nobody
    // asked for — `will-change` is the promotion and nothing else.
    expect(css).not.toMatch(/[^-]transform:/);

    setViewportWidth(DESKTOP);
    render(wrap({ headerSticky: true }));
    // Absent, not `"false"`: nothing may match on it by accident.
    expect(
      screen.getByTestId("public-shell-header").hasAttribute("data-layer")
    ).toBe(false);
  });

  it("promotes it when a deployment has asked, and only then", () => {
    setViewportWidth(DESKTOP);
    render(wrap({ headerSticky: true, headerLayer: true }));
    expect(screen.getByTestId("public-shell-header").dataset["layer"]).toBe("true");
    cleanup();
    // The rule needs BOTH hooks, so an unpinned header holds no layer however
    // the prop is set: there is no seam to smooth there.
    render(wrap({ headerSticky: false, headerLayer: true }));
    const node = screen.getByTestId("public-shell-header");
    expect(node.dataset["layer"]).toBe("true");
    expect(node.dataset["sticky"]).toBe("false");
  });

  it("transitions the shadow a host hangs on the flag, and not under reduced motion", () => {
    const css = publicShellCss();
    expect(css).toContain("transition:box-shadow 120ms ease-out");
    expect(css).toContain(
      `@media (prefers-reduced-motion:reduce){${header}{transition:none}}`
    );
    // The shadow itself stays the host's: this pair transitions whatever a
    // brand declared and declares none of its own.
    expect(css).not.toContain("box-shadow:");
  });

  it("hangs all of it on the header's own class, gated on the pin", () => {
    setViewportWidth(DESKTOP);
    render(wrap({ headerSticky: true }));
    const node = screen.getByTestId("public-shell-header");
    expect(node.classList.contains(PUBLIC_HEADER_CLASS)).toBe(true);
    expect(node.dataset["sticky"]).toBe("true");
    // The inline declaration the seam exists for is untouched — and it is
    // inline, which is why the sheet does not try to reach it.
    expect(node.style.position).toBe("sticky");
    expect(node.style.top).toBe("0px");
    cleanup();
    // Unpinned: no seam to paint, so the rules do not apply.
    render(wrap({ headerSticky: false }));
    expect(screen.getByTestId("public-shell-header").dataset["sticky"]).toBe("false");
  });
});
