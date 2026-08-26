/**
 * Shared harness for the calendar-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`:
 *
 *  - no raw colours and no hardcoded text: the harness renders no chrome of
 *    its own at all — it wires providers and hands the SKIN the stage.
 *
 * The scaffold's chip-dump apparatus (a titled card, a `state.step` badge, a
 * bare action button) is gone with the four legacy stories that used it: the
 * showcase photographs the SKIN, and a card printing a component name over a
 * flow token documents the headless twin, not the product (§83, visual pass
 * N-4).
 *
 * The mock runtime injects a canned `fetch` (no MSW worker needed) so a demo
 * renders identically in Ladle (interactive) and in vitest (smoke). Themes are
 * the viewer's job (data-theme + tokens.css); this only wires the providers a
 * headless component needs: query client, i18n, and the calendar runtime.
 *
 * ── `seed` is why the variants are not all the same picture ───────────────
 *
 * A read served by `handlers` is a PROMISE: the first painted frame is the
 * loading arm however the variant is named, so a static shot photographs a
 * skeleton and every variant of a demo comes out byte-identical (the
 * C-SAMESHOT defect `assertVariantsRenderDistinctly` exists to catch).
 * {@link DemoSeed} writes the answer — or the refusal — straight into the
 * query cache, so the variant OPENS in the state it is named for. `handlers`
 * stays for the writes and for a re-read a reader triggers by hand.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, StapelApiError, createI18n } from "@stapel/core";
import { createCalendarRuntime } from "../src/index.js";
import {
  CalendarPeopleProvider,
  CalendarProvider,
  registerCalendarI18n,
} from "../src/index.js";

/**
 * The demo deployment's user directory.
 *
 * stapel-calendar stores participation as ids and nothing else, so a host
 * registers the names (`CalendarPeopleProvider`). Every demo runs with one
 * registered, because a screen that prints `u-1` where a person belongs is
 * the product a host would ship if the pair offered no seam — and the
 * showcase photographs the product, not the seam's absence.
 */
const DEMO_PEOPLE: Readonly<Record<string, string>> = {
  "u-1": "Dana Reyes",
  "u-2": "Sam Okafor",
  "u-3": "Priya Nandi",
  "u-4": "Léa Fontaine",
};

function demoUserName(userId: string): string | undefined {
  return DEMO_PEOPLE[userId];
}

/** The base every mock handler mounts on (mirrors stapel-calendar `/calendar/api/`). */
export const DEMO_BASE = "https://calendar.demo.stapel.dev/calendar/api/";

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
 * One READ a variant OPENS with: a namespaced key from `calendarQueryKeys`
 * plus the answer already in hand. Exactly one of `data` / `error` is
 * meaningful — a read either answered or was refused.
 */
export interface DemoRead {
  /** Always `calendarQueryKeys.<kind>(…)`, never a literal array. */
  readonly key: readonly unknown[];
  /** The body the read answered with. */
  readonly data?: unknown;
  /** The refusal it came back with, for the arms only a failure reaches. */
  readonly error?: StapelApiError;
}

/** The reads a variant opens with (see the `seed` note in the file header). */
export type DemoSeed = readonly DemoRead[];

/**
 * A canned refusal in the pair's own dialect. `code` is the wire's
 * `localizable_error`, so the skin's refusal predicates (`isMandateUnavailable`,
 * `isMandateDenied`) branch on the demo exactly as they do on the backend.
 */
export function demoApiError(
  status: number,
  code: string,
  message: string
): StapelApiError {
  return new StapelApiError({ code, message, status });
}

/**
 * Write the seeded reads into the cache. A refusal cannot be expressed with
 * `setQueryData` (that API only carries data), so the failed arm builds the
 * cache entry and sets its state — the supported way to hand a query an error
 * without a round trip.
 */
function seedQueryClient(client: QueryClient, seed: DemoSeed): void {
  for (const read of seed) {
    if (read.error !== undefined) {
      client
        .getQueryCache()
        .build(client, { queryKey: read.key })
        .setState({
          status: "error",
          error: read.error,
          fetchStatus: "idle",
          // A fixed instant, so two renders of the same variant produce the
          // same frame (the distinctness check compares markup, not clocks).
          errorUpdatedAt: SEED_INSTANT,
          fetchFailureCount: 1,
          fetchFailureReason: read.error,
        });
      continue;
    }
    client.setQueryData(read.key, read.data);
  }
}

/** The clock every seeded read claims to have answered at. */
const SEED_INSTANT = 1_768_000_000_000;

/**
 * Provider frame every calendar demo variant renders inside. Builds a fresh mock
 * runtime + query client per mount so variants stay isolated.
 */
export function CalendarDemoHarness(props: {
  handlers?: DemoHandlers;
  /** Reads this variant opens with — the answer, not the request. */
  seed?: DemoSeed;
  children: ReactNode;
}): ReactElement {
  const { handlers, seed } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createCalendarRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerCalendarI18n(engine);
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          // A seeded read is the variant's SUBJECT, so nothing may quietly
          // re-read over it. Both knobs are load-bearing: without
          // `staleTime` a seeded body is refetched on mount and replaced by
          // the canned `{}`, and without `retryOnMount` a seeded REFUSAL is
          // wiped — react-query resets `status` to pending and clears the
          // error whenever it starts a fetch on a query that holds no data,
          // so every failure variant photographed a skeleton instead.
          staleTime: Number.POSITIVE_INFINITY,
          retryOnMount: false,
        },
      },
    });
    seedQueryClient(client, seed ?? []);
    return { runtime: rt, queryClient: client, i18n: engine };
  }, [handlers, seed]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <CalendarProvider runtime={runtime}>
          <CalendarPeopleProvider resolveUserName={demoUserName}>
            {props.children}
          </CalendarPeopleProvider>
        </CalendarProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
