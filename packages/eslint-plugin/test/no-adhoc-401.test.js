import { describe } from "vitest";
import rule from "../rules/no-adhoc-401.js";
import { tsxTester } from "./helpers.js";

describe("no-adhoc-401", () => {
  tsxTester().run("stapel/no-adhoc-401", rule, {
    valid: [
      `const client = createStapelClient({ baseUrl, onAuthRefresh: () => sessionManager.refresh() });`,
      // Unrelated numeric comparisons are fine.
      `if (count === 400) { retry(); }`,
      `if (age >= 18) { allow(); }`,
    ],
    invalid: [
      {
        code: `if (response.status === 401) { doRefresh(); }`,
        errors: [{ messageId: "literal401" }],
      },
      {
        code: `if (err.status == 401) { redirectToLogin(); }`,
        errors: [{ messageId: "literal401" }],
      },
      {
        code: `if (401 === e.response.status) { retry(); }`,
        errors: [{ messageId: "literal401" }],
      },
      {
        code: `switch (status) { case 401: refresh(); break; default: break; }`,
        errors: [{ messageId: "literal401" }],
      },
      {
        code: `client.interceptors.response.use((r) => r, handleAuthError);`,
        errors: [{ messageId: "interceptor" }],
      },
    ],
  });
});
