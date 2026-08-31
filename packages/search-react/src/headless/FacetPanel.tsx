import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad, useT } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { FeatureDef } from "@stapel/attributes-react";
import type { FacetMeta, SearchRange } from "../api/types.js";
import { useSearchQuery } from "../model/queries.js";
import { buildFacetGroups } from "../state/facets.js";
import type { FacetGroup } from "../state/facets.js";
import { useHostFacetLabels } from "./useFacetLabels.js";
import type { FacetLabelResolver } from "./useFacetLabels.js";
import { useSearchState } from "./SearchStateProvider.js";

/** The bag `<FacetPanel>` hands its render prop. */
export interface FacetPanelBag {
  /**
   * The facet groups as a state a skin cannot flatten. `empty` means the
   * search genuinely has no facets to offer (facets off, or no plan for the
   * category) — it is NOT what a failed query looks like.
   */
  readonly state: LoadState<readonly FacetGroup[]>;
  /**
   * `true` when the counts came from a SAMPLE because the candidate set
   * exceeded the backend's cap. The panel must say so — the spec makes this
   * a first-day requirement, not a banner added after somebody notices the
   * numbers moving (§12 risk 3).
   */
  readonly approximate: boolean;
  /**
   * Plan slugs the server dropped at `MAX_FACET_FIELDS`. Reported, not
   * vanished — the backend's own words. A skin names them; it never renders
   * a zero in their place.
   */
  readonly skipped: readonly string[];
  /** Slugs that WERE counted. */
  readonly counted: readonly string[];
  /**
   * Range slugs the server declared as CORE document columns
   * (`facet_meta.core_ranges`, stapel-search 0.4.0+) — `price` on a
   * classified board. They are not part of the category plan and are not
   * counted; they are axes the panel may offer unconditionally, and they
   * come from the answer so that a panel never draws a control over a
   * filter the deployed server would answer zero for.
   */
  readonly coreRanges: readonly string[];
  /**
   * ISO 4217 code of the corpus, read off the first card of the answer, so
   * a money range reads as money without the host wiring anything. The
   * cards already carry it — `SearchResultCard` formats prices from the
   * same field.
   */
  readonly currency: string | undefined;
  /** Size of the largest counted set — the number `approximate` is about. */
  readonly candidates: number;
  /** Facet values + ranges + geo currently applied. */
  readonly activeFilters: number;

  toggle(slug: string, value: string): void;
  setRange(slug: string, range: SearchRange | null): void;
  clear(slug: string): void;
  clearAll(): void;
}

const EMPTY_META: FacetMeta = {
  approximate: false,
  candidates: 0,
  counted: [],
  skipped: [],
  core_ranges: [],
};

/**
 * Headless facet panel over the CURRENT search.
 *
 * It runs the same query as `<SearchResults>` — same state, same key, so
 * TanStack serves both from one request. That is deliberate: facets and rows
 * come from one envelope server-side (one query per page is the contract's
 * stated design), and fetching them separately would put two answers about
 * one search on the screen at once.
 *
 * `categoryFeatures` is the second slot-seam of the pair (spec §6.2 item 2).
 * The server sends `{value: count}` and no labels, because the labels are
 * translation keys in the category's own schema. Hand them in and the options
 * read as words; leave them out and they read as raw index terms — never as
 * blanks.
 */
export function FacetPanel(props: {
  /** From `categories-react`'s `GET /categories/{id}/features/`. */
  categoryFeatures?: readonly FeatureDef[];
  /** BCP-47 tag for `date`-typed option labels. Defaults to the runtime's. */
  locale?: string;
  enabled?: boolean;
  /** The host's vocabulary lookup — see {@link FacetLabelResolver}. */
  resolveFacetLabels?: FacetLabelResolver;
  children: (bag: FacetPanelBag) => ReactNode;
}): ReactNode {
  return props.children(
    useFacetPanel({
      ...(props.categoryFeatures !== undefined
        ? { categoryFeatures: props.categoryFeatures }
        : {}),
      ...(props.locale !== undefined ? { locale: props.locale } : {}),
      ...(props.enabled !== undefined ? { enabled: props.enabled } : {}),
      ...(props.resolveFacetLabels !== undefined
        ? { resolveFacetLabels: props.resolveFacetLabels }
        : {}),
    })
  );
}

/**
 * The same bag, as a hook — for a caller that has to know what the panel WILL
 * render before it renders it.
 *
 * The one real caller is `<SearchPage>`: a facet column is a quarter of a
 * catalogue page, and on a deployment whose plan has no facets at all it was
 * a quarter of every results page spent on an empty-state illustration
 * repeating "no filters for this search". Whether to lay out that column is a
 * LAYOUT decision, and layout is decided by the component that owns the grid
 * — which therefore has to be able to ask. A render prop cannot answer a
 * question asked one level up.
 */
export function useFacetPanel(props: {
  categoryFeatures?: readonly FeatureDef[];
  locale?: string;
  enabled?: boolean;
  /**
   * The host's lookup for values neither the answer nor the schema names —
   * see {@link FacetLabelResolver}. Threaded here rather than into each skin
   * so the chip row and the filter panel, which both call this hook, cannot
   * end up printing two different words for one value.
   */
  resolveFacetLabels?: FacetLabelResolver;
} = {}): FacetPanelBag {
  const { state: searchState, setFilter, setRange, clearAll, toggleFilter, activeFilters } =
    useSearchState();
  const t = useT();
  const query = useSearchQuery(
    searchState,
    props.enabled !== undefined ? { enabled: props.enabled } : undefined
  );

  const envelope = loadStateFromQuery(query);
  const meta = envelope.status === "ready" ? envelope.data.facet_meta : EMPTY_META;

  const groups = mapLoad(envelope, (data) =>
    buildFacetGroups({
      facets: data.facets,
      meta: data.facet_meta,
      facetLabels: data.facet_labels,
      state: searchState,
      ...(props.categoryFeatures !== undefined
        ? { categoryFeatures: props.categoryFeatures }
        : {}),
      t,
      ...(props.locale !== undefined ? { locale: props.locale } : {}),
    })
  );

  // The host seam runs AFTER `buildFacetGroups`, on what it could not name:
  // the precedence is server captions, then the schema's own option table,
  // then this. See `useFacetLabels.ts`.
  const labelled = useHostFacetLabels(groups, props.resolveFacetLabels, props.locale);

  return {
    state: labelled,
    approximate: meta.approximate,
    skipped: meta.skipped,
    counted: meta.counted,
    coreRanges: meta.core_ranges ?? [],
    currency:
      envelope.status === "ready"
        ? envelope.data.items.find((item) => typeof item.card?.["currency"] === "string")
            ?.card?.["currency"] as string | undefined
        : undefined,
    candidates: meta.candidates,
    activeFilters,
    toggle: toggleFilter,
    setRange,
    clear: (slug) => {
      setFilter(slug, []);
    },
    clearAll,
  };
}
