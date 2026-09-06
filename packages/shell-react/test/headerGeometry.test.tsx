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
  HEADER_HEIGHT_DESKTOP,
  HEADER_HEIGHT_PHONE,
  HEADER_HEIGHT_VAR,
  PUBLIC_SHELL_CLASS,
  PublicShell,
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
      `.${PUBLIC_SHELL_CLASS}[data-phone-chrome="dock"]`
    );
    setViewportWidth(PHONE);
    render(wrap({ phoneChrome: "dock" }));
    expect(screen.getByTestId("public-shell").dataset["phoneChrome"]).toBe("dock");
    cleanup();
    render(wrap());
    expect(screen.getByTestId("public-shell").dataset["phoneChrome"]).toBe("drawer");
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
  /** A stand-in observer whose callback the test drives — jsdom ships none. */
  function stubObserver(): { fire: (intersecting: boolean) => void } {
    let callback: IntersectionObserverCallback | undefined;
    class Stub {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
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
      fire(intersecting: boolean): void {
        act(() => {
          callback?.(
            [{ isIntersecting: intersecting } as IntersectionObserverEntry],
            {} as IntersectionObserver
          );
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
    observer.fire(false);
    expect(header.dataset["scrolled"]).toBe("true");
    observer.fire(true);
    expect(header.dataset["scrolled"]).toBe("false");
  });

  it("costs the document no room for its sentinel", () => {
    stubObserver();
    setViewportWidth(DESKTOP);
    render(wrap({ headerScrollFlag: true }));
    // 1px taken and 1px given back: a sentinel that reserved height would be
    // the shift the whole mechanism exists to avoid.
    const sentinel = screen.getByTestId("public-shell-scroll-sentinel");
    expect(sentinel.style.blockSize).toBe("1px");
    expect(sentinel.style.marginBlockEnd).toBe("-1px");
    // Above the header in the DOM, so "the page has moved" is measured at the
    // document's first pixel rather than at the header's own.
    expect(
      sentinel.compareDocumentPosition(screen.getByTestId("public-shell-header")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("registers no scroll listener", () => {
    stubObserver();
    const add = vi.spyOn(window, "addEventListener");
    setViewportWidth(DESKTOP);
    render(wrap({ headerScrollFlag: true }));
    expect(add.mock.calls.filter(([type]) => type === "scroll")).toEqual([]);
    add.mockRestore();
  });
});
