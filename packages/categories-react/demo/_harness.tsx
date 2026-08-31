/**
 * Shared harness for the categories-react demos (frontend-guardrails §4.2).
 * Demos are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * colours and no hardcoded prose (every label is a key).
 *
 * It carries NO chrome of its own any more. It used to export a `DemoCard`
 * (a class name as a heading) and a `StepBadge` (a monospace status chip), and
 * every story in this package rendered those instead of the antd skin on disk
 * — which is how a pair shipped two screens the visual pass could not find a
 * single picture of. A demo's job is to render the PRODUCT; this file's job is
 * to supply the runtime, the translator and the seeded cache it needs.
 *
 * The catalogue store is an IN-MEMORY one, deliberately. A demo must not write
 * into the viewer's `localStorage` and then serve a stale catalogue to the
 * next demo — and passing `memoryCatalogStore()` is also the documented way a
 * host opts out of persistence, so the demo shows the seam while using it.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import {
  CategoriesProvider,
  buildCategoryTree,
  catalogKeyOptions,
  categoriesQueryKeys,
  createCategoriesRuntime,
  memoryCatalogStore,
  registerCategoriesI18n,
} from "../src/index.js";
import type { CatalogStore, Category, CategoryFeature } from "../src/index.js";

/** The base every mock handler mounts on (mirrors `/categories/api/v1/`). */
export const DEMO_BASE = "https://categories.demo.stapel.dev/categories/api/v1/";

export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/** Build a canned `fetch` from a path-SUFFIX → response map. Suffix, not
 * substring: `/categories/1/features/` contains `/categories/`, so a
 * substring router would answer a feature request with the category list. */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  const routes = Object.entries(handlers);
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const pathname = new URL(url).pathname;
    const found =
      routes.find(([suffix]) => pathname.endsWith(suffix)) ??
      routes.find(([suffix]) => url.includes(suffix));
    const matched: DemoResponse = found?.[1] ?? {};
    const [status, body] = statusAndBody(matched);
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
 * And this map is the pair's central claim, made visible: `demo.category.*`
 * are the CATEGORY NAMES arriving from the wire as translation keys. A host
 * supplies them; the library never could.
 */
const demoBundleEn: Record<string, string> = {
  "demo.category.electronics": "Electronics",
  "demo.category.phones": "Phones",
  "demo.category.laptops": "Laptops",
  "demo.category.used_phones": "Used phones",
  "demo.category.vehicles": "Vehicles",
  "demo.category.jobs": "Jobs",
  "demo.category.services": "Services",
  "demo.category.realty": "Property",
  "demo.category.home_and_garden": "Home and garden",
  "demo.category.hobby": "Hobbies and leisure",
  "demo.category.animals": "Animals",
  "demo.quick_search.heading": "Find a car",
  "demo.quick_search.make": "Make and model",
  "demo.quick_search.price": "Price",
  "demo.category.retired": "Retired (inactive)",
  "demo.category.gone": "Gone (deleted)",
  "demo.feature.brand": "Brand",
  "demo.feature.brand.comment": "As printed on the label, not the box",
  "demo.feature.power": "Power",
  "demo.feature.holo": "Holographic signature",
  "demo.brand.bosch": "Bosch",
  "demo.brand.makita": "Makita",
  "demo.unit.watt": "W",
  "demo.listings.title": "Listings in {category}",
  // Demo copy is photographed copy: an API note in a link label is the same
  // defect as an API note in product copy.
  "demo.link.plain": "Phones",
  "demo.link.router": "Phones",
};

/**
 * What a variant is SEEDED with.
 *
 * A demo whose data arrives from a mocked `fetch` renders its loading arm on
 * the first frame, so a static shot photographs a skeleton however the variant
 * is named — the C-SAMESHOT defect, and the reason
 * `assertVariantsRenderDistinctly` exists. Seeding writes the answer straight
 * into the query cache, so the variant OPENS in the state it documents and the
 * shot runner has something to photograph. `handlers` stays for the arms that
 * can only be reached from the wire (a refusal, a slow load).
 */
export interface DemoSeed {
  /** Rows the catalogue tree is built from (`GET /categories/`). */
  readonly rows?: readonly Category[];
  /** Tiles the carousel shows (`GET /categories/carousel/`). */
  readonly carousel?: readonly Category[];
  /** A category's resolved feature schema, by category id. */
  readonly features?: Readonly<Record<number, readonly CategoryFeature[]>>;
  /** The sync walk hit its page budget — the tree on screen is PARTIAL. */
  readonly truncated?: boolean;
}

function seedQueryClient(client: QueryClient, seed: DemoSeed): void {
  if (seed.rows !== undefined) {
    client.setQueryData(categoriesQueryKeys.catalog(catalogKeyOptions()), {
      index: buildCategoryTree(seed.rows),
      snapshot: { version: 1 as const, cursor: 100, rows: [...seed.rows] },
      truncated: seed.truncated === true,
      wasFullSync: true,
    });
  }
  if (seed.carousel !== undefined) {
    client.setQueryData(categoriesQueryKeys.carousel, [...seed.carousel]);
  }
  for (const [id, features] of Object.entries(seed.features ?? {})) {
    client.setQueryData(categoriesQueryKeys.features(Number(id)), [...features]);
  }
}

/** Provider frame every categories demo variant renders inside. */
export function CategoriesDemoHarness(props: {
  handlers?: DemoHandlers;
  seed?: DemoSeed;
  children: ReactNode;
}): ReactElement {
  const { handlers, seed } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createCategoriesRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerCategoriesI18n(engine);
    engine.registerBundle("en", demoBundleEn);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    if (seed !== undefined) seedQueryClient(client, seed);
    return { runtime: rt, queryClient: client, i18n: engine };
  }, [handlers, seed]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <CategoriesProvider runtime={runtime}>{props.children}</CategoriesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** One in-memory store per demo render — see this file's header. */
export function useDemoStore(): CatalogStore {
  return useMemo(() => memoryCatalogStore(), []);
}
