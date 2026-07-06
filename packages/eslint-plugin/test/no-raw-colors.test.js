import { describe } from "vitest";
import rule from "../rules/no-raw-colors.js";
import { tsxTester, TOKEN_SETTINGS } from "./helpers.js";

describe("no-raw-colors", () => {
  tsxTester().run("stapel/no-raw-colors", rule, {
    valid: [
      // Token utilities and CSS vars are the one right way.
      { code: `const x = <div className="bg-background-primary text-text-primary" />;`, settings: TOKEN_SETTINGS },
      { code: `const s = { color: "var(--stapel-color-text-primary)" };`, settings: TOKEN_SETTINGS },
      { code: `const x = <div style={{ color: cssVar("color-accent") }} />;`, settings: TOKEN_SETTINGS },
      // Non-colour strings must not trip the rule (low FP).
      { code: `const href = "#section-2"; const label = "Hello world";`, settings: TOKEN_SETTINGS },
      { code: `const x = <a href="#top">go</a>;`, settings: TOKEN_SETTINGS },
      // Arbitrary value that references a token var is fine.
      { code: `const x = <div className="grid-cols-[1fr_2fr]" />;`, settings: TOKEN_SETTINGS },
    ],
    invalid: [
      // Hex in a JSX style object.
      {
        code: `const x = <div style={{ color: "#4657d9" }} />;`,
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "rawColor" }],
      },
      // rgb() in a plain style object.
      {
        code: `const s = { backgroundColor: "rgb(10, 20, 30)" };`,
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "rawColor" }],
      },
      // Named colour on a colour property.
      {
        code: `const s = { color: "red" };`,
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "rawColor" }],
      },
      // Tailwind arbitrary hex.
      {
        code: `const x = <div className="bg-[#4657d9]" />;`,
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "arbitraryColor" }],
      },
      // Tailwind arbitrary built by interpolation — JIT-invisible (§1.5).
      {
        code: "const c = 'x'; const x = <div className={`bg-[${c}]`} />;",
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "arbitraryInterpolation" }],
      },
      // CSS tagged template with a hex.
      {
        code: "const s = css`color: #fff;`;",
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "rawColor" }],
      },
      // Bare raw-ramp reference.
      {
        code: `const c = "gray.500";`,
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "rawRamp" }],
      },
      // Raw ramp inside an arbitrary value.
      {
        code: `const x = <div className="bg-[brand.500]" />;`,
        settings: TOKEN_SETTINGS,
        errors: [{ messageId: "arbitraryColor" }],
      },
    ],
  });
});
