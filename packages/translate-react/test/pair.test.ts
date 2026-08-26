import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createStapelClient, isStapelApiError } from "@stapel/core";
import {
  UNSUPPORTED_LANGUAGE_CODE,
  createTranslateApi,
  translateQueryKeys,
  translateI18nBundleEn,
  registerTranslateI18n,
} from "../src/index.js";

/**
 * Contract tests. They MOCK THE WIRE, not the module (CONTRIBUTING.md): the
 * real `StapelClient` runs against a canned `fetch`, so the URL the pair builds
 * and the error dialect it produces are the ones production would see.
 */
function clientFor(
  handler: (url: string, body: unknown) => { status: number; body: unknown }
): ReturnType<typeof createStapelClient> {
  return createStapelClient({
    baseUrl: "/translate/",
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      const sent =
        typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
      const { status, body } = handler(url, sent);
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        })
      );
    }) as typeof globalThis.fetch,
  });
}

describe("the operations the contract publishes", () => {
  it("reads the revision at the module's own api/v1/ prefix", async () => {
    const seen: string[] = [];
    const api = createTranslateApi(
      clientFor((url) => {
        seen.push(url);
        return { status: 200, body: { revision: 41 } };
      })
    );
    const answer = await api.languagesRevision();
    expect(seen).toEqual(["/translate/api/v1/languages/revision/"]);
    expect(answer.revision).toBe(41);
  });

  it("asks for a bundle WITH the revision — the cache buster, not a filter", async () => {
    const seen: string[] = [];
    const api = createTranslateApi(
      clientFor((url) => {
        seen.push(url);
        return { status: 200, body: { "moderation.reason.spam": "Spam" } };
      })
    );
    const bundle = await api.languageData("es", 41);
    expect(seen).toEqual([
      "/translate/api/v1/languages/es/data/?revision=41",
    ]);
    expect(bundle["moderation.reason.spam"]).toBe("Spam");
  });

  it("folds the bare 404 into the condition's own error key", async () => {
    // The bundle route answers `{"error": "Unsupported language: xx"}` — NOT
    // the Stapel envelope — which core keys as the generic stapel.http.404. A
    // skin would render "Requested resource not found" for what is really
    // "this deployment does not carry that language".
    const api = createTranslateApi(
      clientFor(() => ({
        status: 404,
        body: { error: "Unsupported language: xx" },
      }))
    );
    const error = await api.languageData("xx", 41).catch((e: unknown) => e);
    expect(isStapelApiError(error)).toBe(true);
    if (!isStapelApiError(error)) return;
    expect(error.code).toBe(UNSUPPORTED_LANGUAGE_CODE);
    expect(error.status).toBe(404);
    expect(error.params["language"]).toBe("xx");
    expect(translateI18nBundleEn[UNSUPPORTED_LANGUAGE_CODE]).toBeTruthy();
  });

  it("refuses a bundle body that is not a flat key/copy dictionary", async () => {
    // `[object Object]` in the middle of somebody's menu is worse than an error.
    const api = createTranslateApi(
      clientFor(() => ({ status: 200, body: { "a.b": { nested: true } } }))
    );
    const error = await api.languageData("es", 1).catch((e: unknown) => e);
    expect(isStapelApiError(error)).toBe(true);
  });

  it("posts a single text as `text`, a batch as `texts`", async () => {
    const bodies: unknown[] = [];
    const api = createTranslateApi(
      clientFor((_url, body) => {
        bodies.push(body);
        return {
          status: 200,
          body: {
            texts: ["Hola"],
            text: "Hola",
            source_language: "en",
            target_language: "es",
            provider: "AgentProvider",
            cached: false,
          },
        };
      })
    );
    await api.text?.({ text: "Hello", targetLang: "es" });
    await api.text?.({ texts: ["Hello", "Bye"], targetLang: "es", context: "a title" });
    expect(bodies[0]).toEqual({ text: "Hello", target_lang: "es" });
    expect(bodies[1]).toEqual({
      texts: ["Hello", "Bye"],
      target_lang: "es",
      context: "a title",
    });
  });

  it("does NOT register `text` when the deployment offers no content translation", () => {
    const api = createTranslateApi(
      clientFor(() => ({ status: 200, body: {} })),
      { contentTranslate: false }
    );
    expect(api.text).toBeUndefined();
    // …and it IS there by default, because the endpoint ships in 0.7.0.
    expect(createTranslateApi(clientFor(() => ({ status: 200, body: {} }))).text)
      .toBeTypeOf("function");
  });
});

describe("wire types come from the generated schema (§2/§3)", () => {
  it("api/types.ts aliases the generated table, never a parallel body", () => {
    const src = readFileSync("src/api/types.ts", "utf8");
    expect(src).toMatch(/from "\.\/generated\/schema\.js"/);
    expect(src).toMatch(/Schemas\["TextTranslationResult"\]/);
    expect(src).toMatch(/Schemas\["TextTranslationRequest"\]/);
  });

  it("the generated schema carries every path this pair calls", () => {
    const schema = readFileSync("src/api/generated/schema.ts", "utf8");
    expect(schema).toContain('"/translate/api/v1/languages/revision/"');
    expect(schema).toContain('"/translate/api/v1/languages/{lang}/data/"');
    expect(schema).toContain('"/translate/api/v1/text/"');
  });

  it("the generated schema carries the 0.7.0 content-translation shapes", () => {
    const schema = readFileSync("src/api/generated/schema.ts", "utf8");
    expect(schema).toContain("TextTranslationRequest");
    expect(schema).toContain("TextTranslationResult");
    // The four fields the skin reads off the answer.
    expect(schema).toMatch(/source_language/);
    expect(schema).toMatch(/target_language/);
    expect(schema).toMatch(/provider/);
    expect(schema).toMatch(/cached/);
  });
});

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(translateQueryKeys.all[0]).toBe("translate");
    expect(translateQueryKeys.revision()).toEqual(["translate", "revision"]);
  });

  it("keys a bundle by locale AND revision — a new revision is a new entry", () => {
    expect(translateQueryKeys.bundle("ES", 12)).toEqual([
      "translate",
      "bundle",
      "es",
      12,
    ]);
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(translateI18nBundleEn["translate.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerTranslateI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["translate.error.unknown"]).toBeTruthy();
    expect(seen["language.ru"]).toBe("Русский");
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/translate-react");
    expect(manifest.backend.module).toBe("stapel-translate");
    // The pair was generated against the 0.7 contract — the minor that added
    // `POST text/` and this module's own error codes.
    expect(manifest.backend.contract).toContain("0.7");
    expect(Array.isArray(manifest.layers)).toBe(true);
  });

  it("mounts its one screen under the account section", () => {
    const nav = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    expect(nav.entries).toHaveLength(1);
    const entry = nav.entries[0];
    expect(entry.id).toBe("account.language");
    expect(entry.placement).toEqual({
      level: "submenu",
      parentId: "account.root",
    });
    expect(entry.component).toEqual({
      export: "LanguageSettingsPane",
      subpath: "default",
    });
  });
});
