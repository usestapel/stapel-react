import { describe, expect, it } from "vitest";
import { colors, cssVar, generateTokensCss } from "../src/index.js";

describe("generateTokensCss", () => {
  it("is byte-stable across invocations", () => {
    const a = generateTokensCss();
    const b = generateTokensCss();
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("emits :root and [data-theme=\"dark\"] blocks", () => {
    const css = generateTokensCss();
    expect(css).toContain(":root {");
    expect(css).toContain('[data-theme="dark"] {');
  });

  it("emits every color token in both themes", () => {
    const css = generateTokensCss();
    const [rootBlock = "", darkBlock = ""] = css.split('[data-theme="dark"]');
    for (const [name, pair] of Object.entries(colors)) {
      const varName = `--stapel-color-${name
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .toLowerCase()}`;
      expect(rootBlock).toContain(`${varName}: ${pair.light};`);
      expect(darkBlock).toContain(`${varName}: ${pair.dark};`);
    }
  });

  it("contains no unresolved template artifacts and ends with newline", () => {
    const css = generateTokensCss();
    expect(css).not.toContain("undefined");
    expect(css).not.toContain("NaN");
    expect(css.endsWith("\n")).toBe(true);
  });

  it("cssVar renders a var() reference", () => {
    expect(cssVar("color-primary")).toBe("var(--stapel-color-primary)");
  });
});
