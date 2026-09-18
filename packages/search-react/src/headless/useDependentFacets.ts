/**
 * STAGED DEPENDENT FACETS, read off the answer — one fact per group, and the
 * one reducer rule a parent change owes its children.
 *
 * `OptionsRef.parentFeature` says a group's codes are the children of a
 * sibling's chosen term: make → model → generation. The composer has staged
 * that since the field existed; stapel-search 0.18.0 stages it on the SERP
 * too and says so on the wire (`facet_labels[<slug>].depends_on` / `.gated` /
 * `.parent_missing`, `facet_meta.dependent_facets`).
 *
 * This hook is the whole of what a surface has to read. It exists rather than
 * each skin reaching into `FacetGroup` because there are four surfaces — the
 * desktop rail, the phone drawer, the opener chip row and the applied chip
 * row — and three of them would otherwise have to re-derive "whose child is
 * this" from a field the fourth reads directly.
 */
import { useMemo } from "react";
import type { FacetMeta, SearchQueryState } from "../api/types.js";
import type { DependentFacetsMode, FacetGroup } from "../state/facets.js";
import {
  clearDependentFilters,
  dependentFacetSlugs,
  dependentFacetsMode,
  facetParentSlug,
} from "../state/facets.js";

/** What one group's staging looks like to a surface that draws it. */
export interface DependentFacet {
  /** The slug of the group this one's codes are children of, or `undefined`
   * for an independent axis. */
  readonly dependsOn: string | undefined;
  /**
   * The group is held SHUT: no options, no counts, nothing to press. A
   * surface draws it collapsed and inert, naming {@link parentLabel} as the
   * control to use first — it does not drop it, because a rail is a map of
   * the axes a category has and an axis that vanishes and reappears is a rail
   * that moves under the reader.
   */
  readonly gated: boolean;
  /**
   * This group carries a filter and its parent carries none — a deep link, or
   * an address an older panel wrote. The filter stays applied; the PARENT
   * group is drawn open beside it so the reader can see what their selection
   * is a child of.
   */
  readonly parentMissing: boolean;
  /** What the parent is CALLED — the parent group's own heading, `undefined`
   * when the parent is not an axis of this page. */
  readonly parentLabel: string | undefined;
}

const INDEPENDENT: DependentFacet = {
  dependsOn: undefined,
  gated: false,
  parentMissing: false,
  parentLabel: undefined,
};

/** The staging of every group on one answer, plus the reducer rule. */
export interface DependentFacetsBag {
  /**
   * How the server answered — `"flat"` when it declined to stage, and
   * `undefined` when it said nothing at all (a pre-0.18 server, or groups a
   * host built by hand, where the pair falls back to the category schema's
   * own `parentFeature`).
   */
  readonly mode: DependentFacetsMode | undefined;
  /** Every group held shut on this answer, in the answer's own order. */
  readonly gatedSlugs: readonly string[];
  /**
   * The parents a surface must draw OPEN: the ones named by a group that
   * arrived `parent_missing`. Empty on every ordinary page.
   */
  readonly openParents: readonly string[];
  /** One group's staging. Never throws and never `undefined` — a slug this
   * answer does not carry is simply independent. */
  get(slug: string): DependentFacet;
  /** Every group hanging off `slug`, directly or through another dependent. */
  dependentsOf(slug: string): readonly string[];
  /**
   * THE RULE: a parent's selection changed — added to, removed from, or
   * cleared — so its dependents' selections come off in the SAME update.
   *
   * Returns `state` itself when nothing hangs off the slug, which is what
   * lets a caller keep its ordinary single-slug path (and its history mode)
   * on every page that has no chain. A second render with the child filter
   * still applied is not an option: that request is a real request, the
   * server answers it honestly as `parent_missing`, and the reader gets a
   * page of a model that belongs to a make they just stopped asking for.
   */
  onParentChange(state: SearchQueryState, slug: string): SearchQueryState;
}

/**
 * @param groups the answer's facet groups, as `useFacetPanel` built them.
 * @param values the selections currently applied — `SearchQueryState.filters`.
 *   Read rather than taken off the groups so the fallback below works on a
 *   group a host assembled itself, and so the bag recomputes when the URL
 *   moves rather than only when an answer lands.
 * @param meta the answer's `facet_meta`, for `dependent_facets`.
 */
export function useDependentFacets(
  groups: readonly FacetGroup[],
  values: Readonly<Record<string, readonly string[]>>,
  meta: Pick<FacetMeta, "dependent_facets"> | undefined
): DependentFacetsBag {
  const mode = dependentFacetsMode(meta);
  return useMemo<DependentFacetsBag>(() => {
    const labels = new Map<string, string>();
    for (const group of groups) labels.set(group.slug, group.label);

    const chosen = (slug: string | undefined): boolean => {
      if (slug === undefined) return false;
      const group = groups.find((candidate) => candidate.slug === slug);
      const direct = values[slug] ?? [];
      const byKey = group?.urlKey === undefined ? [] : (values[group.urlKey] ?? []);
      return direct.length > 0 || byKey.length > 0;
    };

    const table = new Map<string, DependentFacet>();
    for (const group of groups) {
      // The answer first, the category schema second. `flat` is the server
      // saying it has the rule and is not applying it, so nothing below it
      // is asked — see `dependentFacetsMode`.
      const dependsOn =
        mode === "flat" ? undefined : (group.dependsOn ?? facetParentSlug(group));
      if (dependsOn === undefined) {
        table.set(group.slug, INDEPENDENT);
        continue;
      }
      const parentIsAnAxis = labels.has(dependsOn);
      const parentAnswered = chosen(dependsOn);
      table.set(group.slug, {
        dependsOn,
        // A gate on an axis nobody can answer is an axis switched off
        // forever, so a parent that is not on this page gates nothing —
        // the same asymmetry the server applies and `resolveFacetParents`
        // has always applied.
        gated:
          group.gated ??
          (parentIsAnAxis && !parentAnswered && !chosen(group.slug)),
        parentMissing:
          group.parentMissing ?? (!parentAnswered && chosen(group.slug)),
        parentLabel: labels.get(dependsOn),
      });
    }

    const gatedSlugs = groups
      .filter((group) => table.get(group.slug)?.gated === true)
      .map((group) => group.slug);
    const openParents = [
      ...new Set(
        groups
          .map((group) => table.get(group.slug))
          .filter((fact): fact is DependentFacet => fact?.parentMissing === true)
          .map((fact) => fact.dependsOn)
          .filter((slug): slug is string => slug !== undefined)
      ),
    ];

    return {
      mode,
      gatedSlugs,
      openParents,
      get: (slug) => table.get(slug) ?? INDEPENDENT,
      dependentsOf: (slug) =>
        mode === "flat" ? [] : dependentFacetSlugs(groups, slug),
      onParentChange: (state, slug) => {
        if (mode === "flat") return state;
        const filters = clearDependentFilters(state.filters, groups, slug);
        return filters === state.filters ? state : { ...state, filters };
      },
    };
  }, [groups, values, mode]);
}
