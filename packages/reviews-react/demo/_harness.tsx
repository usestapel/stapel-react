/**
 * Provider frame for the reviews-react demos (frontend-guardrails §4.2).
 *
 * ── What used to be here, and why it is gone ──────────────────────────────
 *
 * This file used to export a `DemoCard` (a bordered box with the component's
 * class name as a heading) and a `StepBadge` (a monospace chip printing a bag
 * field). Every demo rendered the HEADLESS render prop into those, so the
 * whole showcase for this pair was `5/5 · published · reply` and
 * `submit: reviews.submit.blocked.no_rating` — a hook conformance harness
 * photographed as if it were the product, while `ReviewsPanel` and
 * `ReviewFormCard` had never been drawn at all (visual pass, class C-NOSKIN).
 *
 * The demos now render the SKIN, so the debug chrome is deleted rather than
 * kept beside it: the point of the showcase is the shipped surface, and a
 * harness that renders a second, uglier version of every state is how the real
 * one stays unreviewed. Everything left here is plumbing — a mock wire, the
 * providers, and a page frame — and none of it draws.
 *
 * MOCK THE WIRE, NOT THE MODULE: every request goes through the real
 * `StapelClient` and every response is a real `Response` carrying the real
 * body stapel-reviews sends.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import {
  ReviewsProvider,
  createReviewsRuntime,
  registerReviewsI18n,
} from "../src/index.js";
import type { ReviewRatingBounds } from "../src/index.js";

/** The base every mock handler mounts on (mirrors `/reviews/api/v1`). */
export const DEMO_BASE = "https://reviews.demo.stapel.dev/reviews/api/v1";

export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/**
 * Build a canned `fetch` from a route key → response map. A key may name a
 * method (`"POST /reviews"`), and matching is on the full URL so
 * `/reviews/aggregate` and `/moderate` can be told apart from `/reviews`.
 * Routes are tried in declaration order, which matters because `/reviews` is a
 * prefix of every other path here.
 */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  const routes = Object.entries(handlers);
  return ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const found = routes.find(([pattern]) => {
      const [head, ...rest] = pattern.split(" ");
      const hasMethod = rest.length > 0 && /^[A-Z]+$/.test(head ?? "");
      if (hasMethod && head !== method) return false;
      const needle = hasMethod ? rest.join(" ") : pattern;
      return new URL(url).pathname.endsWith(needle) || url.includes(needle);
    });
    const [status, body] = statusAndBody(found?.[1] ?? {});
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof globalThis.fetch;
}

/**
 * Provider frame every reviews demo variant renders inside.
 *
 * `ratingBounds` is a demo knob for the same reason it is a runtime option:
 * `RATING_MIN`/`RATING_MAX` are deployment settings, and a showcase that only
 * ever draws five stars hides the fact that the skin follows them.
 */
export function ReviewsDemoHarness(props: {
  handlers?: DemoHandlers;
  ratingBounds?: Partial<ReviewRatingBounds>;
  children: ReactNode;
}): ReactElement {
  const { handlers, ratingBounds } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const engine = createI18n({ locale: "en" });
    registerReviewsI18n(engine);
    return {
      runtime: createReviewsRuntime({
        baseUrl: DEMO_BASE,
        fetch: mockFetch(handlers ?? {}),
        ...(ratingBounds !== undefined ? { ratingBounds } : {}),
      }),
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
      i18n: engine,
    };
  }, [handlers, ratingBounds]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <ReviewsProvider runtime={runtime}>
          {/* Element-width geometry: the frame is a max measure, not a
              viewport calculation — the viewer owns the width, and the skin
              fills whatever it is given. */}
          <div style={{ maxWidth: MEASURE, padding: spacing[3] }}>
            {props.children}
          </div>
        </ReviewsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** A readable measure for a review column — prose, not a dashboard. */
const MEASURE = "44rem";
