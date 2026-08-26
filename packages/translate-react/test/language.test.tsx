import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { Analytics } from "@stapel/core";
import { TRANSLATE_EVENTS, useLanguage } from "../src/index.js";
import {
  __resetLanguagePreferenceStores,
  createLanguagePreferenceStore,
} from "../src/model/preference.js";
import { makeHarness, recordingFetch } from "./helpers.js";

/**
 * Switching a language is three things at once — the bundle, the memory of the
 * choice, and `<html lang>` — and a switch that does only the first is the one
 * a screen-reader user notices immediately and nobody else does.
 */

function Probe(): ReactElement {
  const language = useLanguage();
  return (
    <div>
      <span data-testid="code">{language.code}</span>
      <span data-testid="partial">{String(language.partial)}</span>
      <button
        type="button"
        data-testid="to-es"
        onClick={() => {
          language.setCode("es");
        }}
      >
        {language.options.length}
      </button>
    </div>
  );
}

function analyticsDouble(): { analytics: Analytics; seen: unknown[][] } {
  const seen: unknown[][] = [];
  const analytics = {
    track: (event: unknown, props?: unknown) => {
      seen.push([event, props]);
    },
    identify: () => undefined,
    page: () => undefined,
    flush: () => Promise.resolve(),
    setConsent: () => Promise.resolve(),
    getConsent: () => "granted",
    register: () => undefined,
    unregister: () => undefined,
  } as unknown as Analytics;
  return { analytics, seen };
}

afterEach(async () => {
  cleanup();
  __resetLanguagePreferenceStores();
  window.localStorage.clear();
  await act(async () => {
    await Promise.resolve();
  });
});

describe("useLanguage — a switch that really switched", () => {
  it("loads the locale, remembers it, and updates <html lang>", async () => {
    const wrote: string[] = [];
    const { analytics, seen } = analyticsDouble();
    const wire = recordingFetch({
      routes: {
        "languages/revision/": [200, { revision: 9 }],
        "/data/": [200, { "translate.button.label": "Traducir" }],
      },
    });
    const { Wrapper, i18n } = makeHarness({
      fetch: wire.fetch,
      analytics,
      preferenceStore: {
        read: () => Promise.resolve(undefined),
        write: (code) => {
          wrote.push(code);
          return Promise.resolve();
        },
      },
    });
    render(
      <Wrapper>
        <Probe />
      </Wrapper>
    );
    expect(screen.getByTestId("code").textContent).toBe("en");

    await act(async () => {
      screen.getByTestId("to-es").click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(i18n.locale).toBe("es");
    expect(screen.getByTestId("code").textContent).toBe("es");
    expect(wrote).toEqual(["es"]);
    expect(document.documentElement.lang).toBe("es");
    // The bundle really was fetched through the pair's own loader.
    expect(wire.calls.some((call) => call.url.includes("/es/data/"))).toBe(true);
    expect(seen[0]?.[0]).toBe(TRANSLATE_EVENTS.languageChanged);
    expect(seen[0]?.[1]).toEqual({ from: "en", to: "es" });
  });

  it("applies the stored choice on mount", async () => {
    const { Wrapper, i18n } = makeHarness({
      preferenceStore: {
        read: () => Promise.resolve("ru"),
        write: () => Promise.resolve(),
      },
    });
    render(
      <Wrapper>
        <Probe />
      </Wrapper>
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(i18n.locale).toBe("ru");
  });

  it("says the copy is partial when the loader fell all the way through", () => {
    const { Wrapper } = makeHarness({
      status: {
        locale: "en",
        revision: null,
        keys: 0,
        source: "fallback",
        stale: false,
        failed: true,
        error: new Error("offline"),
      },
    });
    render(
      <Wrapper>
        <Probe />
      </Wrapper>
    );
    expect(screen.getByTestId("partial").textContent).toBe("true");
  });

  it("keeps the choice even when persisting it fails", async () => {
    const spy = vi.fn(() => Promise.reject(new Error("quota")));
    const { Wrapper, i18n } = makeHarness({
      preferenceStore: {
        read: () => Promise.resolve(undefined),
        write: spy,
      },
    });
    render(
      <Wrapper>
        <Probe />
      </Wrapper>
    );
    await act(async () => {
      screen.getByTestId("to-es").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(spy).toHaveBeenCalled();
    expect(i18n.locale).toBe("es");
  });
});

describe("the preference store — the scope follows the session", () => {
  it("a visitor's choice lives in the app scope, through createRepository", async () => {
    // No session manager is active in this test, so the visitor path is the
    // one taken — and it must be the sanctioned store, not raw localStorage:
    // the key prefix is the evidence.
    const store = createLanguagePreferenceStore();
    await store.write("es");
    expect(await store.read()).toBe("es");
    const keys = Object.keys(window.localStorage);
    expect(keys.some((key) => key.startsWith("stapel:repo:translate:"))).toBe(
      true
    );
    // …and the value is NOT encrypted in this scope (no session key exists).
    expect(
      keys.some((key) => key.includes("language"))
    ).toBe(true);
  });

  it("survives a fresh store instance — that is what remembering means", async () => {
    await createLanguagePreferenceStore().write("ru");
    __resetLanguagePreferenceStores();
    expect(await createLanguagePreferenceStore().read()).toBe("ru");
  });
});
