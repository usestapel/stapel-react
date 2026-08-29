/**
 * Shared test harness: a chat runtime over an injected `fetch` (and, where a
 * test wants one, an injected socket), wrapped in the providers a hook or a
 * skin needs.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md): every request goes through
 * the real `StapelClient`, every response is a real `Response` carrying the
 * real body stapel-chat sends, and every frame is the real v1 envelope its
 * consumers emit — built by `test/chatServer.ts`, which reproduces
 * `ResumableStreamConsumer` rather than answering whatever the client hoped
 * for. Nothing here hand-shapes a value the code under test would otherwise
 * have derived — that is the only way these tests can disprove the assumption
 * that would produce the bug.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  ChatProvider,
  createChatRuntime,
  registerChatI18n,
} from "../src/index.js";
import type { ChatRealtimeOptions, ChatSlots } from "../src/index.js";

// The socket double stands at the ENVIRONMENT edge (`globalThis.WebSocket`),
// not at an injectable factory: a fake standing where `new WebSocket()`
// stands cannot see whether a credential travelled, and eighteen green tests
// once proved exactly that. Re-exported here so a React suite drives the same
// server the protocol suite does.
export {
  ChatServer,
  chatMessagePayload,
  installBrowserWebSocket,
} from "./chatServer.js";
export type { BrowserWebSocketEnvironment, ConstructedSocket } from "./chatServer.js";

export const BASE = "https://chat.test/chat/api/v1";

/** One recorded request. */
export interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

/** What a handler may return. */
export interface HandlerResult {
  readonly status?: number;
  readonly body?: unknown;
}

export type Handler = (call: RecordedCall) => HandlerResult;

export interface MockServer {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: RecordedCall[];
}

/**
 * Build a fetch over `substring → handler` routes, tried in declaration order
 * and matched on `"<METHOD> <substring>"` or just the substring.
 */
export function mockServer(
  routes: Readonly<Record<string, Handler | HandlerResult>>
): MockServer {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body) as unknown;
      } catch {
        body = init.body;
      }
    }
    const call: RecordedCall = { url, method, body };
    calls.push(call);

    for (const [pattern, route] of Object.entries(routes)) {
      const [maybeMethod, ...rest] = pattern.split(" ");
      const hasMethod = rest.length > 0 && /^[A-Z]+$/.test(maybeMethod ?? "");
      const needle = hasMethod ? rest.join(" ") : pattern;
      if (hasMethod && maybeMethod !== method) continue;
      if (!url.includes(needle)) continue;
      const result = typeof route === "function" ? route(call) : route;
      const status = result.status ?? 200;
      const nullBody = status === 204 || status === 205;
      return new Response(nullBody ? null : JSON.stringify(result.body ?? {}), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ localizable_error: "error.404.not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  return { fetch: fetchImpl, calls };
}

/** Providers every test render needs. */
export function TestHarness(props: {
  server: MockServer;
  /** Default: no socket at all — the polling half of the seam. */
  realtime?: ChatRealtimeOptions;
  /**
   * Host-supplied seams (names, subject card, report/block). Default: none,
   * which is the state a container that wired nothing is in — and the skin
   * has to be honest about it there too.
   */
  slots?: ChatSlots;
  locale?: string;
  /**
   * A cache the test itself holds, for the assertions that are about what a
   * live frame does to it (presence flips). Default: one per harness.
   */
  queryClient?: QueryClient;
  children: ReactNode;
}): ReactElement {
  const { server, realtime, locale, slots } = props;
  const suppliedClient = props.queryClient;
  // Memoized: the runtime carries the realtime config the freshness effect
  // depends on, and a fresh object each render would reopen the socket on
  // every render.
  const { runtime, i18n, queryClient } = useMemo(() => {
    const engine: I18nEngine = createI18n({ locale: locale ?? "en" });
    registerChatI18n(engine);
    return {
      runtime: createChatRuntime({
        baseUrl: BASE,
        fetch: server.fetch,
        realtime: realtime ?? { socketUrl: null },
        ...(slots !== undefined ? { slots } : {}),
      }),
      i18n: engine,
      queryClient:
        suppliedClient ??
        new QueryClient({
          // No retries: a test asserting a refusal must see it on the first
          // answer, not three timeouts later.
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        }),
    };
  }, [server, realtime, locale, slots, suppliedClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <ChatProvider runtime={runtime}>{props.children}</ChatProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
