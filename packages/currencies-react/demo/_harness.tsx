/**
 * Shared harness for the currencies-react demos (frontend-guardrails §4.2). Demos
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
 * renders identically in Ladle (interactive) and in vitest (smoke). The token
 * layer is the viewer's (data-theme + tokens.css); this wires the providers a
 * demo needs: query client, i18n, and the currencies runtime.
 * `SkinTheme` is mounted here too, so a `./default` demo is drawn
 * through the same antd bridge a host gets — a skin demo that themed
 * itself would document a screen nobody ships.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { createCurrenciesRuntime } from "../src/index.js";
import { CurrenciesProvider, registerCurrenciesI18n } from "../src/index.js";

/** The base every mock handler mounts on (mirrors stapel-currencies `/currencies/api/v1/`). */
export const DEMO_BASE = "https://currencies.demo.stapel.dev/currencies/api/v1/";

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
 * Provider frame every currencies demo variant renders inside. Builds a fresh mock
 * runtime + query client per mount so variants stay isolated.
 */
export function CurrenciesDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createCurrenciesRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerCurrenciesI18n(engine);
    engine.registerBundle("en", demoBundleEn);
    return {
      runtime: rt,
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
      i18n: engine,
    };
  }, [handlers]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <CurrenciesProvider runtime={runtime}>
          <SkinTheme>{props.children}</SkinTheme>
        </CurrenciesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

// ── shared demo UI (token-driven; no raw colours, no literal prose) ───────────

const cardStyle: CSSProperties = {
  background: cssVar("surface-raised"),
  color: cssVar("text"),
  border: `1px solid ${cssVar("border")}`,
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
          color: cssVar("brand"),
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

// ── catalogue fixtures ───────────────────────────────────────────────────────

/** The suffix `mockFetch` matches the catalogue read on. */
export const LIST_SUFFIX = "api/v1/";

/**
 * A slice of the backend's own seed list (`conf.DEFAULT_CURRENCIES`), rates
 * relative to USD. Real values, so a demo shows the arithmetic a deployment
 * actually performs rather than round numbers that hide rounding.
 */
export const DEMO_CURRENCIES: readonly Record<string, unknown>[] = [
  { code: "USD", display_name: "currency.usd", symbol: "$", value: "1.00000000", is_active: true },
  { code: "EUR", display_name: "currency.eur", symbol: "€", value: "0.93000000", is_active: true },
  { code: "GBP", display_name: "currency.gbp", symbol: "£", value: "0.79000000", is_active: true },
  { code: "PLN", display_name: "currency.pln", symbol: "zł", value: "4.00000000", is_active: true },
  { code: "RUB", display_name: "currency.rub", symbol: "₽", value: "92.59000000", is_active: true },
];

/** The Stapel error envelope (contract §6). */
export function demoEnvelope(code: string, message: string): Record<string, unknown> {
  return { localizable_error: code, error: message, params: {} };
}

/** The catalogue answers normally. */
export const HANDLERS_READY: DemoHandlers = { [LIST_SUFFIX]: DEMO_CURRENCIES };
/** The deployment has no currencies configured — an empty state, not a fault. */
export const HANDLERS_EMPTY: DemoHandlers = { [LIST_SUFFIX]: [] };
/** The catalogue read fails — the one state that is drawn as a failure. */
export const HANDLERS_FAILED: DemoHandlers = {
  [LIST_SUFFIX]: [500, demoEnvelope("error.500.internal", "Something went wrong")] as const,
};
