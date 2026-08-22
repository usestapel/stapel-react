/**
 * Namespaced TanStack Query keys (frontend-standard §2 — namespaced keys).
 * Everything under the `"categories"` root so a host can invalidate the whole
 * module or match a single read. Explicit tuple return types satisfy
 * `--isolatedDeclarations`.
 *
 * THE CATALOGUE IS ONE KEY, NOT A PAGE PER REQUEST. `catalog()` is keyed on
 * nothing but the tree options, because the pages of a sync walk are an
 * implementation detail of producing ONE value — the snapshot. Keying pages
 * individually would cache the intermediate states of a protocol whose whole
 * purpose is that the intermediate states are never shown, and would leave a
 * half-walked catalogue in the cache for the next mount to find.
 */
import type { BuildCategoryTreeOptions } from "../catalog/tree.js";

const ROOT = "categories" as const;

/** The tree-shaping options a catalogue read is keyed on. Normalized to
 * booleans so `undefined` and `false` cannot cache twice. */
export interface CatalogKeyOptions {
  readonly includeDeleted: boolean;
  readonly includeInactive: boolean;
}

export function catalogKeyOptions(
  options: BuildCategoryTreeOptions = {}
): CatalogKeyOptions {
  return {
    includeDeleted: options.includeDeleted === true,
    includeInactive: options.includeInactive === true,
  };
}

export const categoriesQueryKeys: {
  readonly all: readonly ["categories"];
  catalog(
    options: CatalogKeyOptions
  ): readonly ["categories", "catalog", CatalogKeyOptions];
  children(id: number): readonly ["categories", "children", number];
  readonly carousel: readonly ["categories", "carousel"];
  features(id: number): readonly ["categories", "features", number];
  readonly revision: readonly ["categories", "revision"];
} = {
  all: [ROOT],
  catalog: (options) => [ROOT, "catalog", options],
  children: (id) => [ROOT, "children", id],
  carousel: [ROOT, "carousel"],
  features: (id) => [ROOT, "features", id],
  revision: [ROOT, "revision"],
};
