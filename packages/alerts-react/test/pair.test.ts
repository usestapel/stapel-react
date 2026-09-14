// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createAlertsRuntime,
  alertsQueryKeys,
  alertsI18nBundleEn,
  registerAlertsI18n,
  groupIssuesByService,
  issueFiltersKey,
  isSettableStatus,
  isOpenStatus,
  SETTABLE_ISSUE_STATUSES,
  DEFAULT_ALERTS_BASE_URL,
  DEFAULT_ALERTS_POLL_INTERVAL_MS,
} from "../src/index.js";
import { BASE, mockServer } from "./harness.js";
import { BOARD, FATAL, FATAL_DETAIL, MUTED, REGRESSED, WARNING } from "./fixtures.js";

/**
 * The contract test. Everything here is asserted against the WIRE — the pair's
 * real transports over an injected fetch — rather than against a stub of this
 * pair's own api object, because the things that break a client of
 * stapel-alerts are all invisible to a module-level mock: the LIST BODY is an
 * envelope and not the rows, a conditional read answers 304 with no body at
 * all, and a mute that omits the deadline key is a note and not a mute.
 */
function api(routes: Parameters<typeof mockServer>[0]) {
  const server = mockServer(routes);
  const runtime = createAlertsRuntime({ baseUrl: BASE, fetch: server.fetch });
  return { server, api: runtime.api };
}

describe("the four operations, on the paths urls_v1.py registers", () => {
  it("uses NO trailing slashes", async () => {
    // `urls_v1.py` registers every route without one, and Django's
    // APPEND_SLASH only rescues a GET: a POST to `fix/` is a 301 a browser
    // replays as a GET — a close that silently becomes a read.
    const { server, api: client } = api({
      "POST /fix": { body: FATAL },
      "PATCH /issues/": { body: FATAL },
      "GET /issues/1111": { body: FATAL_DETAIL },
      "GET /issues": { body: BOARD },
    });

    await client.issues();
    await client.issue(FATAL.id);
    await client.patchIssue(FATAL.id, { note: "looking" });
    await client.fixIssue(FATAL.id, { version: "0.42.1" });

    for (const call of server.calls) {
      const path = new URL(call.url).pathname;
      expect(path.endsWith("/"), path).toBe(false);
    }
  });

  it("mounts on the module's canonical prefix", async () => {
    const { server, api: client } = api({ "GET /issues": { body: BOARD } });
    await client.issues();
    expect(new URL(server.calls[0]?.url ?? "").pathname).toBe(
      "/alerts/api/v1/issues"
    );
  });

  it("reads the list as the IssuePage envelope the schema declares", async () => {
    // `{count, offset, limit, results}` — declared by the schema and still
    // proved here on the wire: a generated type is a statement about the
    // contract, and the rows a screen draws come from the body.
    const { api: client } = api({ "GET /issues": { body: BOARD } });
    const answer = await client.issues();
    expect(answer.outcome).toBe("modified");
    if (answer.outcome !== "modified") return;
    expect(answer.data.results).toHaveLength(5);
    expect(answer.data.count).toBe(5);
    // The page SIZE is what the server applied — echoed and clamped — never a
    // constant here, and never the number the caller asked for.
    expect(answer.data.limit).toBe(50);
  });

  it("sends every filter the list view reads", async () => {
    const { server, api: client } = api({ "GET /issues": { body: BOARD } });
    await client.issues({
      status: "new",
      level: "fatal",
      service: "svc-billing",
      since: "2026-09-01T00:00:00Z",
      open: true,
      offset: 50,
      limit: 25,
    });
    const url = new URL(server.calls[0]?.url ?? "");
    expect(url.searchParams.get("status")).toBe("new");
    expect(url.searchParams.get("level")).toBe("fatal");
    expect(url.searchParams.get("service")).toBe("svc-billing");
    expect(url.searchParams.get("since")).toBe("2026-09-01T00:00:00Z");
    expect(url.searchParams.get("open")).toBe("true");
    expect(url.searchParams.get("offset")).toBe("50");
    expect(url.searchParams.get("limit")).toBe("25");
  });

  it("omits `open` entirely when it is false", async () => {
    // The view reads `"1" | "true" | "True"`; `open=false` means "do not
    // filter", which is what omitting it means — so one URL, not two.
    const { server, api: client } = api({ "GET /issues": { body: BOARD } });
    await client.issues({ open: false });
    expect(new URL(server.calls[0]?.url ?? "").search).toBe("");
  });

  it("escapes an id into the path", async () => {
    const { server, api: client } = api({ "GET /issues/": { body: FATAL_DETAIL } });
    await client.issue("a b/c");
    expect(server.calls[0]?.url).toContain("a%20b%2Fc");
  });

  it("posts the fix body the endpoint documents", async () => {
    const { server, api: client } = api({ "POST /fix": { body: FATAL } });
    await client.fixIssue(FATAL.id, { version: "0.42.1", sha: "9c1d0ab" });
    expect(server.calls[0]?.method).toBe("POST");
    expect(JSON.parse(server.calls[0]?.body ?? "{}")).toEqual({
      version: "0.42.1",
      sha: "9c1d0ab",
    });
  });
});

describe("the conditional reads (the module's own stated requirement)", () => {
  it("offers no validator on the first read and reports the one it got", async () => {
    const { server, api: client } = api({ "GET /issues": { body: BOARD } });
    const first = await client.issues();
    expect(server.calls[0]?.ifNoneMatch).toBeNull();
    expect(first.outcome).toBe("modified");
    if (first.outcome !== "modified") return;
    expect(first.etag).toBeTruthy();
  });

  it("a re-read with the validator comes back UNCHANGED, not empty", async () => {
    // The failure this guards: a 304 has no body, and `StapelClient` would
    // have thrown it as an error (304 is not `response.ok`). Read as a
    // refusal, a quiet minute would blank the board.
    const { server, api: client } = api({ "GET /issues": { body: BOARD } });
    const first = await client.issues();
    if (first.outcome !== "modified") throw new Error("expected a body");
    const second = await client.issues(undefined, { etag: first.etag });
    expect(second.outcome).toBe("unchanged");
    expect(server.notModified).toHaveLength(1);
    expect(server.calls[1]?.ifNoneMatch).toBe(first.etag);
  });

  it("a validator that no longer matches brings the new body back", async () => {
    let body = BOARD;
    const { api: client } = api({ "GET /issues": () => ({ body }) });
    const first = await client.issues();
    if (first.outcome !== "modified") throw new Error("expected a body");
    body = { ...BOARD, count: 6, results: [...BOARD.results, MUTED] };
    const second = await client.issues(undefined, { etag: first.etag });
    expect(second.outcome).toBe("modified");
    if (second.outcome !== "modified") return;
    expect(second.data.results).toHaveLength(6);
  });

  it("the detail read is conditional too", async () => {
    const { server, api: client } = api({ "GET /issues/": { body: FATAL_DETAIL } });
    const first = await client.issue(FATAL.id);
    if (first.outcome !== "modified") throw new Error("expected a body");
    const second = await client.issue(FATAL.id, { etag: first.etag });
    expect(second.outcome).toBe("unchanged");
    expect(server.notModified).toHaveLength(1);
  });

  it("a refusal on a raw read is a StapelApiError, not a rethrown body", async () => {
    // The two transports of this pair must speak ONE dialect (CONTRIBUTING:
    // "Mock the wire, not the module"). The raw reader folds its own non-2xx
    // through core's `parseErrorEnvelope`, so a caller can read `.code` and
    // `.status` off whatever it caught.
    const { api: client } = api({
      "GET /issues": {
        status: 403,
        body: { localizable_error: "error.403.forbidden", error: "nope", params: {} },
      },
    });
    const caught = await client.issues().then(
      () => null,
      (error: unknown) => error
    );
    expect(caught).toBeTruthy();
    expect((caught as { code?: string }).code).toBe("error.403.forbidden");
    expect((caught as { status?: number }).status).toBe(403);
  });
});

describe("the runtime carries what the HTTP surface does not serve", () => {
  it("defaults to the module's mount", () => {
    expect(createAlertsRuntime().client.baseUrl).toBe(DEFAULT_ALERTS_BASE_URL);
  });

  it("defaults the poll to the interval the module's API doc names", () => {
    expect(DEFAULT_ALERTS_POLL_INTERVAL_MS).toBe(60_000);
    expect(createAlertsRuntime().pollIntervalMs).toBe(
      DEFAULT_ALERTS_POLL_INTERVAL_MS
    );
  });

  it("lets a deployment switch the poll off entirely", () => {
    expect(createAlertsRuntime({ pollIntervalMs: 0 }).pollIntervalMs).toBe(0);
  });

  it("has no commit link unless the host gives one — never a dead link", () => {
    expect(createAlertsRuntime().commitRefUrl).toBeUndefined();
    expect(
      createAlertsRuntime({ commitRefUrl: (sha) => `/c/${sha}` }).commitRefUrl?.(
        "abc"
      )
    ).toBe("/c/abc");
  });
});

describe("the statuses a caller may assert", () => {
  it("never offers `regressed` — the store asserts it from evidence", () => {
    expect([...SETTABLE_ISSUE_STATUSES]).toEqual(["new", "fixed", "muted"]);
    expect(isSettableStatus("regressed")).toBe(false);
  });

  it("counts new and regressed as open", () => {
    expect(isOpenStatus("new")).toBe(true);
    expect(isOpenStatus("regressed")).toBe(true);
    expect(isOpenStatus("fixed")).toBe(false);
    expect(isOpenStatus("muted")).toBe(false);
  });
});

describe("grouping (the feed's first question: which service is on fire)", () => {
  it("orders by worst level, then by how loud the service is", () => {
    const groups = groupIssuesByService([...BOARD.results]);
    expect(groups.map((g) => g.service)).toEqual([
      "svc-billing", // has the fatal
      "svc-api", // has the error
      "svc-worker", // warnings only
    ]);
    expect(groups[0]?.worstLevel).toBe("fatal");
    expect(groups[0]?.count).toBe(FATAL.count + WARNING.count);
  });

  it("never orders alphabetically — an outage is not filed under its letter", () => {
    const groups = groupIssuesByService([MUTED, FATAL]);
    expect(groups[0]?.service).toBe(FATAL.service);
  });

  it("breaks a tie at the same level by how loud the service is", () => {
    const quiet = { ...REGRESSED, service: "svc-quiet", count: 2 };
    const loud = { ...REGRESSED, service: "svc-loud", count: 900 };
    const groups = groupIssuesByService([quiet, loud]);
    expect(groups.map((g) => g.service)).toEqual(["svc-loud", "svc-quiet"]);
  });
});

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(alertsQueryKeys.all[0]).toBe("alerts");
  });

  it("keys a list by its filters, so two filters are two cache entries", () => {
    expect(alertsQueryKeys.issueList(issueFiltersKey({ level: "fatal" }))).not.toEqual(
      alertsQueryKeys.issueList(issueFiltersKey({}))
    );
  });

  it("keys a list by its OFFSET — a validator belongs to one page", () => {
    expect(issueFiltersKey({ offset: 50 })).not.toBe(issueFiltersKey({ offset: 0 }));
  });

  it("serializes the same filters to the same key in any order", () => {
    expect(issueFiltersKey({ level: "fatal", status: "new" })).toBe(
      issueFiltersKey({ status: "new", level: "fatal" })
    );
  });

  it("nests the detail under the issues prefix, so one invalidation covers both", () => {
    expect(alertsQueryKeys.issue("x").slice(0, 2)).toEqual([
      ...alertsQueryKeys.issues,
    ]);
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(alertsI18nBundleEn["alerts.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerAlertsI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["alerts.error.unknown"]).toBeTruthy();
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/alerts-react");
    expect(manifest.backend.module).toBe("stapel-alerts");
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });

  it("catalogues the backend's five operations", () => {
    // The manifest describes the BACKEND surface under the module's prefix,
    // which is five routes including the reporters' one — that is the
    // contract, and a manifest that hid part of it would be a manifest that
    // lies about what the module does.
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(Object.keys(manifest.operations)).toHaveLength(5);
  });

  it("but the PAIR cannot reach POST /report at all", () => {
    // A reporter's service key lives in every container in the fleet, and the
    // blast radius of one leaking must not include a browser. So the api
    // object has four methods and the package's source contains no path that
    // could send that batch — asserted over the SOURCE, because an operation
    // nobody exported today is one refactor away from being exported
    // tomorrow.
    const { api: client } = api({});
    expect(Object.keys(client).sort()).toEqual([
      "client",
      "fixIssue",
      "issue",
      "issues",
      "patchIssue",
    ]);
    // No path STRING for it anywhere, and no header set for its key: the
    // mentions in the module header are prose explaining why, which is the
    // only place either belongs.
    const source = readFileSync("src/api/alertsApi.ts", "utf8");
    expect(source).not.toContain('"/report"');
    expect(source).not.toMatch(/headers\.set\(\s*"X-Service-Key"/);
  });

  it("the nav entries name components the skin barrel actually exports", () => {
    // An entry naming a component that does not exist passes the generator's
    // structural validation and fails at the CONTAINER's import, two
    // repositories away from the mistake.
    const nav = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    const barrel = readFileSync("src/default/index.ts", "utf8");
    for (const entry of nav.entries) {
      expect(barrel).toContain(entry.component.export);
      expect(entry.requiresAuth).toBe(true);
    }
    expect(nav.entries[0].placement.parentId).toBe("admin.root");
  });
});
