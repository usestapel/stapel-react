/**
 * Shared harness for the search-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * colours (tokens via `cssVar()`), no hardcoded prose (every label is a key),
 * and the one clickable declares why it tracks nothing.
 *
 * The URL adapter is an IN-MEMORY one, which is also the point: a demo shows
 * that the pair's state layer needs no router at all — `SearchParamsAdapter`
 * is two members, and react-router's binding (`./router`) is one of several
 * possible implementations rather than a dependency.
 */
import { useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { SkinTheme, useThemeMode } from "@stapel/tokens-antd/skin";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import {
  SearchProvider,
  SearchStateProvider,
  createSearchRuntime,
  parseSearchState,
  registerSearchI18n,
  searchQueryKeys,
  searchQueryParams,
} from "../src/index.js";
import type {
  RankingResponse,
  SearchParamsAdapter,
  SearchResponse,
  SuggestResponse,
} from "../src/index.js";
import type { StapelImage } from "@stapel/image";
import { DEMO_PHOTO_BY_REF, DEMO_TYPE } from "./fixtures.js";

/**
 * The seam a deployment fills in: a stored `<type>/<hash>` reference → a
 * renderable image.
 *
 * Wired here because it is the thing worth showing. The pair cannot resolve a
 * reference on its own — no contract in this fleet resolves a stranger's
 * (`model/runtime.ts` argues it) — so a demo that left the seam empty would
 * only ever photograph the "photo unavailable" arm, which is exactly what the
 * card did on every live SERP until this seam existed. One reference is left
 * deliberately unknown, so that arm still has a demo of its own.
 */
export function demoResolveImage(ref: string): StapelImage | undefined {
  const url = DEMO_PHOTO_BY_REF[ref];
  if (url === undefined) return undefined;
  return {
    source: "cdn",
    url,
    mime: "image/svg+xml",
    width: 400,
    height: 300,
    aspect: 4 / 3,
    square: false,
    preview_b64: null,
    variants: [],
  };
}

/** The base every mock handler mounts on (mirrors `/search/api/v1/`). */
export const DEMO_BASE = "https://search.demo.stapel.dev/search/api/v1/";

export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/**
 * What an UNMOCKED path answers.
 *
 * It used to be `{}` with a 200, and that is what turned five stories into
 * blank pages: an empty object is not a `SearchResponse`, so the first thing
 * that read `data.items` or `data.facet_meta` off it threw, and a throw
 * during render is a white screen with the reason only in the console. A
 * demo that forgot a handler now renders the pane's own "we could not run
 * this search" arm — a designed state, photographable, and true.
 */
const UNMOCKED: readonly [number, unknown] = [
  503,
  { code: "error.503.search_backend_unavailable", detail: "no demo handler", params: {} },
];

/** Build a canned `fetch` from a suffix→response map. */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let matched: DemoResponse = UNMOCKED;
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

/** `demo.*` is an UNMANAGED namespace, so `i18n-key-exists` treats these as
 * app-local and never false-positives on them. */
const demoBundleEn: Record<string, string> = {
  "demo.label.url": "URL",
  // The host slot on an empty result: the neighbouring sections a container
  // that owns the category tree can offer, which this package cannot build.
  "demo.exits.siblings": "Nearby in this section",
  "demo.exits.sibling_used": "Used cars · 128",
  "demo.exits.sibling_bikes": "Motorcycles · 41",
  "demo.action.reset": "Reset",
  "demo.feature.brand": "Brand",
  "demo.feature.condition": "Condition",
  "demo.feature.power": "Power",
  "demo.brand.bosch": "Bosch",
  "demo.brand.makita": "Makita",
  "demo.brand.interskol": "Interskol",
  "demo.condition.new": "New",
  "demo.condition.used": "Used",
  // The host's NAME for a point. It is `demo.*` and not a search key on
  // purpose: turning `lat`/`lon` into a place is a geocoder's job and the
  // container's, which is the whole argument `geoLabel` exists to make.
  "demo.geo.city": "Kazan",
  // The long one, for the case the row was measured breaking on: a place name
  // a geocoder really returns, on a 390px line that also has to hold a radius
  // and the word "Filters".
  "demo.geo.long": "Voskresenskiye Vorota Passage, Tverskoy, Moscow",
  // A vocabulary level, as the ANSWER names it: the group's heading plus a
  // caption per bucket. Keys rather than words because the wire says
  // `translatable: true` for this fixture, which is the arm a dictionary
  // facet takes on a real deployment.
  "demo.feature.vendor": "Make",
  "demo.make.toyota": "Toyota",
  "demo.make.bmw": "BMW",
  "demo.make.honda": "Honda",
  "demo.make.kia": "Kia",
  "demo.make.mazda": "Mazda",
  "demo.make.nissan": "Nissan",
  "demo.make.audi": "Audi",
  "demo.make.ford": "Ford",
  "demo.make.timberland": "Timberland",
  "demo.make.land_rover": "Land Rover",
  "demo.make.mercedes": "Mercedes-Benz",
  "demo.make.skoda": "Skoda",
  // The children of a partitioned category — one template split by a value
  // the child's own name expresses.
  "demo.partition.new": "New",
  "demo.partition.used": "Used",
  "demo.partition.parts": "Parts",
  "demo.partition.rent": "Rent",
  "search.scorer.relevance": "Text relevance",
  "search.scorer.geo": "Distance",
};

/**
 * What a variant is SEEDED with.
 *
 * A demo whose answer arrives from the mocked `fetch` renders its LOADING arm
 * on the first frame, so a static shot photographs a skeleton however the
 * variant is named — the C-SAMESHOT defect, and the reason
 * `assertVariantsRenderDistinctly` exists. Seeding writes the answer straight
 * into the query cache under the key the request would have used, so the
 * variant OPENS in the state it documents and the shot runner has something to
 * photograph. `handlers` stays for what only the wire can produce (a refusal,
 * a second page fetched by a click in the live viewer).
 */
export interface DemoSeed {
  /** The `GET /query` answer, keyed on the state {@link DemoSeed.search} parses to. */
  readonly page?: SearchResponse;
  /** The `GET /ranking` answer. `rankingType` must match the pane's `type` prop. */
  readonly ranking?: RankingResponse;
  readonly rankingType?: string;
  /** A `GET /suggest` answer for one prefix (the typeahead's cache). */
  readonly suggest?: SuggestResponse;
  readonly suggestPrefix?: string;
}

/**
 * The wire answers the seed too.
 *
 * Seeding the cache alone was half a mechanism: `useSearchQuery` sets no
 * `staleTime` (drill-down facets must not serve a stale page after a click),
 * so a seeded entry is stale the instant it is mounted and TanStack refetches
 * it in the background. The demo's `fetch` then answered whatever the handler
 * map said — nothing, for a variant that seeded instead of mocking — and the
 * page that was on screen was replaced by that. So a seed also mounts as a
 * handler: the cache and the wire tell the same story, and the refetch that
 * follows the first paint is a no-op instead of a demolition.
 */
function seedHandlers(seed: DemoSeed | undefined): DemoHandlers {
  if (seed === undefined) return {};
  return {
    ...(seed.page !== undefined ? { "/query": seed.page } : {}),
    ...(seed.ranking !== undefined ? { "/ranking": seed.ranking } : {}),
    ...(seed.suggest !== undefined ? { "/suggest": seed.suggest } : {}),
  };
}

/**
 * Write a seed into a fresh client. `search` is the query string the surface
 * is mounted with: the page key is derived from it through the pair's OWN
 * codec, so a demo cannot seed a key the component would not ask for.
 */
function seedQueryClient(client: QueryClient, seed: DemoSeed, search: string): void {
  if (seed.page !== undefined) {
    const { state } = parseSearchState(new URLSearchParams(search), {
      defaultType: DEMO_TYPE,
    });
    client.setQueryData(searchQueryKeys.query(searchQueryParams(state)), seed.page);
  }
  if (seed.ranking !== undefined) {
    client.setQueryData(searchQueryKeys.ranking(seed.rankingType), seed.ranking);
  }
  if (seed.suggest !== undefined) {
    client.setQueryData(
      searchQueryKeys.suggest(DEMO_TYPE, seed.suggestPrefix ?? ""),
      seed.suggest
    );
  }
}

/**
 * The narrow frame a phone variant is drawn in — 390px, the iPhone width the
 * visual pass shoots at, as a named constant rather than a bare number.
 */
export const PHONE_FRAME_WIDTH = 390;

/** A phone-width or full-width box around a surface. */
export function DemoFrame(props: {
  phone?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      data-demo-frame={props.phone === true ? "phone" : "desktop"}
      style={props.phone === true ? { maxWidth: PHONE_FRAME_WIDTH } : undefined}
    >
      {props.children}
    </div>
  );
}

/** An in-memory {@link SearchParamsAdapter} — no router, no history. */
export function useMemoryParams(initial = ""): SearchParamsAdapter & {
  readonly search: string;
} {
  const [search, setSearch] = useState(initial);
  return useMemo(
    () => ({
      search,
      params: new URLSearchParams(search),
      setParams: (next: URLSearchParams) => {
        setSearch(next.toString());
      },
    }),
    [search]
  );
}

/** Provider frame every search demo variant renders inside. */
export function SearchDemoHarness(props: {
  handlers?: DemoHandlers;
  seed?: DemoSeed;
  /** The query string the seed's page key is derived from. */
  seedSearch?: string;
  children: ReactNode;
}): ReactElement {
  const { handlers, seed, seedSearch } = props;
  const mode = useThemeMode();
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createSearchRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch({ ...seedHandlers(seed), ...(handlers ?? {}) }),
      resolveImage: demoResolveImage,
    });
    const engine = createI18n({ locale: "en" });
    registerSearchI18n(engine);
    engine.registerBundle("en", demoBundleEn);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    if (seed !== undefined) {
      seedQueryClient(client, seed, seedSearch ?? `type=${DEMO_TYPE}`);
    }
    return { runtime: rt, queryClient: client, i18n: engine };
  }, [handlers, seed, seedSearch]);
  // The mode is PINNED to what the document says right now, rather than left
  // to the nearest `SkinTheme` to resolve. A story is shot at `data-theme` =
  // light and dark, and a part that ships no wrapper of its own (the selects,
  // the card, the two notices) was drawing antd's light algorithm on a dark
  // page — light widgets, a second brand blue, 16 of 29 dark shots wrong.
  // The frame the product composes them in is the frame the story photographs.
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <SkinTheme surface="base" mode={mode} style={{ padding: spacing[4] }}>
          <SearchProvider runtime={runtime}>{props.children}</SearchProvider>
        </SkinTheme>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/**
 * The frame a `/default` SKIN demo renders inside: providers, the URL state,
 * and a phone-width box when the variant is the phone one.
 *
 * No demo chrome — no card, no URL line, no state badges. A skin demo is a
 * photograph of the PRODUCT, and everything the harness draws around it is
 * something a reviewer has to mentally subtract before answering "does this
 * screen work". The headless demos keep the chrome, because there the state
 * IS the subject.
 */
export function SearchSkinHarness(props: {
  handlers?: DemoHandlers;
  seed?: DemoSeed;
  /** The query string the surface opens on — and the seed's page key. */
  search?: string;
  phone?: boolean;
  children: ReactNode;
}): ReactElement {
  const search = props.search ?? `type=${DEMO_TYPE}`;
  const adapter = useMemoryParams(search);
  return (
    <SearchDemoHarness
      seedSearch={search}
      {...(props.handlers !== undefined ? { handlers: props.handlers } : {})}
      {...(props.seed !== undefined ? { seed: props.seed } : {})}
    >
      <SearchStateProvider adapter={adapter} defaultType={DEMO_TYPE}>
        <DemoFrame {...(props.phone === true ? { phone: true } : {})}>
          {props.children}
        </DemoFrame>
      </SearchStateProvider>
    </SearchDemoHarness>
  );
}

/** The frame plus the URL state, with the live query string on show — the
 * demo of "the URL is the state" is the URL being visible while you click. */
export function SearchStateDemoHarness(props: {
  handlers?: DemoHandlers;
  initialSearch?: string;
  children: ReactNode;
}): ReactElement {
  const adapter = useMemoryParams(props.initialSearch ?? `type=${DEMO_TYPE}`);
  return (
    <SearchDemoHarness {...(props.handlers ? { handlers: props.handlers } : {})}>
      <SearchStateProvider adapter={adapter} defaultType={DEMO_TYPE}>
        <div style={cardStyle} data-theme-surface>
          <UrlLine search={adapter.search} />
          {props.children}
        </div>
      </SearchStateProvider>
    </SearchDemoHarness>
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

function UrlLine(props: { search: string }): ReactElement {
  const t = useT();
  return (
    <div style={{ display: "flex", gap: spacing["2"], alignItems: "baseline" }}>
      <span style={{ color: cssVar("text-muted") }}>{t("demo.label.url")}</span>
      <code
        data-testid="demo-url"
        style={{
          background: cssVar("surface-sunken"),
          color: cssVar("brand"),
          borderRadius: radii.sm,
          padding: `${spacing["1"]}px ${spacing["2"]}px`,
          wordBreak: "break-all",
        }}
      >
        {`?${props.search}`}
      </code>
    </div>
  );
}

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
