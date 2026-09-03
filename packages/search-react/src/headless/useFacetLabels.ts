/**
 * The HOST LABEL SEAM — the third source of a facet option's caption, and the
 * only one that can reach a vocabulary.
 *
 * ── The defect ────────────────────────────────────────────────────────────
 *
 * A live classified deployment's category schema types `vendor`, `model`,
 * `memory_size` and `color_ref_select` as `ref_select`: their config carries
 * no `options` table at all, only a POINTER —
 * `{"optionsRef": {"level": "Vendor", "vocabulary": "phone-catalog"}}`.
 * The words live in the vocabulary the pointer names, which is a different
 * service with a different client. So the two label sources this pair already
 * has both come up empty: the answer's `facet_labels` because the deployed
 * server predates stapel-search 0.4.0 and sends no such key, and the schema
 * because a pointer is not a table. The chips printed `apple`, `128-gb`,
 * `chernyy` — storage slugs, at buyers.
 *
 * This pair must not grow a vocabulary client to fix that: it would tie every
 * storefront's search to a service it may not run, and the host ALREADY has
 * that client (`@stapel/attributes-react`'s `VocabularyClientProvider` is
 * mounted for the composer). So the fetch is the host's and the discipline is
 * this module's — the same division as `renderGeoFilter` and
 * `renderCategoryFilter`, one seam lower because what crosses it is data
 * rather than a control.
 *
 * ── Precedence, stated once ───────────────────────────────────────────────
 *
 *   1. the answer's `facet_labels`  — the server saw the write-time snapshot;
 *   2. the feature def's inline `options` table — for the plain `select`
 *      family, which carries its words with it;
 *   3. this resolver;
 *   4. the raw value.
 *
 * `buildFacetGroups` has already applied 1 and 2 by the time this hook runs,
 * and it marks an option it could not name `labelSource: "none"` — which is
 * what makes "did anyone name this?" answerable without a second lookup. Only
 * those values are asked about, so the host is never called for a value the
 * server or the schema already captioned, and a resolver that returns nothing
 * for a value leaves the raw value on screen. A chip that silently dropped an
 * option would be worse than one showing a slug: the option is real, it has a
 * count, and it is the only way to reach those documents.
 *
 * ── The fetch discipline ──────────────────────────────────────────────────
 *
 * TanStack Query, exactly like the pair's other three reads, and for the four
 * reasons that made it right there:
 *
 *  - **batched per group.** One call per facet slug carrying every unresolved
 *    value of it, not one call per chip.
 *  - **cached.** `staleTime: Infinity` — a vocabulary term's caption changes
 *    when somebody edits the catalogue, not between two clicks on a filter.
 *  - **deduplicated.** The chip row, the filter panel and the page's layout
 *    probe each call `useFacetPanel`, so three components ask for the same
 *    group's captions in one render pass; one query key means one request.
 *  - **aborted on supersession.** The `signal` is the query's own, so a
 *    resolver that honours it stops a request whose answer nobody will read.
 */
import { useQueries } from "@tanstack/react-query";
import { mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { FeatureDef } from "@stapel/attributes-react";
import { searchQueryKeys } from "../model/queryKeys.js";
import type { FacetGroup } from "../state/facets.js";

/** What the host is asked to name. */
export interface FacetLabelRequest {
  /** The facet slug — `vendor`, `color_ref_select`. */
  readonly slug: string;
  /**
   * The category's own def for the slug, when the host supplied a schema.
   * It carries the `optionsRef` pointer (vocabulary + level) a resolver needs
   * to know WHICH vocabulary these codes belong to, so a host does not have to
   * keep a second copy of the schema to answer.
   */
  readonly feature: FeatureDef | undefined;
  /**
   * The values nobody has named yet, sorted. Only the unresolved ones: a
   * resolver is never asked about a value the server or the schema captioned.
   */
  readonly values: readonly string[];
}

/**
 * A host's answer: `{value: caption}`.
 *
 * Partial answers are the expected case, not an error — a code the vocabulary
 * no longer holds simply is not in the map, and its chip keeps printing the
 * raw value. Returning `{}` is a legitimate "I cannot name any of these".
 */
export type FacetLabelResolver = (
  request: FacetLabelRequest,
  options: { readonly signal: AbortSignal }
) => Promise<Readonly<Record<string, string>>>;

/** One frozen empty list, so a render with no unresolved values is stable. */
const NO_REQUESTS: readonly FacetLabelRequest[] = [];

/** The values of one group nobody has named — see the precedence note above. */
function unresolvedValues(group: FacetGroup): readonly string[] {
  return group.options
    .filter((option) => option.labelSource === "none")
    .map((option) => option.value)
    .sort((a, b) => a.localeCompare(b));
}

function isCaptionMap(value: unknown): value is Readonly<Record<string, string>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fill in what the server and the schema could not name, through the host.
 *
 * Returns the groups UNCHANGED — same object identity — when there is no
 * resolver or nothing came back, so a page with the seam unwired pays neither
 * a request nor a re-render.
 */
export function useHostFacetLabels(
  groups: LoadState<readonly FacetGroup[]>,
  resolve: FacetLabelResolver | undefined,
  locale: string | undefined
): LoadState<readonly FacetGroup[]> {
  const requests: readonly FacetLabelRequest[] =
    resolve === undefined || groups.status !== "ready"
      ? NO_REQUESTS
      : groups.data
          .map((group) => ({
            slug: group.slug,
            feature: group.feature,
            values: unresolvedValues(group),
          }))
          .filter((request) => request.values.length > 0);

  const answers = useQueries({
    queries: requests.map((request) => ({
      queryKey: searchQueryKeys.facetLabels(request.slug, request.values, locale),
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<unknown> =>
        resolve === undefined ? {} : await resolve(request, { signal }),
      staleTime: Number.POSITIVE_INFINITY,
      // A vocabulary that answered 500 answers 500 again a millisecond later,
      // and three retries only delay the chip's raw value by three round
      // trips — the same discipline the pair's other reads keep.
      retry: false,
    })),
  });

  const captions = new Map<string, Readonly<Record<string, string>>>();
  requests.forEach((request, index) => {
    const data = answers[index]?.data;
    if (isCaptionMap(data)) captions.set(request.slug, data);
  });
  if (captions.size === 0) return groups;

  return mapLoad(groups, (list) =>
    list.map((group) => {
      const named = captions.get(group.slug);
      if (named === undefined) return group;
      return {
        ...group,
        options: group.options.map((option) => {
          // Precedence again, enforced rather than assumed: an option the
          // server or the schema already named is not the host's to
          // overwrite. The source says so; the strings cannot.
          if (option.labelSource !== "none") return option;
          const caption = named[option.value];
          return caption === undefined || caption.length === 0
            ? option
            : { ...option, label: caption, labelSource: "host" as const };
        }),
      };
    })
  );
}
