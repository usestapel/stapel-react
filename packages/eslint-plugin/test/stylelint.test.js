import { describe, it, expect } from "vitest";
import stylelint from "stylelint";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const pluginPath = resolve(HERE, "../stylelint/index.js");

async function lintCss(code) {
  const res = await stylelint.lint({
    code,
    config: {
      plugins: [pluginPath],
      rules: { "stapel/color-tokens-only": true },
    },
  });
  const warnings = res.results[0].warnings;
  return warnings.map((w) => w.rule);
}

describe("stylelint stapel/color-tokens-only", () => {
  it("accepts stapel token vars on colour properties", async () => {
    const warns = await lintCss(
      ".a { color: var(--stapel-color-text-primary); background: var(--stapel-card-bg); }"
    );
    expect(warns).toEqual([]);
  });

  it("accepts CSS-wide keywords and transparent", async () => {
    const warns = await lintCss(".a { color: inherit; background: transparent; }");
    expect(warns).toEqual([]);
  });

  it("flags a raw hex value", async () => {
    const warns = await lintCss(".a { color: #4657d9; }");
    expect(warns).toContain("stapel/color-tokens-only");
  });

  it("flags rgb() literals", async () => {
    const warns = await lintCss(".a { background: rgba(0,0,0,0.5); }");
    expect(warns).toContain("stapel/color-tokens-only");
  });

  it("flags a non-stapel var on a colour property", async () => {
    const warns = await lintCss(".a { color: var(--other-token); }");
    expect(warns).toContain("stapel/color-tokens-only");
  });

  it("flags a named colour on a colour property", async () => {
    const warns = await lintCss(".a { color: red; }");
    expect(warns).toContain("stapel/color-tokens-only");
  });
});
