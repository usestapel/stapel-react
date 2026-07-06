/**
 * Shared harness for the profiles-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`:
 *
 *  - no raw colours: every colour is a token via `cssVar()`.
 *  - no hardcoded text: every label is an i18n key rendered with `t()`.
 *  - clickable-needs-event: {@link DemoButton} carries `data-analytics="none"`
 *    with a reason — profiles is a FLOW-LESS pair (0 flows), and a headless pair
 *    emits no analytics of its own: the host instruments profile edits /
 *    relationship actions at its own call sites (clickable-needs-event §3.2
 *    outcome (c)). The action prop is named `run` (not `onClick`) so the CALL
 *    site is not itself an untracked clickable — the marked point is the real
 *    `<button>` in here.
 *
 * The mock runtime injects a canned `fetch` (no MSW worker needed) so a demo
 * renders identically in Ladle (interactive) and in vitest (smoke). Themes are
 * the viewer's job (data-theme + tokens.css); this only wires the providers a
 * headless component needs: query client, i18n, and the profiles runtime.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { createProfilesRuntime } from "../src/index.js";
import { ProfilesProvider, registerProfilesI18n } from "../src/index.js";

/** The base every mock handler mounts on (mirrors stapel-profiles `/profiles/api/`). */
export const DEMO_BASE = "https://profiles.demo.stapel.dev/profiles/api/";

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
 * Provider frame every profiles demo variant renders inside. Builds a fresh mock
 * runtime + query client per mount so variants stay isolated.
 */
export function ProfilesDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createProfilesRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerProfilesI18n(engine);
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
        <ProfilesProvider runtime={runtime}>{props.children}</ProfilesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

// ── shared demo UI (token-driven; no raw colours, no literal prose) ───────────

const cardStyle: CSSProperties = {
  background: cssVar("card-bg"),
  color: cssVar("color-text-primary"),
  border: `1px solid ${cssVar("card-border")}`,
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
      <span style={{ color: cssVar("color-text-secondary") }}>
        {t("demo.label.step")}
      </span>
      <code
        style={{
          background: cssVar("color-background-secondary"),
          color: cssVar("color-text-brand"),
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
  background: cssVar("button-primary-bg"),
  color: cssVar("button-primary-text"),
  border: "none",
  borderRadius: radii.md,
  // See StepBadge: unitless tokens need an explicit unit in shorthands.
  padding: `${spacing["2"]}px ${spacing["4"]}px`,
  cursor: "pointer",
  fontSize: fontSize.sm.fontSize,
};

/**
 * A demo action button. The interactive prop is `run` (not `onClick`) so the
 * call site is not an untracked clickable; the real `<button>` here is marked
 * `data-analytics="none"` with a reason — profiles is a FLOW-LESS pair
 * (0 flows), and a headless pair emits no analytics of its own: the host
 * instruments profile edits / relationship actions at its own call sites
 * (clickable-needs-event §3.2 outcome (c)). The scaffold's harness hardcodes
 * `data-analytics="flow"`, which only holds for a pair that owns flow machines
 * — see the template-defect note in this pair's report.
 */
export function DemoButton(props: {
  run: () => void;
  labelKey: string;
}): ReactElement {
  const t = useT();
  return (
    <button
      style={buttonStyle}
      data-analytics="none"
      data-analytics-reason="headless demo action; the host instruments this"
      onClick={props.run}
    >
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
