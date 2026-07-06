import { describe } from "vitest";
import rule from "../rules/no-raw-fetch.js";
import { tsxTester } from "./helpers.js";

describe("no-raw-fetch", () => {
  tsxTester().run("stapel/no-raw-fetch", rule, {
    valid: [
      `const api = createAuthApi(client); await api.me();`,
      `await client.get("/me/");`,
      // A string containing "XMLHttpRequest" is a header value, not a call.
      `const H = { "X-Requested-With": "XMLHttpRequest" };`,
      `function fetchUser() { return 1; } fetchUser();`,
    ],
    invalid: [
      {
        code: `const r = await fetch("/api/x");`,
        errors: [{ messageId: "rawFetch" }],
      },
      {
        code: `const r = await globalThis.fetch("/api/x");`,
        errors: [{ messageId: "rawFetch" }],
      },
      {
        code: `const x = new XMLHttpRequest();`,
        errors: [{ messageId: "rawXhr" }],
      },
      {
        code: `import axios from "axios"; axios.get("/x");`,
        errors: [{ messageId: "rawImport" }, { messageId: "rawFetch" }],
      },
    ],
  });
});
