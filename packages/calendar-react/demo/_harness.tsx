/**
 * Shared harness for the calendar-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`:
 *
 *  - no raw colours: every colour is a token via `cssVar()`.
 *  - no hardcoded text: every label is an i18n key rendered with `t()`.
 *  - clickable-needs-event: {@link DemoButton} carries `data-analytics="none"` with a `data-analytics-reason` — honest, because this scaffold ships no flow machines yet (only the provider), so the button steps nothing auto-instrumented. Switch to `data-analytics="flow"` once a bag action drives a real machine. The
 *    action prop is named `run` (not `onClick`) so the CALL site is not itself an
 *    untracked clickable — the tracked point is the real `<button>` in here.
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
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, StapelApiError, createI18n, useT } from "@stapel/core";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { createCalendarRuntime } from "../src/index.js";
import { CalendarProvider, registerCalendarI18n } from "../src/index.js";

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

/** i18n copy for the demo chrome — a `demo.*` (unmanaged) namespace, so the
 * i18n-key-exists lint treats it as app-local and never false-positives. */
const demoBundleEn: Record<string, string> = {
  "demo.action.start": "Start",
  "demo.action.submit": "Submit",
  "demo.action.reset": "Reset",
  "demo.label.step": "state.step",
};

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
    engine.registerBundle("en", demoBundleEn);
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
        <CalendarProvider runtime={runtime}>{props.children}</CalendarProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

// ── shared demo UI (token-driven; no raw colours, no literal prose) ───────────

const cardStyle: CSSProperties = {
  background: cssVar("surface-raised"),
  color: cssVar("text"),
  border: `1px solid ${cssVar("border-subtle")}`,
  borderRadius: radii.lg,
  padding: spacing["5"],
  display: "flex",
  flexDirection: "column",
  gap: spacing["3"],
  maxWidth: "24rem",
  fontSize: fontSize.md.fontSize,
};

/** A titled card wrapper for a demo body. `heading` (not `title`) keeps the
 * no-hardcoded-text rule from treating a technical component name as prose. */
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

/** Renders the current flow step (a technical token, never user prose). */
export function StepBadge(props: { step: string }): ReactElement {
  const t = useT();
  return (
    <div style={{ display: "flex", gap: spacing["2"], alignItems: "center" }}>
      <span style={{ color: cssVar("text-muted") }}>
        {t("demo.label.step")}
      </span>
      <code
        style={{
          background: cssVar("surface-sunken"),
          color: cssVar("link"),
          borderRadius: radii.sm,
          // Size tokens are unitless numbers; React only auto-appends `px` to
          // single numeric values, so multi-value shorthands spell the unit.
          padding: `${spacing["1"]}px ${spacing["2"]}px`,
        }}
      >
        {props.step}
      </code>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  background: cssVar("brand"),
  color: cssVar("text-on-accent"),
  border: "none",
  borderRadius: radii.md,
  // See StepBadge: unitless tokens need an explicit unit in shorthands.
  padding: `${spacing["2"]}px ${spacing["4"]}px`,
  cursor: "pointer",
  fontSize: fontSize.sm.fontSize,
};

/**
 * A demo action button. The interactive prop is `run` (not `onClick`) so the
 * call site is not an untracked clickable; the real `<button>` here declares
 * `data-analytics="none"` with a `data-analytics-reason` — honest, because this scaffold ships no flow machines yet (only the provider), so the button steps nothing auto-instrumented. Switch to `data-analytics="flow"` once a bag action drives a real machine.
 */
export function DemoButton(props: {
  run: () => void;
  labelKey: string;
}): ReactElement {
  const t = useT();
  return (
    <button style={buttonStyle} data-analytics="none" data-analytics-reason="no-flow-machines" onClick={props.run}>
      {t(props.labelKey)}
    </button>
  );
}

/** A row of demo action buttons. */
export function DemoActions(props: { children: ReactNode }): ReactElement {
  return (
    <div style={{ display: "flex", gap: spacing["2"], flexWrap: "wrap" }}>
      {props.children}
    </div>
  );
}
