import { describe } from "vitest";
import rule from "../rules/no-raw-storage.js";
import { tsxTester } from "./helpers.js";

describe("no-raw-storage", () => {
  tsxTester().run("stapel/no-raw-storage", rule, {
    valid: [
      `import { createRepository } from "@stapel/core"; const repo = createRepository("x", { scope: "app" }); repo.get("k");`,
      // Property named "localStorage" on some unrelated object is not the global.
      `const obj = { localStorage: 1 }; console.log(obj.localStorage);`,
      // A variable merely NAMED localStorage in an unrelated scope's declaration.
      `function f(indexedDB) { return indexedDB; }`,
    ],
    invalid: [
      {
        code: `localStorage.setItem("k", "v");`,
        errors: [{ messageId: "rawStorage" }],
      },
      {
        code: `const v = localStorage.getItem("k");`,
        errors: [{ messageId: "rawStorage" }],
      },
      {
        code: `sessionStorage.removeItem("k");`,
        errors: [{ messageId: "rawStorage" }],
      },
      {
        code: `indexedDB.open("db");`,
        errors: [{ messageId: "rawStorage" }],
      },
      {
        code: `window.localStorage.setItem("k", "v");`,
        errors: [{ messageId: "rawStorage" }],
      },
      {
        code: `globalThis.indexedDB.open("db");`,
        errors: [{ messageId: "rawStorage" }],
      },
      {
        code: `import { get } from "idb-keyval"; get("k");`,
        errors: [{ messageId: "rawImport" }],
      },
    ],
  });
});
