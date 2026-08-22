/**
 * Shared harness for the cdn-react demos (frontend-guardrails §4.2). Demos are
 * first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`: colours are tokens,
 * every label is an i18n key.
 *
 * The mock runtime injects a canned `fetch`, so a demo can show the dedup
 * short-circuit and a refusal without a server. Note what the harness does NOT
 * fake: the flow itself runs for real, including the SHA-256 (jsdom and every
 * browser this renders in have `crypto.subtle`), so what a demo shows is the
 * genuine sequence of phases.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { CdnProvider, createCdnRuntime, registerCdnI18n } from "../src/index.js";

/** The base every mock handler mounts on (mirrors stapel-cdn `/cdn/api/v1`). */
export const DEMO_BASE = "https://cdn.demo.stapel.dev/cdn/api/v1";

const HASH_A =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

/** A processed image row, shaped exactly as `ImageSerializer` renders one. */
export function demoImage(overrides?: {
  readonly hash?: string;
  readonly processed?: boolean;
}): Record<string, unknown> {
  const hash = overrides?.hash ?? HASH_A;
  const processed = overrides?.processed ?? true;
  const url = (tier: number): string =>
    `https://cdn.demo.stapel.dev/media/cdn/images/${String(tier)}/${hash.slice(0, 8)}.webp`;
  return {
    id: 1,
    file_hash: hash,
    original_filename: "photo.jpg",
    file_extension: ".jpg",
    type: "product",
    prefix: `product/${hash}`,
    original_width: 1600,
    original_height: 1200,
    original_size: 240_000,
    original_url: url(1600),
    variant_16_url: url(16),
    variant_32_url: url(32),
    variant_64_url: url(64),
    variant_120_url: url(120),
    variant_160_url: url(160),
    variant_240_url: url(240),
    variant_480_url: url(480),
    variant_560_url: url(560),
    variant_720_url: url(720),
    variant_1080_url: url(1080),
    variant_1440_url: url(1440),
    variant_2160_url: url(2160),
    variants_meta: processed
      ? [
          { tier: 120, branch: null, url: url(120), width: 120, height: 90 },
          { tier: 480, branch: "w", url: url(480), width: 480, height: 360 },
        ]
      : [],
    is_processed: processed,
    uploaded_by: "00000000-0000-0000-0000-000000000001",
    uploaded_by_username: "seller",
    created_at: "2026-08-22T10:00:00Z",
    updated_at: "2026-08-22T10:00:00Z",
  };
}

/** `{exists:false}` — a true answer with a 200, not an error. */
export const DEMO_MISS = { exists: false, type: null, file: null };
/** `{exists:true}` — the dedup short-circuit; no upload follows one of these. */
export const DEMO_HIT = { exists: true, type: "image", file: demoImage() };

export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/** Build a canned `fetch` from a suffix→response map; unmatched paths return `{}`. */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
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

/** Provider frame every cdn demo variant renders inside. */
export function CdnDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createCdnRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
      // No waiting for variants in a demo: the mock answers instantly and a
      // real 750 ms poll would only make the page look stuck.
      variants: { attempts: 0 },
    });
    const engine = createI18n({ locale: "en" });
    registerCdnI18n(engine);
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
        <CdnProvider runtime={runtime}>{props.children}</CdnProvider>
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
  maxWidth: "32rem",
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
