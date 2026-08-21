/**
 * The contract test — this repo's stand-in for a live-backend run.
 *
 * There is no live-backend harness in stapel-react (checked: no e2e package,
 * no playwright, no `LIVE_BACKEND` seam; every pair's integration story is an
 * injected-`fetch`/MSW suite against the REAL client and the REAL components).
 * The nearest thing to verifying against a running server is verifying against
 * what the server PUBLISHES — so this drives every `FormsApi` method through
 * the real `createStapelClient`, captures the URL and method each one actually
 * puts on the wire, and asserts that pair maps to a declared operation in
 * stapel-forms' own `docs/schema.json` (via the generated `schema.ts`, which
 * is drift-gated against it by `pnpm gen:api:check`).
 *
 * What it catches that a unit test cannot: a path typo, a wrong verb, a
 * forgotten trailing slash on the two anonymous routes (`/public/<id>/` and
 * `/public/<id>/submissions/` both END in one — Django would 301 or 404 a
 * request without it), and a `workspace_id` dropped from an admin call.
 */
import { describe, expect, it } from "vitest";
import { createStapelClient } from "@stapel/core";
import { createFormsApi } from "../src/index.js";
import type { paths } from "../src/api/generated/schema.js";
import { mockServer } from "./harness.js";
import { FORM_ID, PUBLIC_ID, WORKSPACE_ID } from "./fixtures.js";

const BASE = "https://forms.test/forms/api/v1";
const SUBMISSION_ID = "11111111-1111-4111-8111-111111111111";

/** Every path the backend declares, as a matcher over a concrete URL path. */
const DECLARED_PATHS: readonly string[] = [
  "/forms/api/v1/forms",
  "/forms/api/v1/forms/{form_id}",
  "/forms/api/v1/forms/{form_id}/draft",
  "/forms/api/v1/forms/{form_id}/publish",
  "/forms/api/v1/forms/{form_id}/rotate-link",
  "/forms/api/v1/forms/{form_id}/state",
  "/forms/api/v1/forms/{form_id}/submissions",
  "/forms/api/v1/forms/{form_id}/submissions/export",
  "/forms/api/v1/forms/{form_id}/versions",
  "/forms/api/v1/public/{public_id}/",
  "/forms/api/v1/public/{public_id}/submissions/",
  "/forms/api/v1/submissions/{submission_id}",
  "/forms/api/v1/submissions/{submission_id}/resend",
] satisfies readonly (keyof paths)[];

/** A declared template → a regex over a concrete path. */
function templateToRegex(template: string): RegExp {
  const escaped = template
    .split("/")
    .map((segment) =>
      segment.startsWith("{") && segment.endsWith("}")
        ? "[^/]+"
        : segment.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")
    )
    .join("/");
  return new RegExp(`^${escaped}$`);
}

/** The declared template a concrete path matches, or `undefined`. Longest
 * template wins, so `/submissions/{id}/resend` is not shadowed by
 * `/submissions/{id}`. */
function matchDeclared(pathname: string): string | undefined {
  return [...DECLARED_PATHS]
    .sort((a, b) => b.length - a.length)
    .find((template) => templateToRegex(template).test(pathname));
}

interface WireCall {
  readonly op: string;
  readonly method: string;
  readonly pathname: string;
  readonly query: URLSearchParams;
}

/** Drive every operation once and record what it put on the wire. */
async function driveEveryOperation(): Promise<readonly WireCall[]> {
  const server = mockServer({
    // A permissive 200 for everything; this test is about the REQUEST.
    "/submissions/export": { text: "name\n" },
    "/": { body: {} },
  });
  const client = createStapelClient({ baseUrl: BASE, fetch: server.fetch });
  const api = createFormsApi(client, { fetch: server.fetch });

  const operations: readonly [string, () => Promise<unknown>][] = [
    ["getPublicForm", () => api.getPublicForm(PUBLIC_ID)],
    ["submit", () => api.submit(PUBLIC_ID, { answers: { a: 1 } })],
    ["listForms", () => api.listForms(WORKSPACE_ID)],
    ["listForms(state)", () => api.listForms(WORKSPACE_ID, "open")],
    ["getForm", () => api.getForm(WORKSPACE_ID, FORM_ID)],
    ["createForm", () => api.createForm({ workspace_id: WORKSPACE_ID, title: "T" })],
    ["patchForm", () => api.patchForm(WORKSPACE_ID, FORM_ID, { title: "T" })],
    ["deleteForm", () => api.deleteForm(WORKSPACE_ID, FORM_ID)],
    ["putDraft", () => api.putDraft(WORKSPACE_ID, FORM_ID, { fields: [] })],
    ["publish", () => api.publish(WORKSPACE_ID, FORM_ID)],
    ["setState", () => api.setState(WORKSPACE_ID, FORM_ID, "open")],
    ["rotateLink", () => api.rotateLink(WORKSPACE_ID, FORM_ID)],
    ["listVersions", () => api.listVersions(WORKSPACE_ID, FORM_ID)],
    [
      "listSubmissions",
      () => api.listSubmissions({ workspaceId: WORKSPACE_ID, formId: FORM_ID }),
    ],
    ["getSubmission", () => api.getSubmission(WORKSPACE_ID, SUBMISSION_ID)],
    ["deleteSubmission", () => api.deleteSubmission(WORKSPACE_ID, SUBMISSION_ID)],
    ["resendSubmission", () => api.resendSubmission(WORKSPACE_ID, SUBMISSION_ID)],
    [
      "exportSubmissions",
      () => api.exportSubmissions({ workspaceId: WORKSPACE_ID, formId: FORM_ID }),
    ],
  ];

  const wire: WireCall[] = [];
  for (const [op, run] of operations) {
    const before = server.calls.length;
    await run();
    const call = server.calls[before];
    expect(call, `${op} issued no request`).toBeDefined();
    if (call === undefined) continue;
    const url = new URL(call.url);
    wire.push({
      op,
      method: call.method,
      pathname: url.pathname,
      query: url.searchParams,
    });
  }
  return wire;
}

describe("every operation hits a path the backend declares", () => {
  it("maps each request to a declared operation", async () => {
    const wire = await driveEveryOperation();
    const unmatched = wire
      .filter((call) => matchDeclared(call.pathname) === undefined)
      .map((call) => `${call.op}: ${call.method} ${call.pathname}`);
    expect(unmatched).toEqual([]);
  });

  it("uses the verb the contract declares for that path", async () => {
    const wire = await driveEveryOperation();
    const wrongVerb: string[] = [];
    for (const call of wire) {
      const template = matchDeclared(call.pathname);
      if (template === undefined) continue;
      // The generated `paths` type is erased at runtime, so the declared verb
      // set is asserted from the same 13-path contract listed above.
      const declared = DECLARED_VERBS[template];
      if (declared === undefined || !declared.includes(call.method)) {
        wrongVerb.push(`${call.op}: ${call.method} ${template}`);
      }
    }
    expect(wrongVerb).toEqual([]);
  });

  it("covers all 13 declared paths — nothing in the contract is unreachable", async () => {
    const wire = await driveEveryOperation();
    const touched = new Set(
      wire.map((call) => matchDeclared(call.pathname)).filter(Boolean)
    );
    const untouched = DECLARED_PATHS.filter((p) => !touched.has(p));
    expect(untouched).toEqual([]);
  });
});

/** Declared verbs per path — stapel-forms `docs/schema.json`. */
const DECLARED_VERBS: Readonly<Record<string, readonly string[]>> = {
  "/forms/api/v1/forms": ["GET", "POST"],
  "/forms/api/v1/forms/{form_id}": ["GET", "PATCH", "DELETE"],
  "/forms/api/v1/forms/{form_id}/draft": ["PUT"],
  "/forms/api/v1/forms/{form_id}/publish": ["POST"],
  "/forms/api/v1/forms/{form_id}/rotate-link": ["POST"],
  "/forms/api/v1/forms/{form_id}/state": ["POST"],
  "/forms/api/v1/forms/{form_id}/submissions": ["GET"],
  "/forms/api/v1/forms/{form_id}/submissions/export": ["GET"],
  "/forms/api/v1/forms/{form_id}/versions": ["GET"],
  "/forms/api/v1/public/{public_id}/": ["GET"],
  "/forms/api/v1/public/{public_id}/submissions/": ["POST"],
  "/forms/api/v1/submissions/{submission_id}": ["GET", "DELETE"],
  "/forms/api/v1/submissions/{submission_id}/resend": ["POST"],
};

describe("the anonymous routes keep their trailing slash", () => {
  it("GET /public/<id>/ and POST /public/<id>/submissions/ both end in one", async () => {
    // Django's APPEND_SLASH would 301 a GET and simply refuse a POST, so a
    // dropped slash breaks submissions in production and nowhere else.
    const wire = await driveEveryOperation();
    const schema = wire.find((c) => c.op === "getPublicForm");
    const submit = wire.find((c) => c.op === "submit");
    expect(schema?.pathname.endsWith("/")).toBe(true);
    expect(submit?.pathname.endsWith("/submissions/")).toBe(true);
  });

  it("percent-encodes the public token instead of trusting it", async () => {
    const server = mockServer({ "/": { body: {} } });
    const client = createStapelClient({ baseUrl: BASE, fetch: server.fetch });
    const api = createFormsApi(client, { fetch: server.fetch });
    await api.getPublicForm("a/../b");
    expect(server.calls[0]?.url).toContain("a%2F..%2Fb");
  });
});

describe("workspace scoping", () => {
  it("every ADMIN request carries workspace_id, and no anonymous one does", async () => {
    const wire = await driveEveryOperation();
    const anonymous = new Set(["getPublicForm", "submit"]);
    // `POST /forms` is the one admin call that scopes by BODY, not query:
    // `FormCreate.workspace_id` is a required body field and the operation
    // declares no `workspace_id` parameter. Asserted separately below.
    const bodyScoped = new Set(["createForm"]);
    const missing = wire
      .filter(
        (call) =>
          !anonymous.has(call.op) &&
          !bodyScoped.has(call.op) &&
          call.query.get("workspace_id") === null
      )
      .map((call) => call.op);
    expect(missing).toEqual([]);

    const leaked = wire
      .filter(
        (call) => anonymous.has(call.op) && call.query.get("workspace_id") !== null
      )
      .map((call) => call.op);
    // An anonymous respondent has no workspace, and sending one would leak
    // which workspace a public link belongs to.
    expect(leaked).toEqual([]);
  });

  it("createForm carries the workspace in the BODY, as the contract declares", async () => {
    const server = mockServer({ "/": { body: {} } });
    const client = createStapelClient({ baseUrl: BASE, fetch: server.fetch });
    const api = createFormsApi(client, { fetch: server.fetch });
    await api.createForm({ workspace_id: WORKSPACE_ID, title: "T" });
    expect((server.calls[0]?.body as { workspace_id: string }).workspace_id).toBe(
      WORKSPACE_ID
    );
  });
});

describe("CSRF header on mutations", () => {
  it("every mutating request carries X-Requested-With", async () => {
    // The simplest SPA rule for cookie-authenticated browsers; header-token
    // clients ignore it. Including the anonymous POST, which rides a
    // cookie-authenticated origin whenever the host page has one.
    const seen: { method: string; header: string | null }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const headers = new Headers(init?.headers);
      seen.push({ method, header: headers.get("X-Requested-With") });
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof globalThis.fetch;

    const client = createStapelClient({ baseUrl: BASE, fetch: fetchImpl });
    const api = createFormsApi(client, { fetch: fetchImpl });
    await api.submit(PUBLIC_ID, { answers: {} });
    await api.createForm({ workspace_id: WORKSPACE_ID, title: "T" });
    await api.patchForm(WORKSPACE_ID, FORM_ID, { title: "T" });
    await api.putDraft(WORKSPACE_ID, FORM_ID, { fields: [] });
    await api.publish(WORKSPACE_ID, FORM_ID);
    await api.setState(WORKSPACE_ID, FORM_ID, "open");
    await api.rotateLink(WORKSPACE_ID, FORM_ID);
    await api.deleteForm(WORKSPACE_ID, FORM_ID);
    await api.deleteSubmission(WORKSPACE_ID, SUBMISSION_ID);
    await api.resendSubmission(WORKSPACE_ID, SUBMISSION_ID);

    const unguarded = seen.filter((c) => c.header === null);
    expect(unguarded).toEqual([]);
  });
});
