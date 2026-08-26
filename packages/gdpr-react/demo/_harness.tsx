/**
 * Shared harness for the gdpr-react demos (frontend-guardrails §4.2). Demos
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
 * headless component needs: query client, i18n, and the gdpr runtime.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { createGdprRuntime } from "../src/index.js";
import { GdprProvider, registerGdprI18n } from "../src/index.js";

/** The base every mock handler mounts on (mirrors stapel-gdpr `/gdpr/api/v1/`). */
export const DEMO_BASE = "https://gdpr.demo.stapel.dev/gdpr/api/v1/";

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
  "demo.captcha.title": "Confirm you are a person",
  "demo.captcha.checkbox": "I am not a robot",
  "demo.captcha.provider": "Protected by your captcha provider",
};

/**
 * Provider frame every gdpr demo variant renders inside. Builds a fresh mock
 * runtime + query client per mount so variants stay isolated.
 */
export function GdprDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createGdprRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerGdprI18n(engine);
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
        <GdprProvider runtime={runtime}>{props.children}</GdprProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

// ── shared demo UI (token-driven; no raw colours, no literal prose) ───────────

/**
 * Stand-in for the challenge widget a host renders into the public intake
 * page's `captcha` slot.
 *
 * It looks like a CAPTCHA, because this is a photograph of a public page that
 * a stranger reaches from a privacy policy: the slot used to render a dashed
 * dev outline captioned "your captcha widget renders here", which is a note to
 * the developer shipped as the product. A slot's stand-in has to render a
 * plausible default. It is inert — this package ships no captcha and cannot
 * know a deployment's provider — and the demo threads a fixed token to the
 * form, exactly as a real widget would.
 */
export function DemoCaptcha(): ReactElement {
  const t = useT();
  return (
    <div
      style={{
        border: `1px solid ${cssVar("border-subtle")}`,
        borderRadius: radii.md,
        background: cssVar("surface-raised"),
        padding: spacing["3"],
        display: "flex",
        flexDirection: "column",
        gap: spacing["2"],
        fontSize: fontSize.sm.fontSize,
        color: cssVar("text"),
      }}
    >
      <span style={{ color: cssVar("text-muted"), fontSize: fontSize.xs.fontSize }}>
        {t("demo.captcha.title")}
      </span>
      <label style={{ display: "flex", alignItems: "center", gap: spacing["2"] }}>
        <input type="checkbox" defaultChecked readOnly />
        {t("demo.captcha.checkbox")}
      </label>
      <span style={{ color: cssVar("text-muted"), fontSize: fontSize.xs.fontSize }}>
        {t("demo.captcha.provider")}
      </span>
    </div>
  );
}
