import { fileURLToPath } from "node:url";
import rule from "../rules/no-adhoc-socket.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

// The rule resolves the owning package by NAME (nearest package.json), not by
// path shape, so these paths sit inside this repo where a package.json really
// exists above them: this plugin's own package (@stapel/eslint-plugin) stands
// in for "some package that is not @stapel/realtime".
const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));
const IN_PACKAGE = `${PKG_ROOT}__virtual__/src/realtime/chatSocket.ts`;
const IN_TEST = `${PKG_ROOT}__virtual__/test/socket.test.ts`;

tester.run("no-adhoc-socket", rule, {
  valid: [
    // The sanctioned shape.
    {
      filename: IN_PACKAGE,
      code: 'import { createSignalClient } from "@stapel/realtime";\nconst c = createSignalClient({ url });',
    },
    // A test's job includes driving the real transport and faking it — and
    // the rule knows that itself, without depending on preset wiring.
    { filename: IN_TEST, code: "const s = new WebSocket(url);" },
    // The owning package, named explicitly (this is the allowlist a pair
    // mid-cutover uses, with its ticket named beside it).
    {
      filename: IN_PACKAGE,
      code: "const s = new WebSocket(url);",
      options: [{ allowPackages: ["@stapel/eslint-plugin"] }],
    },
    // Not a stream constructor.
    { filename: IN_PACKAGE, code: "const s = new URL(url);" },
    // A method named `WebSocket` on some object is not the global.
    { filename: IN_PACKAGE, code: "const s = new transport.WebSocket(url);" },
  ],
  invalid: [
    {
      filename: IN_PACKAGE,
      code: "const s = new WebSocket(url);",
      errors: [{ messageId: "adhocSocket" }],
    },
    {
      filename: IN_PACKAGE,
      code: "const s = new window.WebSocket(url);",
      errors: [{ messageId: "adhocSocket" }],
    },
    {
      filename: IN_PACKAGE,
      code: "const s = new globalThis.WebSocket(url);",
      errors: [{ messageId: "adhocSocket" }],
    },
    {
      // Same argument, same rule: a stream with a reconnect policy and an auth
      // story it does not have until someone writes them twice.
      filename: IN_PACKAGE,
      code: "const s = new EventSource(url);",
      errors: [{ messageId: "adhocSocket" }],
    },
    {
      // An allowlist for SOME OTHER package does not cover this one.
      filename: IN_PACKAGE,
      code: "const s = new WebSocket(url);",
      options: [{ allowPackages: ["@stapel/realtime"] }],
      errors: [{ messageId: "adhocSocket" }],
    },
  ],
});
