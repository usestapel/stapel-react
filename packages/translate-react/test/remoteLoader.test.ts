// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createStapelClient } from "@stapel/core";
import type { I18nDictionary, Repository } from "@stapel/core";
import { createRemoteLocaleLoader, createTranslateApi } from "../src/index.js";
import type { CachedBundle } from "../src/index.js";

/**
 * The loader is the seam this pair exists for, so its ladder is tested rung by
 * rung — including the two rungs that only exist because a blank UI is not an
 * acceptable failure mode.
 */

const BUNDLE: I18nDictionary = {
  "moderation.reason.spam": "Correo no deseado",
  "currency.usd": "Dólar",
};

function memoryRepo(): Repository<CachedBundle> {
  const store = new Map<string, CachedBundle>();
  return {
    get: (key) => Promise.resolve(store.get(key)),
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    del: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
    keys: () => Promise.resolve([...store.keys()]),
    clear: () => {
      store.clear();
      return Promise.resolve();
    },
  };
}

interface Wire {
  readonly calls: string[];
}

function apiFor(
  routes: Record<string, [number, unknown]>,
  wire: Wire,
  offline = false
): ReturnType<typeof createTranslateApi> {
  return createTranslateApi(
    createStapelClient({
      baseUrl: "/translate/",
      fetch: ((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : String(input);
        wire.calls.push(url);
        if (offline) return Promise.reject(new TypeError("Failed to fetch"));
        for (const [suffix, [status, body]] of Object.entries(routes)) {
          if (url.includes(suffix)) {
            return Promise.resolve(
              new Response(JSON.stringify(body), {
                status,
                headers: { "content-type": "application/json" },
              })
            );
          }
        }
        return Promise.resolve(new Response("{}", { status: 200 }));
      }) as typeof globalThis.fetch,
    })
  );
}

const HEALTHY: Record<string, [number, unknown]> = {
  "languages/revision/": [200, { revision: 41 }],
  "/data/": [200, BUNDLE],
};

describe("the cold path", () => {
  it("reads the revision, downloads the bundle and reports it", async () => {
    const wire: Wire = { calls: [] };
    const loader = createRemoteLocaleLoader(apiFor(HEALTHY, wire), {
      cache: memoryRepo(),
    });
    const bundle = await loader("es");
    expect(bundle).toEqual(BUNDLE);
    expect(wire.calls).toHaveLength(2);
    const status = loader.getStatus("es");
    expect(status?.source).toBe("network");
    expect(status?.revision).toBe(41);
    expect(status?.keys).toBe(2);
    expect(status?.failed).toBe(false);
  });

  it("a warm start at the same revision costs ONE call, not two", async () => {
    const wire: Wire = { calls: [] };
    const cache = memoryRepo();
    const first = createRemoteLocaleLoader(apiFor(HEALTHY, wire), { cache });
    await first("es");
    wire.calls.length = 0;

    const second = createRemoteLocaleLoader(apiFor(HEALTHY, wire), { cache });
    const bundle = await second("es");
    expect(bundle).toEqual(BUNDLE);
    // Only the revision endpoint — the stored bundle carries the same number,
    // so it IS the current bundle.
    expect(wire.calls).toEqual([
      "/translate/api/v1/languages/revision/",
    ]);
    expect(second.getStatus("es")?.source).toBe("cache");
    expect(second.getStatus("es")?.stale).toBe(false);
  });

  it("a NEW revision replaces the stored bundle", async () => {
    const wire: Wire = { calls: [] };
    const cache = memoryRepo();
    await createRemoteLocaleLoader(apiFor(HEALTHY, wire), { cache })("es");
    const moved = createRemoteLocaleLoader(
      apiFor(
        {
          "languages/revision/": [200, { revision: 42 }],
          "/data/": [200, { ...BUNDLE, "currency.eur": "Euro" }],
        },
        wire
      ),
      { cache }
    );
    const bundle = await moved("es");
    expect(Object.keys(bundle)).toHaveLength(3);
    expect(moved.getStatus("es")?.revision).toBe(42);
    expect(moved.getStatus("es")?.source).toBe("network");
  });
});

describe("the ladder — it never returns nothing", () => {
  it("offline with a stored bundle: stale copy beats no copy, and says so", async () => {
    const wire: Wire = { calls: [] };
    const cache = memoryRepo();
    await createRemoteLocaleLoader(apiFor(HEALTHY, wire), { cache })("es");

    const offline = createRemoteLocaleLoader(apiFor({}, wire, true), { cache });
    const bundle = await offline("es");
    expect(bundle).toEqual(BUNDLE);
    const status = offline.getStatus("es");
    expect(status?.source).toBe("cache");
    expect(status?.failed).toBe(true);
    expect(status?.error).toBeDefined();
  });

  it("offline with nothing stored: the in-package bundle, reported as fallback", async () => {
    const wire: Wire = { calls: [] };
    const packaged: I18nDictionary = { "translate.error.unknown": "Vaya" };
    const loader = createRemoteLocaleLoader(apiFor({}, wire, true), {
      cache: memoryRepo(),
      fallbackBundles: { es: packaged },
    });
    const bundle = await loader("es");
    expect(bundle).toEqual(packaged);
    expect(loader.getStatus("es")?.source).toBe("fallback");
    expect(loader.getStatus("es")?.failed).toBe(true);
  });

  it("a regional tag falls back to its base language's package bundle", async () => {
    const wire: Wire = { calls: [] };
    const packaged: I18nDictionary = { "translate.error.unknown": "Vaya" };
    const loader = createRemoteLocaleLoader(apiFor({}, wire, true), {
      cache: null,
      fallbackBundles: { es: packaged },
    });
    expect(await loader("es-419")).toEqual(packaged);
  });

  it("an unsupported language degrades instead of throwing at the engine", async () => {
    const wire: Wire = { calls: [] };
    const loader = createRemoteLocaleLoader(
      apiFor(
        {
          "languages/revision/": [200, { revision: 41 }],
          "/data/": [404, { error: "Unsupported language: xx" }],
        },
        wire
      ),
      { cache: memoryRepo() }
    );
    // core's `setLocale` awaits this; a rejection here would break the switch
    // for a language the deployment simply does not carry.
    const bundle = await loader("xx");
    expect(bundle).toEqual({});
    expect(loader.getStatus("xx")?.source).toBe("fallback");
  });

  it("publishes to subscribers, so the status chip needs no second request", async () => {
    const wire: Wire = { calls: [] };
    const loader = createRemoteLocaleLoader(apiFor(HEALTHY, wire), {
      cache: null,
    });
    let seen = 0;
    const stop = loader.subscribe(() => {
      seen += 1;
    });
    await loader("es");
    expect(seen).toBe(1);
    expect(loader.getVersion()).toBe(1);
    stop();
    await loader("ru");
    expect(seen).toBe(1);
  });
});
