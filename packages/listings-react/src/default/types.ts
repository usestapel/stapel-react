/**
 * Small shared types for the `/default` skin — kept in one place so every
 * surface takes the same `mode` prop and re-exports the same error dialect.
 */
export type { FlowError } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import type { FeatureDef } from "@stapel/attributes-react";

/** Every `/default` surface accepts a theme mode; absent means "whatever the
 * host document declares" (`resolveThemeMode()`), never a hardcoded side. */
export interface ThemeModeProp {
  readonly mode?: ThemeMode;
}

/**
 * Every surface that DISPLAYS stored feature values takes this, and it is
 * optional on all of them.
 *
 * A stored `select` carries its chosen values and no option table (the table
 * lives on the category), so a row written before the label snapshot existed
 * prints its storage slug — "b-u" where the catalogue holds the copy. A
 * surface that knows which category it is drawing can hand the category's own
 * defs over and the copy is repaired; a mixed grid of forty categories knows
 * no such thing, passes nothing, and renders exactly what it renders today.
 *
 * The precedence between these defs and what the row itself stored is
 * `model/features.ts`' business — see {@link FeatureCopySource}.
 */
export interface CategoryFeaturesProp {
  /** The category's features, as
   * `GET /categories/api/v1/categories/{id}/features/` answers — the same
   * array `<ListingComposerPage>` takes. */
  readonly categoryFeatures?: readonly FeatureDef[];
}
