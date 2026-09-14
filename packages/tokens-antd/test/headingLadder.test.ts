// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fontFamily, fontSize, fontWeight } from "@stapel/tokens";
import { toAntdTheme } from "../src/index.js";

/**
 * THE LADDER GOVERNS HEADINGS — measured defect, 2026-09-13.
 *
 * antd derives `fontSizeHeading1..5` from the base `fontSize` by its own
 * ratios. So a host's type scale governed body text and nothing else: on one
 * deployment `h1` rendered at **42px** and `h2` at **34px**, and neither
 * number exists in that host's scale OR in this dictionary's default
 * (12/14/16/18/22/28/36). The steps were unreachable — a ladder nobody could
 * climb — and the host could not fix it from its own theme at all.
 *
 * Same defect on two more axes, found in the same read:
 *
 *  - `fontFamily` was the compiled-in `fontFamily.sans`, never the live var.
 *    A host that set `scales.fontFamily` got the new stack in its generated
 *    `tokens.css` and the OLD one in every antd control — the sheet and the
 *    page disagreeing about one token.
 *  - `fontWeightStrong` was antd's 600. A brand whose family ships only 400
 *    and 700 got a SYNTHESISED 600 on every heading and every
 *    `<Typography.Text strong>`.
 *
 * These assert the mapping and the live override, because "320 tests pass"
 * was true before the fix as well — the old behaviour was not asserted
 * anywhere, which is exactly how it survived.
 */
function stubVars(vars: Record<string, string>): void {
  vi.stubGlobal(
    "getComputedStyle",
    vi.fn().mockReturnValue({
      getPropertyValue: (prop: string) => vars[prop] ?? "",
    } as CSSStyleDeclaration)
  );
}

describe("the type ladder governs antd's headings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps heading 1..5 onto the dictionary's own top five steps", () => {
    stubVars({});
    const t = toAntdTheme("light");
    expect(t.fontSizeHeading1).toBe(fontSize["3xl"].fontSize);
    expect(t.fontSizeHeading2).toBe(fontSize["2xl"].fontSize);
    expect(t.fontSizeHeading3).toBe(fontSize.xl.fontSize);
    expect(t.fontSizeHeading4).toBe(fontSize.lg.fontSize);
    expect(t.fontSizeHeading5).toBe(fontSize.md.fontSize);
  });

  it("takes a host's LIVE step over the compiled-in one", () => {
    /* A host ladder with h1 32 and h2 26, where antd derived 42 and 34. A
       host sets these by regenerating its own tokens.css, with no code. */
    stubVars({
      "--stapel-font-size-3xl": "32px",
      "--stapel-font-size-2xl": "26px",
      "--stapel-font-size-xl": "21px",
    });
    const t = toAntdTheme("light");
    expect(t.fontSizeHeading1).toBe(32);
    expect(t.fontSizeHeading2).toBe(26);
    expect(t.fontSizeHeading3).toBe(21);
    // Untouched steps still fall through to the dictionary.
    expect(t.fontSizeHeading4).toBe(fontSize.lg.fontSize);
  });

  it("never lets antd's derivation back in when a step is absent", () => {
    // An empty var must fall back to the LADDER, not to antd's ratio — the
    // whole defect was a heading size that came from neither.
    stubVars({ "--stapel-font-size-3xl": "" });
    expect(toAntdTheme("light").fontSizeHeading1).toBe(fontSize["3xl"].fontSize);
  });

  it("takes the emphasis weight from the host, not antd's 600", () => {
    stubVars({});
    expect(toAntdTheme("light").fontWeightStrong).toBe(fontWeight.bold);
    stubVars({ "--stapel-font-weight-bold": "700" });
    expect(toAntdTheme("light").fontWeightStrong).toBe(700);
  });

  it("reads the family live, so a regenerated stack reaches the controls", () => {
    stubVars({});
    expect(toAntdTheme("light").fontFamily).toBe(fontFamily.sans);
    stubVars({ "--stapel-font-family-sans": "Manrope, Arial, sans-serif" });
    expect(toAntdTheme("light").fontFamily).toBe("Manrope, Arial, sans-serif");
  });
});
