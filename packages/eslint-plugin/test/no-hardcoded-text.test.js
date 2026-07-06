import { describe } from "vitest";
import rule from "../rules/no-hardcoded-text.js";
import { tsxTester } from "./helpers.js";

describe("no-hardcoded-text", () => {
  tsxTester().run("stapel/no-hardcoded-text", rule, {
    valid: [
      // Rendered via i18n.
      `const x = <span>{t("pricing.choose_plan")}</span>;`,
      // Punctuation / icons / numbers are not prose.
      `const x = <span>·</span>;`,
      `const x = <span>{count}</span>;`,
      `const x = <div>{"42"}</div>;`,
      // Technical short tokens.
      `const x = <span>OK</span>;`,
      // Non-user-facing attributes untouched.
      `const x = <div data-testid="submit-button" />;`,
    ],
    invalid: [
      {
        code: `const x = <button>Choose plan</button>;`,
        errors: [{ messageId: "hardcoded" }],
      },
      {
        code: `const x = <img alt="Company logo" src="/l.png" />;`,
        errors: [{ messageId: "hardcoded" }],
      },
      {
        code: `const x = <input placeholder="Enter your email" />;`,
        errors: [{ messageId: "hardcoded" }],
      },
    ],
  });
});
