/**
 * Shared harness for the reviews-react demos (frontend-guardrails §4.2).
 * Demos are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * colours (tokens via `cssVar()`) and no hardcoded prose (every label is a
 * key).
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { ReviewsProvider, createReviewsRuntime, registerReviewsI18n } from "../src/index.js";

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
 * `/reviews/aggregate` can be told apart from `/reviews`.
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
 * `demo.*` is an UNMANAGED namespace, so `i18n-key-exists` treats these as
 * app-local and never false-positives on them.
 *
 * Review bodies are FIXTURE CONTENT, not library copy — a real review is
 * whatever a buyer typed. They are keys here only so the demo carries no
 * hardcoded prose.
 */
const demoBundleEn: Record<string, string> = {
  "demo.review.body.good": "Exactly as described, met at the metro, no fuss.",
  "demo.review.body.ok": "Works fine, box was a bit battered.",
  "demo.review.body.pending": "Awaiting a moderator's decision.",
  "demo.review.body.hidden": "Hidden by a moderator.",
  "demo.review.body.future": "Filed under a state this build predates.",
  "demo.review.response.thanks": "Thanks for the review!",
  "demo.author.buyer": "Anna K.",
};

/** Provider frame every reviews demo variant renders inside. */
export function ReviewsDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const engine = createI18n({ locale: "en" });
    registerReviewsI18n(engine);
    engine.registerBundle("en", demoBundleEn);
    return {
      runtime: createReviewsRuntime({
        baseUrl: DEMO_BASE,
        fetch: mockFetch(handlers ?? {}),
      }),
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
      i18n: engine,
    };
  }, [handlers]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <ReviewsProvider runtime={runtime}>{props.children}</ReviewsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

const cardStyle: CSSProperties = {
  background: cssVar("surface-raised"),
  color: cssVar("text"),
  border: `1px solid ${cssVar("border")}`,
  borderRadius: radii.lg,
  padding: spacing["5"],
  display: "flex",
  flexDirection: "column",
  gap: spacing["3"],
  fontSize: fontSize.md.fontSize,
};

/** A titled card wrapper for a demo body. */
export function DemoCard(props: {
  heading: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <div style={cardStyle} data-theme-surface>
      <strong style={{ fontSize: fontSize.lg.fontSize }}>{props.heading}</strong>
      {props.children}
    </div>
  );
}

/** Renders a technical token (a load status, a count), never user prose. */
export function StepBadge(props: { step: string }): ReactElement {
  return (
    <code
      style={{
        background: cssVar("surface-sunken"),
        color: cssVar("brand"),
        borderRadius: radii.sm,
        padding: `${spacing["1"]}px ${spacing["2"]}px`,
      }}
    >
      {props.step}
    </code>
  );
}
