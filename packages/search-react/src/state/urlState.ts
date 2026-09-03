/**
 * THE URL IS THE STATE.
 *
 * Every parameter of a search — text, category, facet filters, ranges, geo,
 * sort, page size and the keyset cursor — lives in the query string, and no
 * component keeps a second copy. The acceptance test the spec sets (§4.2) is
 * behavioural, not structural: copy the address into another tab and get the
 * same results; press Back and lose exactly the last filter; reload and lose
 * nothing. All three follow from there being one source.
 *
 * The parameter NAMES here are the backend's own (`type`, `q`, `f.<slug>`,
 * `r.<slug>`, `lat`/`lon`/`radius_km`, `bbox`, `sort`, `facets`, `anchor`,
 * `direction`, `limit`). That is deliberate: a browser URL is then the API
 * query string, so a support ticket that pastes a link is a request anyone can
 * replay with curl, and there is no translation table to drift.
 *
 * This module is PURE — no React, no router, no fetch. The React binding is
 * `headless/SearchStateProvider`; the react-router binding is the `./router`
 * subpath. Keeping the codec here is what makes the round trip testable in
 * both directions without a DOM.
 */
import type {
  FacetSelection,
  SearchGeo,
  SearchQueryState,
  SearchRange,
} from "../api/types.js";

/** Wire parameter names, in one place so a rename is one edit. */
export const SEARCH_PARAM = {
  type: "type",
  q: "q",
  lang: "lang",
  category: "category",
  owner: "owner",
  sort: "sort",
  facets: "facets",
  anchor: "anchor",
  direction: "direction",
  limit: "limit",
  lat: "lat",
  lon: "lon",
  radiusKm: "radius_km",
  bbox: "bbox",
} as const;

/** Prefix of a facet filter parameter (`f.brand=bosch`). */
export const FILTER_PREFIX = "f.";
/** Prefix of a range filter parameter (`r.price=100..500`). */
export const RANGE_PREFIX = "r.";

/**
 * Something in the URL this codec could not make sense of.
 *
 * Reported rather than silently dropped, for the same reason a facet's
 * `skipped` list is reported: a link whose location filter lost half of
 * itself should say so, not quietly widen the search and let the person
 * believe they are looking at what they shared. Each issue carries an i18n
 * key so a skin can render a sentence.
 */
export interface SearchStateIssue {
  /** The offending parameter name, as it appeared in the URL. */
  readonly param: string;
  readonly code: SearchStateIssueCode;
  /** i18n key for the sentence (`search.url.issue.*`). */
  readonly messageKey: string;
}

export type SearchStateIssueCode =
  /** A numeric parameter was not a number. */
  | "not_a_number"
  /** `lat` without `lon`, or the other way round. */
  | "geo_incomplete"
  /** `bbox` was not four numbers. */
  | "bbox_malformed"
  /** `r.<slug>` was not `from..to`. */
  | "range_malformed";

const ISSUE_KEY: Readonly<Record<SearchStateIssueCode, string>> = {
  not_a_number: "search.url.issue.not_a_number",
  geo_incomplete: "search.url.issue.geo_incomplete",
  bbox_malformed: "search.url.issue.bbox_malformed",
  range_malformed: "search.url.issue.range_malformed",
};

/** What {@link parseSearchState} answers: the state, plus what it could not read. */
export interface ParsedSearchState {
  readonly state: SearchQueryState;
  readonly issues: readonly SearchStateIssue[];
}

export interface ParseSearchStateOptions {
  /**
   * The doc type to search when the URL carries none. Required in practice —
   * `type` is the endpoint's only mandatory parameter — and supplied by the
   * host, because which types exist is a deployment fact
   * (`stapel-search`'s registry), not something this package can know.
   */
  readonly defaultType: string;
  /** Applied when the URL carries no `q`. Defaults to `""`. */
  readonly defaultQ?: string;
  /** Applied when the URL carries no `sort`; omitted lets the server choose. */
  readonly defaultSort?: string;
  /** Applied when the URL carries no `limit`. */
  readonly defaultLimit?: number;
  /** Applied when the URL carries no `category` (e.g. a category page). */
  readonly defaultCategory?: string;
  /** Applied when the URL carries no `lang`. */
  readonly defaultLang?: string;
}

function num(
  raw: string,
  param: string,
  issues: SearchStateIssue[]
): number | undefined {
  const value = Number(raw);
  if (raw.trim().length === 0 || !Number.isFinite(value)) {
    issues.push({ param, code: "not_a_number", messageKey: ISSUE_KEY.not_a_number });
    return undefined;
  }
  return value;
}

function parseGeo(
  params: URLSearchParams,
  issues: SearchStateIssue[]
): SearchGeo | undefined {
  const bbox = params.get(SEARCH_PARAM.bbox);
  if (bbox !== null) {
    const parts = bbox.split(",");
    if (parts.length !== 4) {
      issues.push({
        param: SEARCH_PARAM.bbox,
        code: "bbox_malformed",
        messageKey: ISSUE_KEY.bbox_malformed,
      });
      return undefined;
    }
    const values = parts.map((p) => Number(p));
    if (values.some((v) => !Number.isFinite(v))) {
      issues.push({
        param: SEARCH_PARAM.bbox,
        code: "bbox_malformed",
        messageKey: ISSUE_KEY.bbox_malformed,
      });
      return undefined;
    }
    // `minLon > maxLon` is LEGAL — it means the box crosses the antimeridian
    // (`stapel-search/query.py`). Normalizing it here would silently turn a
    // Pacific search into the rest of the world.
    return {
      kind: "bbox",
      minLat: values[0] as number,
      minLon: values[1] as number,
      maxLat: values[2] as number,
      maxLon: values[3] as number,
    };
  }

  const rawLat = params.get(SEARCH_PARAM.lat);
  const rawLon = params.get(SEARCH_PARAM.lon);
  if (rawLat === null && rawLon === null) return undefined;
  if (rawLat === null || rawLon === null) {
    issues.push({
      param: rawLat === null ? SEARCH_PARAM.lat : SEARCH_PARAM.lon,
      code: "geo_incomplete",
      messageKey: ISSUE_KEY.geo_incomplete,
    });
    return undefined;
  }
  const lat = num(rawLat, SEARCH_PARAM.lat, issues);
  const lon = num(rawLon, SEARCH_PARAM.lon, issues);
  if (lat === undefined || lon === undefined) return undefined;

  const rawRadius = params.get(SEARCH_PARAM.radiusKm);
  const radiusKm =
    rawRadius === null ? undefined : num(rawRadius, SEARCH_PARAM.radiusKm, issues);
  return {
    kind: "center",
    lat,
    lon,
    ...(radiusKm !== undefined ? { radiusKm } : {}),
  };
}

function parseFacetSelection(raw: string | null): FacetSelection | undefined {
  if (raw === null) return undefined;
  const lowered = raw.trim().toLowerCase();
  if (lowered === "on" || lowered === "off") return lowered;
  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return slugs.length > 0 ? slugs : undefined;
}

/** URL → state. Never throws; anything unreadable lands in `issues`. */
export function parseSearchState(
  params: URLSearchParams,
  options: ParseSearchStateOptions
): ParsedSearchState {
  const issues: SearchStateIssue[] = [];

  const filters: Record<string, readonly string[]> = {};
  const ranges: Record<string, SearchRange> = {};

  for (const key of new Set(params.keys())) {
    if (key.startsWith(FILTER_PREFIX) && key.length > FILTER_PREFIX.length) {
      // `getAll` is the whole point: a repeated key is OR within the slug.
      const values = params.getAll(key).filter((v) => v.length > 0);
      if (values.length > 0) filters[key.slice(FILTER_PREFIX.length)] = values;
      continue;
    }
    if (key.startsWith(RANGE_PREFIX) && key.length > RANGE_PREFIX.length) {
      const raw = params.get(key) ?? "";
      const separator = raw.indexOf("..");
      if (separator < 0) {
        issues.push({
          param: key,
          code: "range_malformed",
          messageKey: ISSUE_KEY.range_malformed,
        });
        continue;
      }
      const from = raw.slice(0, separator);
      const to = raw.slice(separator + 2);
      if (from.length === 0 && to.length === 0) continue;
      ranges[key.slice(RANGE_PREFIX.length)] = {
        ...(from.length > 0 ? { from } : {}),
        ...(to.length > 0 ? { to } : {}),
      };
    }
  }

  const rawLimit = params.get(SEARCH_PARAM.limit);
  const limit =
    rawLimit === null
      ? options.defaultLimit
      : num(rawLimit, SEARCH_PARAM.limit, issues);

  const rawDirection = params.get(SEARCH_PARAM.direction);
  // The server coerces anything unrecognised to "next" without complaining
  // (`query.py`), so the codec mirrors that instead of inventing a refusal
  // the backend does not have.
  const direction: "next" | "prev" | undefined =
    rawDirection === null ? undefined : rawDirection === "prev" ? "prev" : "next";

  const state: SearchQueryState = {
    type: params.get(SEARCH_PARAM.type) ?? options.defaultType,
    q: params.get(SEARCH_PARAM.q) ?? options.defaultQ ?? "",
    filters,
    ranges,
    ...optional(SEARCH_PARAM.lang, params.get(SEARCH_PARAM.lang) ?? options.defaultLang),
    ...optional(
      SEARCH_PARAM.category,
      params.get(SEARCH_PARAM.category) ?? options.defaultCategory
    ),
    ...optional(SEARCH_PARAM.owner, params.get(SEARCH_PARAM.owner) ?? undefined),
    ...optional("geo", parseGeo(params, issues)),
    ...optional(
      SEARCH_PARAM.sort,
      params.get(SEARCH_PARAM.sort) ?? options.defaultSort
    ),
    ...optional("facets", parseFacetSelection(params.get(SEARCH_PARAM.facets))),
    ...optional(SEARCH_PARAM.anchor, params.get(SEARCH_PARAM.anchor) ?? undefined),
    ...optional("direction", direction),
    ...optional("limit", limit),
  };

  return { state, issues };
}

/** `exactOptionalPropertyTypes` makes `{k: undefined}` and "absent" different
 * types; this spreads to nothing when the value is absent. */
function optional<K extends string, V>(
  key: K,
  value: V | undefined
): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

/**
 * State → URL.
 *
 * `base` is the CURRENT query string: every parameter this codec does not own
 * is copied through untouched, so a host's own `?ref=`/`utm_*` survives a
 * facet click. Every parameter it DOES own is rewritten from the state, so a
 * removed filter actually leaves the URL instead of lingering as a stale key.
 */
export function writeSearchState(
  state: SearchQueryState,
  base?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams();

  if (base !== undefined) {
    for (const key of new Set(base.keys())) {
      if (ownsParam(key)) continue;
      for (const value of base.getAll(key)) next.append(key, value);
    }
  }

  next.set(SEARCH_PARAM.type, state.type);
  if (state.q.length > 0) next.set(SEARCH_PARAM.q, state.q);
  if (state.lang !== undefined) next.set(SEARCH_PARAM.lang, state.lang);
  if (state.category !== undefined) next.set(SEARCH_PARAM.category, state.category);
  if (state.owner !== undefined) next.set(SEARCH_PARAM.owner, state.owner);

  for (const slug of Object.keys(state.filters).sort()) {
    for (const value of state.filters[slug] ?? []) {
      next.append(`${FILTER_PREFIX}${slug}`, value);
    }
  }
  for (const slug of Object.keys(state.ranges).sort()) {
    const range = state.ranges[slug];
    if (range === undefined) continue;
    if (range.from === undefined && range.to === undefined) continue;
    next.set(`${RANGE_PREFIX}${slug}`, `${range.from ?? ""}..${range.to ?? ""}`);
  }

  if (state.geo !== undefined) {
    if (state.geo.kind === "bbox") {
      const { minLat, minLon, maxLat, maxLon } = state.geo;
      next.set(SEARCH_PARAM.bbox, `${minLat},${minLon},${maxLat},${maxLon}`);
    } else {
      next.set(SEARCH_PARAM.lat, String(state.geo.lat));
      next.set(SEARCH_PARAM.lon, String(state.geo.lon));
      if (state.geo.radiusKm !== undefined) {
        next.set(SEARCH_PARAM.radiusKm, String(state.geo.radiusKm));
      }
    }
  }

  if (state.sort !== undefined) next.set(SEARCH_PARAM.sort, state.sort);
  if (state.facets !== undefined) {
    next.set(
      SEARCH_PARAM.facets,
      Array.isArray(state.facets) ? state.facets.join(",") : (state.facets as string)
    );
  }
  if (state.anchor !== undefined) next.set(SEARCH_PARAM.anchor, state.anchor);
  if (state.direction !== undefined) next.set(SEARCH_PARAM.direction, state.direction);
  if (state.limit !== undefined) next.set(SEARCH_PARAM.limit, String(state.limit));

  return next;
}

/** Is this URL parameter owned by the search codec? */
export function ownsParam(key: string): boolean {
  if (key.startsWith(FILTER_PREFIX) || key.startsWith(RANGE_PREFIX)) return true;
  return (Object.values(SEARCH_PARAM) as readonly string[]).includes(key);
}

/** A patch over {@link SearchQueryState}; `null` clears an optional member. */
export type SearchStatePatch = {
  readonly [K in keyof SearchQueryState]?: SearchQueryState[K] | null;
};

/**
 * Apply a patch, and — unless the patch itself moves the page — DROP the
 * keyset cursor.
 *
 * This is the single most load-bearing line in the module. `anchor` encodes a
 * position inside ONE ordered candidate set (`{v, k, o}` over the active sort);
 * carry it across a filter or sort change and the server either refuses it or,
 * worse, honours it against a different set and answers page 4 of something
 * the person never asked for. Every mutator in the provider goes through here,
 * so "changing a filter returns you to the first page" is a property of the
 * state machine rather than a rule each call site must remember.
 */
export function patchSearchState(
  state: SearchQueryState,
  patch: SearchStatePatch
): SearchQueryState {
  const movesPage = "anchor" in patch || "direction" in patch;
  const merged: Record<string, unknown> = { ...state, ...patch };
  if (!movesPage) {
    merged["anchor"] = undefined;
    merged["direction"] = undefined;
  }
  // `type` and `q` are never absent: `q` has the empty string for "no text",
  // and a state without `type` could not be requested at all.
  if (typeof merged["q"] !== "string") merged["q"] = "";
  if (typeof merged["type"] !== "string") merged["type"] = state.type;

  // `null` in a patch CLEARS a member, and `exactOptionalPropertyTypes` makes
  // "absent" and "present but undefined" different types — so the cleared
  // members are filtered out rather than left as `undefined` holes.
  return Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== null && value !== undefined)
  ) as unknown as SearchQueryState;
}

/** Toggle one value of one facet slug, OR-style. Returns a new state with the
 * cursor dropped (see {@link patchSearchState}). */
export function toggleFilterValue(
  state: SearchQueryState,
  slug: string,
  value: string
): SearchQueryState {
  const current = state.filters[slug] ?? [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return setFilterValues(state, slug, next);
}

/** Replace one slug's chosen values; an empty list removes the filter. */
export function setFilterValues(
  state: SearchQueryState,
  slug: string,
  values: readonly string[]
): SearchQueryState {
  const filters: Record<string, readonly string[]> = Object.fromEntries(
    Object.entries(state.filters).filter(([key]) => key !== slug)
  );
  if (values.length > 0) filters[slug] = values;
  return patchSearchState(state, { filters });
}

/** Set or clear one `r.<slug>` range. */
export function setRangeValue(
  state: SearchQueryState,
  slug: string,
  range: SearchRange | null
): SearchQueryState {
  const ranges: Record<string, SearchRange> = Object.fromEntries(
    Object.entries(state.ranges).filter(([key]) => key !== slug)
  );
  if (range !== null && (range.from !== undefined || range.to !== undefined)) {
    ranges[slug] = range;
  }
  return patchSearchState(state, { ranges });
}

/**
 * Drop every filter, range and geo constraint, keeping what identifies the
 * search itself: the doc type, the text, the language, the category the
 * person navigated into, and the page size.
 *
 * Category is KEPT on purpose: on `/c/:slug` it is the page, not a filter, and
 * a "clear filters" button that teleported the visitor to the root catalogue
 * would be removing something they never set.
 */
export function clearFilters(state: SearchQueryState): SearchQueryState {
  // The PLACE survives. It is not a filter (see `activeFilterCount`), it is
  // not counted by the control that calls this, and a person who chose their
  // city and then narrowed by price did not ask to be moved back to the whole
  // country when they widen the price again. The location control has its own
  // way off, and it says the name of the place it would remove.
  return patchSearchState(state, { filters: {}, ranges: {} });
}

/**
 * How many constraints the person has actually applied — facet values and
 * ranges, and NOTHING ELSE. What a "clear all (N)" control counts.
 *
 * ## A latitude is not a filter
 *
 * `lat`/`lon` used to add 1 to this, and a place chosen on a map is a real
 * narrowing, so that looked right. What a person saw was not. On a live board
 * a landing announced "clear all filters (2)" over an empty page, with two
 * filters that had no chip, no name and no row in the panel — the owner's
 * words were "two active filters I can't even look at". A count that names
 * nothing is worse than no count: it tells a person that something is hiding
 * their results and gives them nothing to press.
 *
 * A coordinate pair is not a filter a person picked, it is the machine form
 * of a place. The place is stated by the location control, in words, beside
 * the radius it comes with — its own thing in the chrome, like the search box,
 * not a row in the filter list and not a number in this sum. So this counts
 * facets and ranges, and the location says its own name.
 */
export function activeFilterCount(state: SearchQueryState): number {
  let count = 0;
  for (const values of Object.values(state.filters)) count += values.length;
  count += Object.keys(state.ranges).length;
  return count;
}
