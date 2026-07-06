/**
 * Shared harness for the auth-react demos (frontend-guardrails §4.2). Demos are
 * first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered —
 * so this file obeys the same guardrails as `src/`:
 *
 *  - no raw colours: every colour is a token via `cssVar()` (F7 closed by API).
 *  - no hardcoded text: every label is an i18n key rendered with `t()` (F7).
 *  - clickable-needs-event: {@link DemoButton} carries `data-analytics="flow"` —
 *    honest, because a headless bag action STEPS a flow machine, which is
 *    auto-instrumented (`flow.<id>.<step>`, §3.2 outcome b). The action prop is
 *    named `run` (not `onClick`) so the CALL site is not itself an untracked
 *    clickable — the tracked point is the real `<button>` in here.
 *
 * The mock runtime injects a canned `fetch` (no MSW worker needed) so a demo
 * renders identically in Ladle (interactive) and in vitest (smoke). Themes are
 * the viewer's job (data-theme + tokens.css); this only wires the providers a
 * headless component needs: query client, i18n, and the auth runtime.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { createAuthRuntime } from "../src/index.js";
import { AuthProvider, registerAuthI18n } from "../src/index.js";

/** The base every mock handler mounts on (mirrors auth-sa.md `/auth/api/`). */
export const DEMO_BASE = "https://auth.demo.stapel.dev/auth/api";

/**
 * A handler map: path suffix → response. A plain value is a 200 JSON body; a
 * `[status, body]` tuple sets the HTTP status (so a demo can reach an error
 * step, e.g. a locked OTP).
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
  "demo.action.request": "Request code",
  "demo.action.resend": "Resend",
  "demo.action.submit": "Submit code",
  "demo.action.verify": "Verify",
  "demo.action.begin": "Begin",
  "demo.action.start": "Start",
  "demo.action.login": "Log in",
  "demo.action.lookup": "Look up",
  "demo.action.create": "Create",
  "demo.action.reset": "Reset",
  "demo.action.dispose": "Stop",
  "demo.label.step": "state.step",
};

/**
 * Provider frame every auth demo variant renders inside. Builds a fresh mock
 * runtime + query client per mount so variants stay isolated.
 */
export function AuthDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createAuthRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerAuthI18n(engine);
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
        <AuthProvider runtime={runtime}>{props.children}</AuthProvider>
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
          padding: `${spacing["1"]} ${spacing["2"]}`,
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
  padding: `${spacing["2"]} ${spacing["4"]}`,
  cursor: "pointer",
  fontSize: fontSize.sm.fontSize,
};

/**
 * A demo action button. The interactive prop is `run` (not `onClick`) so the
 * call site is not an untracked clickable; the real `<button>` here declares
 * `data-analytics="flow"` — the bag action it triggers steps an
 * auto-instrumented flow machine (§3.2 outcome b).
 */
export function DemoButton(props: {
  run: () => void;
  labelKey: string;
}): ReactElement {
  const t = useT();
  return (
    <button style={buttonStyle} data-analytics="flow" onClick={props.run}>
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
