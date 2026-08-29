// @vitest-environment jsdom
/**
 * `SkinTheme` — the one self-theming wrapper. Its mode is the document's
 * LIVE mode (never `"light"`), it re-themes when the document does, it
 * paints its own surface, and on a phone it raises antd's control height to
 * a real touch target.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Checkbox, Rate, theme as antdTheme } from "antd";
import { breakpoints, colors } from "@stapel/tokens";
import type { ReactElement } from "react";
import {
  PHONE_CONTROL_HEIGHT,
  PHONE_TOUCH_FLOOR,
  PHONE_TOUCH_FLOOR_STYLE_HREF,
  SkinTheme,
  phoneTouchFloorCss,
} from "../src/skin.js";
import {
  installMatchMedia,
  resetViewportListeners,
  setDocumentBrand,
  setDocumentTheme,
  setViewport,
} from "./env.js";

function TokenProbe(): ReactElement {
  const { token } = antdTheme.useToken();
  return (
    <span
      data-testid="probe"
      data-control-height={token.controlHeight}
      data-control-height-sm={token.controlHeightSM}
      data-color-text={token.colorText}
      data-color-primary={token.colorPrimary}
    />
  );
}

beforeEach(() => {
  installMatchMedia();
  setViewport(1280);
});

afterEach(async () => {
  cleanup();
  resetViewportListeners();
  await setDocumentTheme(null);
  await setDocumentBrand(null);
  vi.unstubAllGlobals();
});

describe("SkinTheme", () => {
  it("defaults to the document's live mode, not to light", async () => {
    await setDocumentTheme("dark");
    render(
      <SkinTheme data-testid="root">
        <TokenProbe />
      </SkinTheme>
    );
    expect(screen.getByTestId("root").getAttribute("data-stapel-skin-mode")).toBe("dark");
    expect(screen.getByTestId("probe").getAttribute("data-color-text")).toBe(colors.text.dark);
  });

  it("re-themes at runtime when the document flips — light → dark → light", async () => {
    render(
      <SkinTheme data-testid="root">
        <TokenProbe />
      </SkinTheme>
    );
    const root = screen.getByTestId("root");
    expect(root.getAttribute("data-stapel-skin-mode")).toBe("light");
    expect(screen.getByTestId("probe").getAttribute("data-color-text")).toBe(colors.text.light);

    await setDocumentTheme("dark");
    expect(root.getAttribute("data-stapel-skin-mode")).toBe("dark");
    expect(screen.getByTestId("probe").getAttribute("data-color-text")).toBe(colors.text.dark);
    expect(root.style.colorScheme).toBe("dark");

    await setDocumentTheme("light");
    expect(root.getAttribute("data-stapel-skin-mode")).toBe("light");
    expect(screen.getByTestId("probe").getAttribute("data-color-text")).toBe(colors.text.light);
  });

  it("an explicit `mode` pins a side regardless of the document", async () => {
    await setDocumentTheme("dark");
    render(
      <SkinTheme mode="light" data-testid="root">
        <TokenProbe />
      </SkinTheme>
    );
    expect(screen.getByTestId("root").getAttribute("data-stapel-skin-mode")).toBe("light");
    expect(screen.getByTestId("probe").getAttribute("data-color-text")).toBe(colors.text.light);
  });

  it("paints its own surface by default, and nothing when bare", () => {
    // Dark, where the layout and container surfaces are two different
    // colours (light has both at white).
    render(
      <>
        <SkinTheme mode="dark" data-testid="raised">
          <span />
        </SkinTheme>
        <SkinTheme mode="dark" surface="base" data-testid="base">
          <span />
        </SkinTheme>
        <SkinTheme mode="dark" surface="bare" data-testid="bare">
          <span />
        </SkinTheme>
      </>
    );
    const raised = screen.getByTestId("raised");
    const base = screen.getByTestId("base");
    const bare = screen.getByTestId("bare");
    expect(raised.style.backgroundColor).not.toBe("");
    expect(raised.style.color).not.toBe("");
    expect(base.style.backgroundColor).not.toBe("");
    expect(base.style.backgroundColor).not.toBe(raised.style.backgroundColor);
    expect(bare.style.backgroundColor).toBe("");
    expect(bare.style.color).toBe("");
    expect(bare.getAttribute("data-stapel-skin-surface")).toBe("bare");
  });

  it("raises antd's controlHeight to a 44px touch target on a phone only", () => {
    setViewport(390);
    render(
      <SkinTheme>
        <TokenProbe />
      </SkinTheme>
    );
    expect(screen.getByTestId("probe").getAttribute("data-control-height")).toBe(
      String(PHONE_CONTROL_HEIGHT)
    );
    cleanup();

    setViewport(breakpoints.tablet);
    render(
      <SkinTheme>
        <TokenProbe />
      </SkinTheme>
    );
    expect(Number(screen.getByTestId("probe").getAttribute("data-control-height"))).toBeLessThan(
      PHONE_CONTROL_HEIGHT
    );
  });

  it("follows a rotation across the breakpoint while mounted", () => {
    setViewport(1280);
    render(
      <SkinTheme>
        <TokenProbe />
      </SkinTheme>
    );
    const probe = screen.getByTestId("probe");
    expect(probe.getAttribute("data-control-height")).not.toBe(String(PHONE_CONTROL_HEIGHT));
    setViewport(390);
    expect(probe.getAttribute("data-control-height")).toBe(String(PHONE_CONTROL_HEIGHT));
  });
});

/** Every stylesheet currently in the document, as one string. */
function headCss(): string {
  return [...document.querySelectorAll("style")].map((el) => el.textContent ?? "").join("\n");
}

describe("SkinTheme — a nested bare skin inherits the pin above it (NC-THEMESCOPE)", () => {
  it("renders dark inside a pinned dark parent while the document is light", () => {
    render(
      <SkinTheme mode="dark" data-testid="outer">
        <SkinTheme data-testid="inner">
          <TokenProbe />
        </SkinTheme>
      </SkinTheme>
    );
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(screen.getByTestId("outer").getAttribute("data-stapel-skin-mode")).toBe("dark");
    expect(screen.getByTestId("inner").getAttribute("data-stapel-skin-mode")).toBe("dark");
    expect(screen.getByTestId("inner").style.colorScheme).toBe("dark");
    expect(screen.getByTestId("probe").getAttribute("data-color-text")).toBe(colors.text.dark);
  });

  it("lets a child pin the other side explicitly, and a grandchild inherit THAT", async () => {
    await setDocumentTheme("dark");
    render(
      <SkinTheme mode="dark">
        <SkinTheme mode="light" data-testid="island">
          <SkinTheme data-testid="leaf">
            <TokenProbe />
          </SkinTheme>
        </SkinTheme>
      </SkinTheme>
    );
    expect(screen.getByTestId("island").getAttribute("data-stapel-skin-mode")).toBe("light");
    expect(screen.getByTestId("leaf").getAttribute("data-stapel-skin-mode")).toBe("light");
    expect(screen.getByTestId("probe").getAttribute("data-color-text")).toBe(colors.text.light);
  });

  it("still follows the document when nothing above it is pinned", async () => {
    render(
      <SkinTheme>
        <SkinTheme data-testid="inner">
          <TokenProbe />
        </SkinTheme>
      </SkinTheme>
    );
    expect(screen.getByTestId("inner").getAttribute("data-stapel-skin-mode")).toBe("light");
    await setDocumentTheme("dark");
    expect(screen.getByTestId("inner").getAttribute("data-stapel-skin-mode")).toBe("dark");
  });
});

describe("SkinTheme — the phone touch floor beyond controlHeight (NC-TAP44)", () => {
  it("raises the small control height to the floor too, and only on a phone", () => {
    setViewport(390);
    render(
      <SkinTheme>
        <TokenProbe />
      </SkinTheme>
    );
    expect(screen.getByTestId("probe").getAttribute("data-control-height-sm")).toBe(
      String(PHONE_CONTROL_HEIGHT)
    );
    cleanup();
    setViewport(1280);
    render(
      <SkinTheme>
        <TokenProbe />
      </SkinTheme>
    );
    expect(Number(screen.getByTestId("probe").getAttribute("data-control-height-sm"))).toBeLessThan(
      PHONE_CONTROL_HEIGHT
    );
  });

  it("gives a rate star a 44px pitch: glyph plus gap", () => {
    const rate = PHONE_TOUCH_FLOOR.components["Rate"] as { starSize: number; marginXS: number };
    expect(rate.starSize + rate.marginXS).toBeGreaterThanOrEqual(PHONE_CONTROL_HEIGHT);
    setViewport(390);
    render(
      <SkinTheme>
        <Rate />
      </SkinTheme>
    );
    // antd's own generated stylesheet carries the phone glyph size as the
    // component's custom property (antd 6 emits component tokens as CSS vars).
    const rule = headCss().match(/--ant-rate-star-size:(\d+)px/);
    expect(rule?.[1]).toBe(String(rate.starSize));
  });

  it("stamps the phone root and hoists ONE stylesheet with the row/glyph hit areas", () => {
    setViewport(390);
    render(
      <>
        <SkinTheme data-testid="a">
          <Checkbox>One</Checkbox>
        </SkinTheme>
        <SkinTheme data-testid="b">
          <Checkbox>Two</Checkbox>
        </SkinTheme>
      </>
    );
    expect(screen.getByTestId("a").hasAttribute("data-stapel-skin-phone")).toBe(true);
    const sheets = [...document.querySelectorAll(`style[data-href="${PHONE_TOUCH_FLOOR_STYLE_HREF}"]`)];
    expect(sheets).toHaveLength(1);
    const css = sheets[0]?.textContent ?? "";
    expect(css).toBe(phoneTouchFloorCss("ant"));
    for (const selector of [".ant-rate-star", ".ant-checkbox-wrapper", ".ant-radio-wrapper", ".ant-tag-checkable", ".ant-list-item"]) {
      expect(css).toContain(selector);
    }
    expect(css).toContain(`min-height:${String(PHONE_CONTROL_HEIGHT)}px`);
    // Every rule is scoped under a phone skin root — a desktop skin never pays it.
    for (const rule of css.split("\n")) {
      expect(rule.startsWith("[data-stapel-skin-root][data-stapel-skin-phone]")).toBe(true);
    }
  });

  it("stamps no phone root at tablet width and above, so the hoisted rules match nothing", () => {
    setViewport(breakpoints.tablet);
    render(
      <SkinTheme data-testid="wide">
        <span />
      </SkinTheme>
    );
    expect(screen.getByTestId("wide").hasAttribute("data-stapel-skin-phone")).toBe(false);
  });
});

/**
 * The host's brand is resolved at RUNTIME on a multibrand deployment — one
 * image, N hosts — so `<html data-brand>` is stamped by an effect, AFTER the
 * render that built the antd theme from the live custom properties. Watching
 * only `data-theme` therefore left every antd control (primary buttons, focus
 * rings, links) painted in the brand the page happened to boot with, on every
 * host but the fallback's own (owner report 2026-08-30, found live). The
 * substrate has to follow BOTH attributes `tokens.css` keys on, so that a
 * host does not have to know that only one of them is watched.
 *
 * jsdom resolves no custom properties through `getComputedStyle` (a
 * long-standing jsdom limitation — see `toAntdThemeLiveCss.test.ts`), so the
 * scoped ramps `:root[data-brand="…"]` would emit in a real browser are
 * stood up here as a `getComputedStyle` that answers `--stapel-*` from the
 * document's CURRENT `data-brand`. Every other property, and every other
 * element, is the real declaration.
 */
type Ramp = Readonly<Record<string, string>>;

function stubScopedBrandRamps(ramps: Readonly<Record<string, Ramp>>): void {
  const real = window.getComputedStyle.bind(window);
  vi.stubGlobal("getComputedStyle", ((element: Element, pseudo?: string | null) => {
    const declaration = real(element as HTMLElement, pseudo ?? undefined);
    if (element !== document.documentElement) return declaration;
    return new Proxy(declaration, {
      get(target, prop) {
        if (prop === "getPropertyValue") {
          return (name: string): string => {
            const scope = ramps[document.documentElement.dataset.brand ?? ""];
            return scope?.[name] ?? target.getPropertyValue(name);
          };
        }
        const value = Reflect.get(target, prop, target) as unknown;
        return typeof value === "function"
          ? (value as (...args: never[]) => unknown).bind(target)
          : value;
      },
    });
  }) as typeof getComputedStyle);
}

function primary(): string | null {
  return screen.getByTestId("probe").getAttribute("data-color-primary");
}

function text(): string | null {
  return screen.getByTestId("probe").getAttribute("data-color-text");
}

describe("SkinTheme — the skin repaints when the host brand attribute changes", () => {
  const UNSCOPED = "#5b21b6";
  const ALPHA = "#1677ff";
  const BETA = "#ff4d4f";

  it("rebuilds antd's token bag when data-brand is stamped after mount", async () => {
    stubScopedBrandRamps({
      "": { "--stapel-brand": UNSCOPED },
      alpha: { "--stapel-brand": ALPHA },
      beta: { "--stapel-brand": BETA },
    });
    render(
      <SkinTheme data-testid="root">
        <TokenProbe />
      </SkinTheme>
    );
    expect(primary()).toBe(UNSCOPED);

    // What a multibrand host's site provider does once the host→brand
    // lookup answers: an effect, one render too late for anything that
    // only watches `data-theme`.
    await setDocumentBrand("alpha");
    expect(primary()).toBe(ALPHA);

    await setDocumentBrand("beta");
    expect(primary()).toBe(BETA);

    await setDocumentBrand(null);
    expect(primary()).toBe(UNSCOPED);
  });

  it("repaints a nested self-wrapping skin too — the outer one owns the config", async () => {
    stubScopedBrandRamps({
      "": { "--stapel-brand": UNSCOPED },
      alpha: { "--stapel-brand": ALPHA },
    });
    render(
      <SkinTheme data-testid="outer">
        <SkinTheme surface="bare">
          <TokenProbe />
        </SkinTheme>
      </SkinTheme>
    );
    expect(primary()).toBe(UNSCOPED);
    await setDocumentBrand("alpha");
    expect(primary()).toBe(ALPHA);
  });

  it("keys the cache on the scope, not only on the brand value two ramps can share", async () => {
    // Two scoped ramps with the SAME `--stapel-brand` and a different text
    // role: `hostBrandFingerprint` alone reports one string for both, so a
    // cache keyed on it would serve the first scope's config to the second.
    // (Scope names unique to this test, because the config cache is
    // process-wide by design — a key is a promise about the ramp behind it.)
    const SHARED = "#0ea5e9";
    stubScopedBrandRamps({
      "": { "--stapel-brand": UNSCOPED },
      "twin-a": { "--stapel-brand": SHARED, "--stapel-text": "#101828" },
      "twin-b": { "--stapel-brand": SHARED, "--stapel-text": "#202939" },
    });
    render(
      <SkinTheme data-testid="root">
        <TokenProbe />
      </SkinTheme>
    );
    await setDocumentBrand("twin-a");
    expect(primary()).toBe(SHARED);
    expect(text()).toBe("#101828");

    await setDocumentBrand("twin-b");
    expect(primary()).toBe(SHARED);
    expect(text()).toBe("#202939");
  });

  it("still follows a data-theme flip while a brand scope is stamped", async () => {
    await setDocumentBrand("alpha");
    render(
      <SkinTheme data-testid="root">
        <TokenProbe />
      </SkinTheme>
    );
    expect(screen.getByTestId("root").getAttribute("data-stapel-skin-mode")).toBe("light");
    await setDocumentTheme("dark");
    expect(screen.getByTestId("root").getAttribute("data-stapel-skin-mode")).toBe("dark");
    expect(text()).toBe(colors.text.dark);
  });
});
