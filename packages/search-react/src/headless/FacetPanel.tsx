import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad, useT } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { FeatureDef } from "@stapel/attributes-react";
import type { FacetMeta, SearchRange } from "../api/types.js";
import { useSearchQuery } from "../model/queries.js";
import { buildFacetGroups } from "../state/facets.js";
import type { FacetGroup } from "../state/facets.js";
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
  children: (bag: FacetPanelBag) => ReactNode;
}): ReactNode {
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
      state: searchState,
      ...(props.categoryFeatures !== undefined
        ? { categoryFeatures: props.categoryFeatures }
        : {}),
      t,
      ...(props.locale !== undefined ? { locale: props.locale } : {}),
    })
  );

  return props.children({
    state: groups,
    approximate: meta.approximate,
    skipped: meta.skipped,
    counted: meta.counted,
    candidates: meta.candidates,
    activeFilters,
    toggle: toggleFilter,
    setRange,
    clear: (slug) => {
      setFilter(slug, []);
    },
    clearAll,
  });
}
