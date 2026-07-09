import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { StapelProvider } from "../src/provider.js";
import { useStapelClient } from "../src/config.js";
import { createStapelClient } from "../src/client.js";
import { createStapelQueryClient } from "../src/query.js";
import { createI18n } from "../src/i18n.js";
import { useI18n, useT } from "../src/i18n.js";
import { useAnalytics } from "../src/analytics/context.js";
import type { Analytics } from "../src/analytics/types.js";
import { memoryStorage } from "../src/storage.js";

function wrapperWith(
  props: Omit<Parameters<typeof StapelProvider>[0], "children">
) {
  return function Wrapper(inner: { children: ReactNode }): ReactElement {
    return <StapelProvider {...props}>{inner.children}</StapelProvider>;
  };
}

describe("<StapelProvider> — the one-provider setup (slim wave S4)", () => {
  it("wires config + query + i18n from just a baseUrl", () => {
    const { result } = renderHook(
      () => ({
        client: useStapelClient(),
        queryClient: useQueryClient(),
        t: useT(),
        i18n: useI18n(),
      }),
      { wrapper: wrapperWith({ baseUrl: "/api" }) }
    );
    expect(result.current.client).toBeTruthy();
    expect(result.current.queryClient).toBeTruthy();
    expect(result.current.i18n.locale).toBe("en");
    // missing keys fall back to the key itself (§4.2)
    expect(result.current.t("some.key")).toBe("some.key");
  });

  it("throws without a baseUrl or client", () => {
    expect(() =>
      renderHook(() => useStapelClient(), { wrapper: wrapperWith({}) })
    ).toThrowError(/baseUrl.*client|client.*baseUrl/);
  });

  it("prefers an injected client and honors per-module overrides", () => {
    const client = createStapelClient({ baseUrl: "https://api.default" });
    const authClient = createStapelClient({ baseUrl: "https://api.auth" });
    const { result } = renderHook(
      () => ({
        def: useStapelClient(),
        auth: useStapelClient("auth"),
      }),
      { wrapper: wrapperWith({ client, clients: { auth: authClient } }) }
    );
    expect(result.current.def).toBe(client);
    expect(result.current.auth).toBe(authClient);
  });

  it("escape hatches: BYO i18n engine, query runtime, analytics", () => {
    const i18n = createI18n({ locale: "ru", bundles: { ru: { hi: "привет" } } });
    const query = createStapelQueryClient({ storage: memoryStorage() });
    const analytics: Analytics = {
      track: () => undefined,
      identify: () => undefined,
      page: () => undefined,
      flush: () => Promise.resolve(),
      setConsent: () => Promise.resolve(),
      getConsent: () => "granted",
      register: () => undefined,
      unregister: () => undefined,
    };
    const { result } = renderHook(
      () => ({
        t: useT(),
        queryClient: useQueryClient(),
        analytics: useAnalytics(),
      }),
      {
        wrapper: wrapperWith({
          baseUrl: "/api",
          i18n,
          queryRuntime: query,
          analytics,
        }),
      }
    );
    expect(result.current.t("hi")).toBe("привет");
    expect(result.current.queryClient).toBe(query.queryClient);
    expect(result.current.analytics).toBe(analytics);
  });
});
