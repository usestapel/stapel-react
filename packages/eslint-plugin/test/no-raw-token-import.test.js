import { describe } from "vitest";
import rule from "../rules/no-raw-token-import.js";
import { tsxTester } from "./helpers.js";

describe("no-raw-token-import", () => {
  tsxTester().run("stapel/no-raw-token-import", rule, {
    valid: [
      `import { cssVar } from "@stapel/tokens";`,
      `import { colors } from "@stapel/tokens";`,
      `import foo from "some-other-pkg";`,
    ],
    invalid: [
      {
        code: `import { ramps } from "@stapel/tokens/raw";`,
        errors: [{ messageId: "rawImport" }],
      },
      {
        code: `export { ramps } from "@stapel/tokens/raw";`,
        errors: [{ messageId: "rawImport" }],
      },
      {
        code: `const r = await import("@stapel/tokens/raw");`,
        errors: [{ messageId: "rawImport" }],
      },
    ],
  });
});
