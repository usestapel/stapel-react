import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { featureType } from "@stapel/attributes-react";
import type {
  CategoryFeature,
  CategoryFeaturesEffectiveFrom,
} from "../api/types.js";
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
  /** `feature.divergent === true`, normalized like `mandatory` above. Only
   * ever true under {@link CategoryFeaturesBag.effectiveFrom} `"children"` —
   * see `visibleFeatures`. */
  readonly divergent: boolean;
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
  /**
   * `"own"` — `features` is this category's own resolved schema, exactly as
   * every build before stapel-categories 0.20.1 answered. `"children"` — this
   * category is a `chips` parent declaring none of its own: `features` is the
   * INTERSECTION of its children's, and any row's `divergent: true` means the
   * children disagree on it. Defaults to `"own"` while the read is not yet
   * `ready` and whenever the server sends no `X-Effective-From` header at all
   * (a build older than 0.20.1).
   */
  readonly effectiveFrom: CategoryFeaturesEffectiveFrom;
  readonly isFetching: boolean;
  refetch(): void;
}

/**
 * Hides a `divergent: true` row until a chip is picked.
 *
 * `effectiveFrom: "children"` (see {@link CategoryFeaturesBag}) can carry a
 * feature only some children declare, or one whose config, `mandatory` or
 * `rules` disagree between them — the row's `config` is already the WIDEST
 * of theirs, so drawing it before a chip narrows to one child offers a
 * control that means something different depending which chip gets picked.
 * Once a chip IS picked (a `CategoryCascade` `commit: "stage"` stop's own
 * partition select — see `headless/CategoryCascade.tsx`) the row means
 * exactly what that child says, and it is safe to show.
 *
 * `chipPicked: true` is a no-op (every row passes) — a leaf or a `tiles`
 * parent's `effectiveFrom: "own"` schema never carries `divergent` at all, so
 * the filter has nothing to remove there either way.
 *
 * The composer (`@stapel/listings-react`) and the facet rail
 * (`@stapel/search-react`) both call this; neither host is wired to it here.
 */
export function visibleFeatures(
  features: readonly CategoryFeature[],
  options: { readonly chipPicked: boolean }
): readonly CategoryFeature[] {
  if (options.chipPicked) return features;
  return features.filter((feature) => feature.divergent !== true);
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
  const features = state.status === "ready" ? state.data.features : [];

  return props.children({
    state: mapLoad(state, (result) =>
      result.features.map((feature) => ({
        feature,
        label: featureLabel(feature),
        type: featureType(feature),
        mandatory: feature.mandatory === true,
        optionsAreKeys: featureOptionsAreKeys(feature),
        divergent: feature.divergent === true,
      }))
    ),
    features,
    badges: features.filter((f) => f.show_as_badge === true),
    titleParts: features.filter((f) => f.show_at_title === true),
    effectiveFrom: query.data?.effectiveFrom ?? "own",
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  });
}
