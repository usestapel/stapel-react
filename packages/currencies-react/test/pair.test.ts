import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createStapelClient, isStapelApiError } from "@stapel/core";
import {
  UNKNOWN_CURRENCY_CODE,
  createCurrenciesApi,
  currenciesQueryKeys,
  currenciesI18nBundleEn,
  registerCurrenciesI18n,
} from "../src/index.js";

/**
 * Contract tests. They MOCK THE WIRE, not the module (CONTRIBUTING.md): the
 * real `StapelClient` runs against a canned `fetch`, so the URL the pair builds
 * and the error dialect it produces are the ones production would see.
 */
function clientFor(
  handler: (url: string) => { status: number; body: unknown }
): ReturnType<typeof createStapelClient> {
  return createStapelClient({
    baseUrl: "/currencies/",
    fetch: ((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      const { status, body } = handler(url);
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        })
      );
    }) as typeof globalThis.fetch,
  });
}

describe("the two operations the contract publishes", () => {
  it("lists the catalogue at the module's own api/v1/ prefix", async () => {
    const seen: string[] = [];
    const api = createCurrenciesApi(
      clientFor((url) => {
        seen.push(url);
        return { status: 200, body: [{ code: "USD", display_name: "currency.usd" }] };
      })
    );
    const rows = await api.list();
    expect(seen).toEqual(["/currencies/api/v1/"]);
    expect(rows[0]?.code).toBe("USD");
  });

  it("upper-cases the code before the retrieve call", async () => {
    const seen: string[] = [];
    const api = createCurrenciesApi(
      clientFor((url) => {
        seen.push(url);
        return { status: 200, body: { code: "USD", display_name: "currency.usd" } };
      })
    );
    await api.retrieve("usd");
    expect(seen).toEqual(["/currencies/api/v1/USD/"]);
  });

  it("folds the bare DRF 404 into the condition's own error key", async () => {
    // The retrieve route answers `{"detail": "Not found."}` — NOT the Stapel
    // envelope — which core keys as the generic stapel.http.404. A skin would
    // render "Requested resource not found" for what is really "that is not a
    // currency we carry".
    const api = createCurrenciesApi(
      clientFor(() => ({ status: 404, body: { detail: "Not found." } }))
    );
    const error = await api.retrieve("zzz").catch((e: unknown) => e);
    expect(isStapelApiError(error)).toBe(true);
    if (!isStapelApiError(error)) return;
    expect(error.code).toBe(UNKNOWN_CURRENCY_CODE);
    expect(error.status).toBe(404);
    expect(error.params["code"]).toBe("ZZZ");
    // …and the key resolves to a real sentence, in the en bundle at least.
    expect(currenciesI18nBundleEn[UNKNOWN_CURRENCY_CODE]).toBeTruthy();
  });

  it("leaves a 404 that DID carry an envelope alone", async () => {
    const api = createCurrenciesApi(
      clientFor(() => ({
        status: 404,
        body: { localizable_error: "error.404.ad_not_found", error: "nope", params: {} },
      }))
    );
    const error = await api.retrieve("usd").catch((e: unknown) => e);
    expect(isStapelApiError(error) && error.code).toBe("error.404.ad_not_found");
  });
});

describe("the wire types come from the generated schema, not by hand", () => {
  it("api/types.ts derives from ./generated/schema.js", () => {
    const src = readFileSync("src/api/types.ts", "utf8");
    expect(src).toMatch(/from "\.\/generated\/schema\.js"/);
    expect(src).toMatch(/Schemas\["Currency"\]/);
  });

  it("the generated schema carries both published paths", () => {
    const schema = readFileSync("src/api/generated/schema.ts", "utf8");
    expect(schema).toContain('"/currencies/api/v1/"');
    expect(schema).toContain('"/currencies/api/v1/{code}/"');
  });
});

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(currenciesQueryKeys.all[0]).toBe("currencies");
    expect(currenciesQueryKeys.list()).toEqual(["currencies", "list"]);
  });

  it("keys one currency by its canonical upper-case code", () => {
    expect(currenciesQueryKeys.one("usd")).toEqual(["currencies", "one", "USD"]);
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(currenciesI18nBundleEn["currencies.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerCurrenciesI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["currencies.error.unknown"]).toBeTruthy();
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/currencies-react");
    expect(manifest.backend.module).toBe("stapel-currencies");
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });

  it("declares no nav entry — this pair owns no page", () => {
    const nav = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    expect(nav.entries).toEqual([]);
  });
});
