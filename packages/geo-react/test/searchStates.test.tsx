/**
 * `<AddressSearchField/>` — the six states, and which of them are failures.
 *
 * Every one of these is driven through a real HTTP response (MSW) so the
 * `GeocoderAvailability` under test is produced by `@stapel/core`'s transport
 * from the body the backend actually sends, not by a hand-built
 * `{ status: 401 }` — which is the shape that made a whole class of these
 * branches unreachable in production while every unit test passed.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { AddressSearchField } from "../src/default/AddressSearchField.js";
import { usePlaceSearch } from "../src/headless/usePlaceSearch.js";
import type { MapConfig } from "../src/api/types.js";
import { CONFIG_URL, SEARCH_URL, envelope, features, mapConfig, wrap } from "./helpers.js";

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const CONFIG = mapConfig() as unknown as MapConfig;

/** Module-level, not an inline literal: the hook takes the bias by identity
 * (it is an effect dependency), so a fresh object each render would re-arm the
 * debounce forever. The picker passes its `center` STATE for the same reason. */
const BIAS = { lat: 52.5, lon: 13.4 };

/** The field, driven by the real hook against the real config. */
function Harness(): ReactElement {
  const search = usePlaceSearch({ config: CONFIG, bias: BIAS, zoom: 13 });
  return <AddressSearchField search={search} onPick={() => undefined} data-testid="field" />;
}

function mount(): void {
  render(wrap(<Harness />));
}

function type(text: string): void {
  fireEvent.change(screen.getByTestId("geo-search-input"), { target: { value: text } });
}

const state = (name: string): HTMLElement | null =>
  document.querySelector(`[data-geo-search-state="${name}"]`);

describe("<AddressSearchField/>", () => {
  it("says 'keep typing' below search_min_chars — not an empty state", () => {
    mount();
    expect(state("idle")?.textContent).toContain("Keep typing");
    type("Un");
    expect(state("idle")).not.toBeNull();
    // Nothing has been asked, so nothing may claim nothing matched.
    expect(screen.queryByTestId("geo-search-empty")).toBeNull();
  });

  it("renders the server's own `formatted` line for each suggestion", async () => {
    server.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json(
          features([
            ["Unter den Linden, 1, Berlin, Deutschland", 13.38333, 52.51667, 1],
            ["Unter den Linden, 2, Berlin, Deutschland", 13.384, 52.5167, 2],
          ])
        )
      )
    );
    mount();
    type("Unter den Linden");
    await waitFor(() => {
      expect(screen.getAllByTestId("geo-suggestion")).toHaveLength(2);
    });
    expect(screen.getAllByTestId("geo-suggestion")[0]?.textContent).toBe(
      "Unter den Linden, 1, Berlin, Deutschland"
    );
  });

  it("shows an EMPTY STATE for zero features — a successful call that matched nothing", async () => {
    server.use(http.get(SEARCH_URL, () => HttpResponse.json(features([]))));
    mount();
    type("qqqqqqq");
    await waitFor(() => {
      expect(screen.getByTestId("geo-search-empty")).toBeDefined();
    });
    // An empty answer is not an error (contract §6).
    expect(screen.queryByTestId("geo-search-error")).toBeNull();
    expect(document.querySelector("[data-stapel-error]")).toBeNull();
  });

  it("states the anonymous case plainly on 401 — the map still works", async () => {
    server.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json(envelope("error.401.unauthorized", "Authentication required"), {
          status: 401,
        })
      )
    );
    mount();
    type("Unter den Linden");
    await waitFor(() => {
      expect(state("unauthorized")).not.toBeNull();
    });
    expect(state("unauthorized")?.textContent).toContain("place the pin yourself");
    // Not a fault: no alert, no red, and no retry offered for a permission.
    expect(screen.queryByTestId("geo-search-error")).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps the last good suggestions on a 429 and says why nothing new arrives", async () => {
    let call = 0;
    server.use(
      http.get(SEARCH_URL, () => {
        call += 1;
        return call === 1
          ? HttpResponse.json(
              features([["Unter den Linden, 1, Berlin, Deutschland", 13.38333, 52.51667, 1]])
            )
          : HttpResponse.json(envelope("error.429.too_many_requests", "Too many requests"), {
              status: 429,
            });
      })
    );
    mount();
    type("Unter den Linden");
    await waitFor(() => {
      expect(screen.getAllByTestId("geo-suggestion")).toHaveLength(1);
    });
    type("Unter den Linden 1");
    await waitFor(() => {
      expect(state("throttled")).not.toBeNull();
    });
    // THE point of the state: the suggestions did not vanish.
    expect(screen.getAllByTestId("geo-suggestion")).toHaveLength(1);
    expect(screen.queryByTestId("geo-search-error")).toBeNull();
  });

  it("states a 502 as a failure WITH a retry — that one is retryable", async () => {
    server.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json(
          envelope("error.502.geocoder_unavailable", "The geocoder is unavailable"),
          { status: 502 }
        )
      )
    );
    mount();
    type("Unter den Linden");
    await waitFor(() => {
      expect(screen.getByTestId("geo-search-error")).toBeDefined();
    });
    expect(screen.getByTestId("geo-search-error").textContent).toContain(
      "address service is not responding"
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("never puts a reason in a title attribute", async () => {
    server.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json(envelope("error.403.forbidden", "Forbidden"), { status: 403 })
      )
    );
    mount();
    type("Unter den Linden");
    await waitFor(() => {
      expect(state("unauthorized")).not.toBeNull();
    });
    for (const element of document.querySelectorAll("[title]")) {
      expect(element.getAttribute("title")).toBe("");
    }
  });

  it("keeps the config's own endpoint path and bias, rather than a hardcoded one", async () => {
    const seen: string[] = [];
    server.use(
      http.get(SEARCH_URL, ({ request }) => {
        seen.push(request.url);
        return HttpResponse.json(features([]));
      })
    );
    mount();
    type("Unter den Linden");
    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    const url = new URL(seen[0] as string);
    // No trailing slash — `…/geocoding/search/` is a 404 (contract §1).
    expect(url.pathname).toBe("/geo/api/v1/geocoding/search");
    expect(url.searchParams.get("q")).toBe("Unter den Linden");
    expect(url.searchParams.get("bias_lat")).toBe("52.5");
    expect(url.searchParams.get("bias_lon")).toBe("13.4");
    // `lang` is deliberately absent — send `default` or nothing (contract §4).
    expect(url.searchParams.has("lang")).toBe(false);
  });

  it("does not call the geocoder at all below the deployment's minimum", async () => {
    const calls: string[] = [];
    server.use(
      http.get(SEARCH_URL, ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json(features([]));
      }),
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig()))
    );
    mount();
    type("Un");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(calls).toHaveLength(0);
  });
});

/**
 * The 429 promise, pinned at the layer that MAKES it.
 *
 * `usePlaceSearch`'s doc says the last good suggestions survive a rate limit.
 * They did not: `loadLoading()` is set before every request, and merely
 * DECLINING to write a failure left the bag spinning for the whole throttle
 * window. The skin above happened to be fine because it kept its own copy —
 * which is exactly why this test exists one layer down: a host with its own
 * visuals reads the hook, and the hook is where the sentence was written.
 */
/** `wrap` takes children, not a props object — `renderHook` wants a component. */
function HookWrapper(props: { children: ReactNode }): ReactElement {
  return wrap(props.children);
}

describe("usePlaceSearch — the promises the hook itself makes", () => {
  it("puts the last good suggestions BACK on a 429, rather than spinning", async () => {
    let call = 0;
    server.use(
      http.get(SEARCH_URL, () => {
        call += 1;
        return call === 1
          ? HttpResponse.json(
              features([["Unter den Linden, 1, Berlin, Deutschland", 13.38333, 52.51667, 1]])
            )
          : HttpResponse.json(envelope("error.429.too_many_requests", "Too many"), {
              status: 429,
            });
      })
    );
    const config = mapConfig() as unknown as MapConfig;
    const { result } = renderHook(() => usePlaceSearch({ config }), { wrapper: HookWrapper });

    act(() => {
      result.current.setQuery("Unter den Linden");
    });
    await waitFor(() => {
      expect(result.current.results.status).toBe("ready");
    });
    await waitFor(() => {
      expect(
        result.current.results.status === "ready" ? result.current.results.data.length : 0
      ).toBe(1);
    });

    act(() => {
      result.current.setQuery("Unter den Linden 1");
    });
    await waitFor(() => {
      expect(result.current.availability).toBe("throttled");
    });
    // Not `loading`, and not `failed`: the list the person is looking at.
    expect(result.current.results.status).toBe("ready");
    expect(
      result.current.results.status === "ready" ? result.current.results.data.length : 0
    ).toBe(1);
  });

  it("does not loop when `bias` is written inline, as every caller will write it", async () => {
    // `bias={{ lat, lon }}` is a fresh object on every render. Depending on it
    // by identity made the effect re-fire, which re-rendered, which re-fired —
    // an infinite loop reached by the most natural way to call this hook. The
    // two numbers are the dependency now.
    server.use(http.get(SEARCH_URL, () => HttpResponse.json(features([]))));
    const config = mapConfig() as unknown as MapConfig;
    let renders = 0;
    const { result, rerender } = renderHook(
      () => {
        renders += 1;
        return usePlaceSearch({ config, bias: { lat: 52.5, lon: 13.4 } });
      },
      { wrapper: HookWrapper }
    );
    const after = renders;
    rerender();
    await waitFor(() => {
      expect(result.current.idle).toBe(true);
    });
    // A handful of renders, not a runaway. Without the fix this never settles.
    expect(renders).toBeLessThan(after + 10);
  });
});
