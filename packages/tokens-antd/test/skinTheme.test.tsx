// @vitest-environment jsdom
/**
 * `SkinTheme` — the one self-theming wrapper. Its mode is the document's
 * LIVE mode (never `"light"`), it re-themes when the document does, it
 * paints its own surface, and on a phone it raises antd's control height to
 * a real touch target.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
import { installMatchMedia, resetViewportListeners, setDocumentTheme, setViewport } from "./env.js";

function TokenProbe(): ReactElement {
  const { token } = antdTheme.useToken();
  return (
    <span
      data-testid="probe"
      data-control-height={token.controlHeight}
      data-control-height-sm={token.controlHeightSM}
      data-color-text={token.colorText}
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
