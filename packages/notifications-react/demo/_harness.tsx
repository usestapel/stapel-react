/**
 * Shared harness for the notifications-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`.
 *
 * It carries providers and canned server state, and nothing visual: every demo
 * in this pair renders a `src/default` skin, so a demo-local card, step chip or
 * button would only put a second, worse design of the same screen on the glass.
 *
 * The mock runtime injects a canned `fetch` (no MSW worker needed) so a demo
 * renders identically in Ladle (interactive) and in vitest (smoke). Themes are
 * the viewer's job (data-theme + tokens.css); this only wires the providers a
 * headless component needs: query client, i18n, and the notifications runtime.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { createNotificationsRuntime } from "../src/index.js";
import { NotificationsProvider, registerNotificationsI18n } from "../src/index.js";
import { notificationsQueryKeys } from "../src/index.js";
import type { DeviceListItem, NotificationFeedPage } from "../src/index.js";

/** The base every mock handler mounts on (mirrors stapel-notifications `/notifications/api/`). */
export const DEMO_BASE = "https://notifications.demo.stapel.dev/notifications/api/";

/**
 * A handler map: path suffix → response. A plain value is a 200 JSON body; a
 * `[status, body]` tuple sets the HTTP status (so a demo can reach an error
 * step).
 */
export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number"
  ) {
    return [value[0], value[1]];
  }
  return [200, value];
}

/** Build a canned `fetch` from a suffix→response map; unmatched paths return `{}`. */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    let matched: DemoResponse = {};
    for (const [suffix, value] of Object.entries(handlers)) {
      if (url.includes(suffix)) {
        matched = value;
        break;
      }
    }
    const [status, body] = statusAndBody(matched);
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof globalThis.fetch;
}

/**
 * Server state a variant starts with, written straight into the query cache.
 *
 * A demo whose data arrives asynchronously renders its LOADING arm on the
 * first paint, which is the frame a static screenshot and the variant-
 * distinctness guard both see — so four variants of a data-backed screen come
 * out as four photographs of the same skeleton. Seeding the cache makes the
 * first paint the state the variant is named after, which is the whole point
 * of declaring one.
 */
export interface DemoSeed {
  /** Pages of `GET /feed/`, newest first — one entry is the common case. */
  readonly feed?: readonly NotificationFeedPage[];
  /** The `GET /devices/` answer. */
  readonly devices?: readonly DeviceListItem[];
}

/**
 * Provider frame every notifications demo variant renders inside. Builds a fresh mock
 * runtime + query client per mount so variants stay isolated.
 */
export function NotificationsDemoHarness(props: {
  handlers?: DemoHandlers;
  seed?: DemoSeed;
  children: ReactNode;
}): ReactElement {
  const { handlers, seed } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createNotificationsRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerNotificationsI18n(engine);
    const client = new QueryClient({
      // `staleTime: Infinity` so the seeded state is what stays on screen: a
      // background refetch against the canned fetch would replace a named
      // variant's fixture with the harness's generic one.
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    if (seed?.feed !== undefined) {
      client.setQueryData(notificationsQueryKeys.feed(), {
        pages: [...seed.feed],
        pageParams: seed.feed.map(() => undefined),
      });
    }
    if (seed?.devices !== undefined) {
      client.setQueryData(notificationsQueryKeys.devices(), [...seed.devices]);
    }
    return { runtime: rt, queryClient: client, i18n: engine };
  }, [handlers, seed]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <NotificationsProvider runtime={runtime}>{props.children}</NotificationsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
