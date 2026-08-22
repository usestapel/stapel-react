/**
 * The contract test — this repo's stand-in for a live-backend run.
 *
 * There is no live-backend harness in stapel-react, so the nearest thing to
 * verifying against a running server is verifying against what the server
 * PUBLISHES: this drives every `SearchApi` method through the real
 * `createStapelClient`, captures the URL each one puts on the wire, and
 * asserts the path is one stapel-search declares in its own
 * `docs/schema.json` (via the generated `schema.ts`, drift-gated against it by
 * `pnpm gen:api:check`).
 *
 * It also pins the two things a hand-written query builder gets wrong and a
 * unit test cannot see: that `f.<slug>` is REPEATED rather than comma-joined
 * (the backend reads `getlist`; "a,b" would be one literal value), and that no
 * parameter is invented — every key sent is one the schema declares, either
 * literally or as one of the two documented prefixes.
 */
import { describe, expect, it } from "vitest";
import { createStapelClient } from "@stapel/core";
import { createSearchApi, parseSearchState } from "../src/index.js";
import type { paths } from "../src/api/generated/schema.js";

const BASE = "https://search.test/search/api/v1";

/** Every path the backend declares that this pair calls. */
const DECLARED_PATHS = [
  "/search/api/v1/query",
  "/search/api/v1/ranking",
  "/search/api/v1/suggest",
] as const satisfies readonly (keyof paths)[];

/**
 * The operator endpoints, declared by the backend and DELIBERATELY not on this
 * pair's surface — both are `IsNotAnonymousUser` + `can_manage` and answer
 * `error.403.search_forbidden` to a storefront. Named here so the omission is
 * a recorded decision rather than something nobody noticed.
 */
const NOT_THIS_PAIRS_SURFACE = [
  "/search/api/v1/health",
  "/search/api/v1/reindex",
] as const satisfies readonly (keyof paths)[];

/** Query parameters the schema declares by name, plus its two prefixes. */
const DECLARED_PARAMS = new Set([
  "anchor",
  "bbox",
  "category",
  "direction",
  "facets",
  "lang",
  "lat",
  "limit",
  "lon",
  "owner",
  "q",
  "radius_km",
  "sort",
  "type",
]);

interface WireCall {
  readonly op: string;
  readonly method: string;
  readonly pathname: string;
  readonly query: URLSearchParams;
}

async function driveEveryOperation(): Promise<readonly WireCall[]> {
  const calls: WireCall[] = [];
  const client = createStapelClient({
    baseUrl: BASE,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const url = new URL(href);
      calls.push({
        op: "",
        method: (init?.method ?? "GET").toUpperCase(),
        pathname: url.pathname,
        query: url.searchParams,
      });
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof globalThis.fetch,
  });
  const api = createSearchApi(client);

  const { state } = parseSearchState(
    new URLSearchParams(
      "type=listing&q=drill&lang=ru&category=tools/power&owner=u-7" +
        "&f.brand=bosch&f.brand=makita&r.price=100..500" +
        "&lat=55.75&lon=37.62&radius_km=25&sort=distance" +
        "&facets=brand,condition&anchor=abc&direction=next&limit=48"
    ),
    { defaultType: "listing" }
  );

  const ops: readonly [string, () => Promise<unknown>][] = [
    ["query", () => api.query(state)],
    ["suggest", () => api.suggest({ type: "listing", q: "dri", limit: 5 })],
    ["ranking", () => api.ranking("listing")],
  ];
  const out: WireCall[] = [];
  for (const [op, run] of ops) {
    const before = calls.length;
    await run();
    const call = calls[before];
    if (call === undefined) throw new Error(`${op} made no request`);
    out.push({ ...call, op });
  }
  return out;
}

describe("every operation lands on a path the backend declares", () => {
  it("query / suggest / ranking are all declared GETs", async () => {
    for (const call of await driveEveryOperation()) {
      expect(
        (DECLARED_PATHS as readonly string[]).includes(call.pathname),
        `${call.op} → ${call.pathname}`
      ).toBe(true);
      expect(call.method).toBe("GET");
    }
  });

  it("the pair does not reach the two operator endpoints", async () => {
    const paths = (await driveEveryOperation()).map((c) => c.pathname);
    for (const operator of NOT_THIS_PAIRS_SURFACE) {
      expect(paths).not.toContain(operator);
    }
  });
});

describe("the query string is the contract's, not an invention", () => {
  it("sends only declared parameters and the two declared prefixes", async () => {
    const query = (await driveEveryOperation()).find((c) => c.op === "query")?.query;
    expect(query).toBeDefined();
    for (const key of new Set(query?.keys() ?? [])) {
      const declared =
        DECLARED_PARAMS.has(key) || key.startsWith("f.") || key.startsWith("r.");
      expect(declared, `undeclared query parameter: ${key}`).toBe(true);
    }
  });

  it("REPEATS f.<slug> instead of comma-joining it", async () => {
    // `query.py` reads `getlist`, so "bosch,makita" would be one literal
    // value that matches nothing. This is the assertion that a second,
    // hand-rolled URL builder would fail.
    const query = (await driveEveryOperation()).find((c) => c.op === "query")?.query;
    expect(query?.getAll("f.brand")).toEqual(["bosch", "makita"]);
  });

  it("serializes a range as from..to and geo as lat/lon/radius_km", async () => {
    const query = (await driveEveryOperation()).find((c) => c.op === "query")?.query;
    expect(query?.get("r.price")).toBe("100..500");
    expect(query?.get("lat")).toBe("55.75");
    expect(query?.get("lon")).toBe("37.62");
    expect(query?.get("radius_km")).toBe("25");
  });

  it("always sends `type` — the endpoint's one required parameter", async () => {
    for (const call of await driveEveryOperation()) {
      if (call.op === "ranking") continue; // `type` is optional there
      expect(call.query.get("type")).toBe("listing");
    }
  });
});
