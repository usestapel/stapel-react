import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { featureType } from "@stapel/attributes-react";
import type { CategoryFeature } from "../api/types.js";
import { featureLabel, featureOptionsAreKeys } from "../catalog/labels.js";
import type { CategoryLabel } from "../catalog/labels.js";
import { useCategoryFeatures } from "../model/queries.js";

/** One feature of a category, with everything a renderer needs decided. */
export interface CategoryFeatureEntry {
  readonly feature: CategoryFeature;
  /** `kind: "key"` → translate. `translate: "none"` makes it a literal. */
  readonly label: CategoryLabel;
  /** `config.type`, or `undefined` when the row carries none. An undefined
   * type is an UNSUPPORTED type as far as any renderer is concerned —
   * `@stapel/attributes-react` says so loudly rather than skipping the row. */
  readonly type: string | undefined;
  readonly mandatory: boolean;
  /** Are this feature's option labels translation keys? Only under
   * `translate: "all"` and while `translatable_options` is not false. */
  readonly optionsAreKeys: boolean;
}

export interface CategoryFeaturesBag {
  /**
   * The feature schema. `empty` means the category declares no features and
   * inherits none — common for a root category, and a compose form that says
   * "no extra details for this category" rather than spinning.
   */
  readonly state: LoadState<readonly CategoryFeatureEntry[]>;
  /**
   * The raw `FeatureDef[]`, ready to hand straight to
   * `@stapel/attributes-react`'s `<FeatureFields>`, `unsupportedTypeGate`,
   * `mirrorValidate` or `formatFeatureValue`. Kept beside the decorated list
   * because those functions take the wire shape, and re-deriving it from
   * `entries` would be a second mapping to keep in step.
   */
  readonly features: readonly CategoryFeature[];
  /** Only the features marked `show_as_badge` — the card's summary line. */
  readonly badges: readonly CategoryFeature[];
  /** Only the features marked `show_at_title` — the generated title parts. */
  readonly titleParts: readonly CategoryFeature[];
  readonly isFetching: boolean;
  refetch(): void;
}

export interface CategoryFeaturesProps {
  categoryId: number | null | undefined;
  enabled?: boolean;
  children: (bag: CategoryFeaturesBag) => ReactNode;
}

/**
 * A category's feature schema — the bridge to `@stapel/attributes-react`.
 *
 * `GET /categories/{id}/features/` resolves inheritance and order server-side
 * and returns `FeatureCompact` rows whose `config` is the polymorphic
 * attributes config, VERBATIM: `FeatureCompactSerializer.get_config` returns
 * `obj.config`, not `get_config_with_defaults()`. So an absent config key
 * means "the type's default", never "off", and this pair does not restate
 * those defaults — attributes-react owns them (its §13.2 note 1).
 *
 * The two consumers this exists for:
 *
 *  - the **compose form** (`listings-react`), which draws the features with
 *    attributes-react's editor registry and blocks submit on a type this
 *    build cannot draw; and
 *  - the **facet panel** (`search-react`), whose `categoryFeatures` slot takes
 *    exactly `features` below and uses it to caption facet values.
 *
 * Neither of them re-fetches: a host mounts this once per category page.
 */
export function CategoryFeatures(props: CategoryFeaturesProps): ReactNode {
  const query = useCategoryFeatures(
    props.categoryId,
    props.enabled !== undefined ? { enabled: props.enabled } : {}
  );
  const state = loadStateFromQuery(query);
  const features = state.status === "ready" ? state.data : [];

  return props.children({
    state: mapLoad(state, (rows) =>
      rows.map((feature) => ({
        feature,
        label: featureLabel(feature),
        type: featureType(feature),
        mandatory: feature.mandatory === true,
        optionsAreKeys: featureOptionsAreKeys(feature),
      }))
    ),
    features,
    badges: features.filter((f) => f.show_as_badge === true),
    titleParts: features.filter((f) => f.show_at_title === true),
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  });
}
