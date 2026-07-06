import { describe } from "vitest";
import rule from "../rules/no-direct-analytics-provider.js";
import { tsxTester } from "./helpers.js";

describe("no-direct-analytics-provider", () => {
  tsxTester().run("stapel/no-direct-analytics-provider", rule, {
    valid: [
      // The one right way: everything through the core facade.
      `import { useAnalytics, tracked } from "@stapel/core";`,
      `import { defineEvent, prop } from "@stapel/core";`,
      `import foo from "some-other-pkg";`,
      // Prefix must match a module boundary, not a substring.
      `import x from "mixpanel-browser-utils-lookalike";`,
    ],
    invalid: [
      {
        code: `import posthog from "posthog-js";`,
        errors: [{ messageId: "directProvider" }],
      },
      {
        code: `import mixpanel from "mixpanel-browser";`,
        errors: [{ messageId: "directProvider" }],
      },
      {
        code: `import { init } from "@amplitude/analytics-browser";`,
        errors: [{ messageId: "directProvider" }],
      },
      {
        code: `import { AnalyticsBrowser } from "@segment/analytics-next";`,
        errors: [{ messageId: "directProvider" }],
      },
      {
        code: `const ph = await import("posthog-js");`,
        errors: [{ messageId: "directProvider" }],
      },
      {
        code: `const mp = require("mixpanel-browser");`,
        errors: [{ messageId: "directProvider" }],
      },
      // Host-extended vendor via options.
      {
        code: `import t from "@acme/tracker";`,
        options: [{ providers: ["@acme/tracker"] }],
        errors: [{ messageId: "directProvider" }],
      },
    ],
  });
});
