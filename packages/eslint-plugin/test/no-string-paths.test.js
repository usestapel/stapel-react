import { describe } from "vitest";
import rule from "../rules/no-string-paths.js";
import { tsxTester, OPERATION_SETTINGS } from "./helpers.js";

describe("no-string-paths", () => {
  tsxTester().run("stapel/no-string-paths", rule, {
    valid: [
      // The one right way: a named operation off the typed api.
      {
        code: `const api = createAuthApi(client); await api.me();`,
        settings: OPERATION_SETTINGS,
      },
      // Non-http-verb member calls with a path-looking arg are untouched.
      { code: `router.push("/settings/profile");` },
      { code: `navigate("/app");` },
      // .get on a Map/params — arg is not a leading-slash path.
      { code: `params.get("redirect");` },
      // A leading-slash literal that is NOT a catalogued path and not a client
      // verb call is left alone (route paths, not API paths).
      { code: `const route = "/sign-in";`, settings: OPERATION_SETTINGS },
      // Template with an interpolated, non-path prefix.
      { code: "const s = `hello ${name}`;" },
      // A path in object-KEY position is a route / mock-handler table, not a
      // request — left alone even when it matches a catalogued operation.
      {
        code: `const handlers = { "/auth/api/me/": mockMe, "/me/": mockMe };`,
        settings: OPERATION_SETTINGS,
      },
    ],
    invalid: [
      // Detector 1: client.<verb>("/…") bypass shape (fires without a catalog).
      {
        code: `client.get("/me/");`,
        errors: [{ messageId: "clientPath" }],
      },
      {
        code: `await client.post("/password/login/", body);`,
        errors: [{ messageId: "clientPath" }],
      },
      // Detector 1: interpolated path template on a verb call.
      {
        code: "client.delete(`/sessions/${id}/`);",
        errors: [{ messageId: "clientPath" }],
      },
      // Detector 2: a bare literal that IS a catalogued operation path.
      {
        code: `const url = "/auth/api/me/";`,
        settings: OPERATION_SETTINGS,
        errors: [{ messageId: "knownPath" }],
      },
      // Detector 2: client-relative literal matches by trailing-segment suffix.
      {
        code: `const p = "/capabilities/";`,
        settings: OPERATION_SETTINGS,
        errors: [{ messageId: "knownPath" }],
      },
      // Detector 1 wins (single report) when both would match the same arg.
      {
        code: `client.get("/auth/api/me/");`,
        settings: OPERATION_SETTINGS,
        errors: [{ messageId: "clientPath" }],
      },
    ],
  });
});
