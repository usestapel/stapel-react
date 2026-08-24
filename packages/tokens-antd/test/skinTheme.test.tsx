// @vitest-environment jsdom
/**
 * `SkinTheme` — the one self-theming wrapper. Its mode is the document's
 * LIVE mode (never `"light"`), it re-themes when the document does, it
 * paints its own surface, and on a phone it raises antd's control height to
 * a real touch target.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { theme as antdTheme } from "antd";
import { breakpoints, colors } from "@stapel/tokens";
import type { ReactElement } from "react";
import { PHONE_CONTROL_HEIGHT, SkinTheme } from "../src/skin.js";
import { installMatchMedia, resetViewportListeners, setDocumentTheme, setViewport } from "./env.js";

function TokenProbe(): ReactElement {
  const { token } = antdTheme.useToken();
  return (
    <span
      data-testid="probe"
      data-control-height={token.controlHeight}
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
