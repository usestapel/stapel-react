// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createWebhooksRuntime,
  webhooksQueryKeys,
  webhooksI18nBundleEn,
  registerWebhooksI18n,
  DEFAULT_RETENTION,
  DEFAULT_WEBHOOKS_BASE_URL,
  SUBSCRIPTION_LIST_LIMIT,
} from "../src/index.js";
import { BASE, mockServer } from "./harness.js";
import { CREATED_WITH_SECRET, HEALTHY } from "./fixtures.js";

/**
 * The contract test. Everything here is asserted against the WIRE — a real
 * `StapelClient` over an injected fetch — rather than against a stub of this
 * pair's own api object, because the two things that break a client of
 * stapel-webhooks are both invisible to a module-level mock: a trailing slash,
 * and a 201 body somebody forgot to keep.
 */
function api(routes: Parameters<typeof mockServer>[0]) {
  const server = mockServer(routes);
  const runtime = createWebhooksRuntime({ baseUrl: BASE, fetch: server.fetch });
  return { server, api: runtime.api };
}

describe("the ten operations, on the paths urls_v1.py registers", () => {
  it("uses NO trailing slashes", async () => {
    // `urls_v1.py` registers every route without one, and Django's
    // APPEND_SLASH only rescues a GET: a POST to `subscriptions/` is a 301 a
    // browser replays as a GET — a create that silently becomes a list.
    const { server, api: client } = api({
      "/event-catalog": { body: { events: [], delivery_types: [] } },
      "GET /subscriptions/3f1a": { body: HEALTHY },
      "POST /subscriptions": { status: 201, body: CREATED_WITH_SECRET },
      "GET /subscriptions": { body: [] },
      "/secret": { body: CREATED_WITH_SECRET },
      "/replay": { body: { id: "d-1", status: "pending" } },
      "/deliveries/d-1": { body: {} },
    });

    await client.eventCatalog();
    await client.subscriptions();
    await client.createSubscription({
      eventType: "listings.listing.published",
      delivery: "webhook",
      target: { url: "https://hooks.example/x" },
    });
    await client.subscription(HEALTHY.id);
    await client.rotateSecret(HEALTHY.id);
    await client.delivery("d-1");
    await client.replay("d-1");

    for (const call of server.calls) {
      const path = new URL(call.url).pathname;
      expect(path.endsWith("/"), path).toBe(false);
    }
  });

  it("mounts on the module's canonical prefix", async () => {
    const { server, api: client } = api({ "/event-catalog": { body: {} } });
    await client.eventCatalog();
    expect(new URL(server.calls[0]?.url ?? "").pathname).toBe(
      "/webhooks/api/v1/event-catalog"
    );
  });

  it("clamps the list limit to the per-owner ceiling", async () => {
    // The view clamps server-side and says nothing about it (BACKEND-GAP W-2),
    // so asking for more would be asking for a number the server reduces.
    const { server, api: client } = api({ "/subscriptions": { body: [] } });
    await client.subscriptions({ limit: 5000 });
    expect(server.calls[0]?.url).toContain(
      `limit=${String(SUBSCRIPTION_LIST_LIMIT)}`
    );
  });

  it("sends the create body in the backend's own vocabulary", async () => {
    const { server, api: client } = api({
      "POST /subscriptions": { status: 201, body: CREATED_WITH_SECRET },
    });
    await client.createSubscription({
      eventType: "listings.listing.published",
      delivery: "webhook",
      target: { url: "https://hooks.example/x" },
      filter: { city: "Berlin" },
      description: "d",
    });
    expect(JSON.parse(server.calls[0]?.body ?? "{}")).toEqual({
      event_type: "listings.listing.published",
      delivery: "webhook",
      target: { url: "https://hooks.example/x" },
      // `filter`, NOT `payload_filter`: the column is one thing, the API's
      // vocabulary is another, and the wire uses the feature's own word.
      filter: { city: "Berlin" },
      description: "d",
    });
  });

  it("the 201 of a create is the only body that carries a secret", async () => {
    const { api: client } = api({
      "POST /subscriptions": { status: 201, body: CREATED_WITH_SECRET },
      "GET /subscriptions/": { body: HEALTHY },
    });
    const created = await client.createSubscription({
      eventType: "listings.listing.published",
      delivery: "webhook",
      target: { url: "https://hooks.example/x" },
    });
    expect(created.secret).toBe(CREATED_WITH_SECRET.secret);

    // The read has `has_secret` and no `secret` anywhere in it.
    const read = await client.subscription(HEALTHY.id);
    expect(read.has_secret).toBe(true);
    expect(Object.keys(read)).not.toContain("secret");
  });

  it("a delete is a 204 with no body", async () => {
    const { server, api: client } = api({
      "DELETE /subscriptions/": { status: 204 },
    });
    await client.deleteSubscription(HEALTHY.id);
    expect(server.calls[0]?.method).toBe("DELETE");
  });

  it("escapes an id into the path", async () => {
    const { server, api: client } = api({ "/subscriptions/": { body: HEALTHY } });
    await client.subscription("a b/c");
    expect(server.calls[0]?.url).toContain("a%20b%2Fc");
  });
});

describe("the runtime carries what the HTTP surface does not serve", () => {
  it("defaults to the module's mount", () => {
    const runtime = createWebhooksRuntime();
    expect(runtime.client.baseUrl).toBe(DEFAULT_WEBHOOKS_BASE_URL);
  });

  it("defaults retention to conf.py's 7 and 90 days (BACKEND-GAP W-8)", () => {
    expect(DEFAULT_RETENTION).toEqual({ succeededDays: 7, deadDays: 90 });
    expect(createWebhooksRuntime().retention).toEqual(DEFAULT_RETENTION);
  });

  it("lets a deployment that changed the settings pass its own numbers", () => {
    const runtime = createWebhooksRuntime({
      retention: { succeededDays: 30, deadDays: 365 },
    });
    expect(runtime.retention.succeededDays).toBe(30);
  });

  it("has no docs link unless the host gives one — never a dead control", () => {
    expect(createWebhooksRuntime().docsHref).toBeUndefined();
    expect(createWebhooksRuntime({ docsHref: "/d" }).docsHref).toBe("/d");
  });
});

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(webhooksQueryKeys.all[0]).toBe("webhooks");
  });

  it("keys a list by its filters, so two filters are two cache entries", () => {
    expect(webhooksQueryKeys.subscriptionList("active=true")).not.toEqual(
      webhooksQueryKeys.subscriptionList("")
    );
  });

  it("keys a delivery log by its status filter", () => {
    expect(webhooksQueryKeys.deliveryList("s1", "dead")).not.toEqual(
      webhooksQueryKeys.deliveryList("s1", "")
    );
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(webhooksI18nBundleEn["webhooks.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerWebhooksI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["webhooks.error.unknown"]).toBeTruthy();
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/webhooks-react");
    expect(manifest.backend.module).toBe("stapel-webhooks");
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });

  it("covers all ten operations of the backend's contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(Object.keys(manifest.operations)).toHaveLength(10);
  });

  it("the nav entry names a component the skin barrel actually exports", () => {
    // An entry naming a component that does not exist passes the generator's
    // structural validation and fails at the CONTAINER's import, two
    // repositories away from the mistake.
    const nav = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    const barrel = readFileSync("src/default/index.ts", "utf8");
    for (const entry of nav.entries) {
      expect(barrel).toContain(entry.component.export);
      expect(entry.placement.level).toBe("submenu");
      expect(entry.placement.parentId).toBe("profiles.settings");
    }
  });
});
