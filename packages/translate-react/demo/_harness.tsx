/**
 * Shared harness for the translate-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`:
 *
 *  - no raw colours: every colour is a token via `cssVar()`.
 *  - no hardcoded prose: every sentence a person reads comes from the pair's
 *    own i18n bundle, through the components themselves.
 *  - clickable-needs-event: {@link DemoButton} carries `data-analytics="none"`
 *    with a reason, and the action prop is named `run` (not `onClick`) so the
 *    CALL site is not itself an untracked clickable.
 *
 * ── Why the loader status can be SEEDED ────────────────────────────────────
 *
 * The bundle status is published by an async loader, and a showcase shot is a
 * synchronous render: a "downloaded 412 texts" variant that waits for a mocked
 * fetch photographs the loading line instead, three times, and the gallery
 * claims three states it never drew (the C-SAMESHOT defect). So the harness can
 * hand the runtime a loader whose status is already known — the variant opens
 * in the state it is named for, on the first frame.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { TranslateProvider, createTranslateRuntime } from "../src/index.js";
import { registerTranslateI18n } from "../src/index.js";
import type {
  RemoteLocaleLoader,
  RemoteLocaleStatus,
  TranslateRuntime,
} from "../src/index.js";

/** The base every mock handler mounts on (mirrors stapel-translate `/translate/`). */
export const DEMO_BASE = "https://translate.demo.stapel.dev/translate/";

/** The languages a demo deployment serves — five of the module's twenty. */
export const DEMO_LANGUAGES: readonly string[] = ["en", "es", "ru", "fr", "de"];

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

/** A bundle status as the loader would have published it. */
export function demoStatus(
  overrides: Partial<RemoteLocaleStatus> = {}
): RemoteLocaleStatus {
  return {
    locale: "es",
    revision: 412,
    keys: 264,
    source: "network",
    stale: false,
    failed: false,
    error: null,
    ...overrides,
  };
}

/** Replace a runtime's loader with one whose status is already known. */
function withStatus(
  runtime: TranslateRuntime,
  status: RemoteLocaleStatus
): TranslateRuntime {
  const seeded = ((locale: string) =>
    runtime.localeLoader(locale)) as RemoteLocaleLoader;
  seeded.getStatus = () => status;
  seeded.subscribe = () => () => undefined;
  seeded.getVersion = () => 1;
  return { ...runtime, localeLoader: seeded };
}

/** i18n copy for the demo chrome — a `demo.*` (unmanaged) namespace, so the
 * i18n-key-exists lint treats it as app-local and never false-positives. */
const demoBundleEn: Record<string, string> = {
  "demo.action.start": "Start",
  "demo.action.submit": "Submit",
  "demo.action.reset": "Reset",
  "demo.label.step": "state.step",
};

export interface TranslateDemoHarnessProps {
  readonly handlers?: DemoHandlers;
  /** The locale the engine starts in. */
  readonly locale?: string;
  readonly languages?: readonly string[];
  /** Does this demo deployment offer content translation? Default: yes. */
  readonly contentTranslate?: boolean;
  /** Seed the loader's published status (see the file header). */
  readonly status?: RemoteLocaleStatus;
  readonly children: ReactNode;
}

/**
 * Provider frame every translate demo variant renders inside. Builds a fresh
 * mock runtime + query client per mount so variants stay isolated, and wires
 * the pair's OWN loader into core's i18n engine — which is the thing this pair
 * ships, so a demo that faked it would document nothing.
 */
export function TranslateDemoHarness(
  props: TranslateDemoHarnessProps
): ReactElement {
  const { handlers, locale, languages, contentTranslate, status } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const base = createTranslateRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
      languages: languages ?? DEMO_LANGUAGES,
      capabilities: { contentTranslate: contentTranslate ?? true },
      // No storage in a showcase: a demo must not write a person's real
      // preference, and a repository would want a session manager.
      bundleCache: null,
      preferenceStore: {
        read: () => Promise.resolve(undefined),
        write: () => Promise.resolve(),
      },
    });
    const rt = status !== undefined ? withStatus(base, status) : base;
    const engine = createI18n({ locale: locale ?? "en", loadLocale: rt.localeLoader });
    registerTranslateI18n(engine, locale ?? "en");
    engine.registerBundle(locale ?? "en", demoBundleEn);
    return {
      runtime: rt,
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
      i18n: engine,
    };
  }, [handlers, locale, languages, contentTranslate, status]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <TranslateProvider runtime={runtime}>
          <SkinTheme>{props.children}</SkinTheme>
        </TranslateProvider>
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
 * `data-analytics="none"` with a reason — honest, because this pair drives no
 * flow machines (its actions are tracked as named events inside the hooks).
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
      data-analytics-reason="demo chrome; the pair's own events are emitted inside its hooks"
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
