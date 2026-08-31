/**
 * `@stapel/attributes-react/default` — the antd skin: the ten builtin value
 * editors, the form rows that run the resolution ladder, and the display
 * components.
 *
 * A separate entry point (the convention every pair's `/default` follows) so
 * a consumer rendering its own controls over the registry and the mirror
 * never pulls `antd` into their bundle. `BUILTIN_VALUE_EDITOR_TYPES` is the
 * bridge in the other direction: the headless half judges renderability from
 * that array without importing anything in here.
 *
 * ```tsx
 * import { unsupportedTypeGate, toFeaturesDto } from "@stapel/attributes-react";
 * import { BUILTIN_VALUE_EDITOR_TYPES, FeatureFields } from "@stapel/attributes-react/default";
 *
 * const gate = unsupportedTypeGate(features, BUILTIN_VALUE_EDITOR_TYPES);
 * <FeatureFields features={features} values={values} onChange={setValue} errors={errors} />;
 * <Button disabled={!gate.available}>…</Button>
 * ```
 */
export { BUILTIN_VALUE_EDITORS, BUILTIN_VALUE_EDITOR_TYPES } from "./editors.js";
export { inputValueToTimestamp, timestampToInputValue } from "./editors.js";
export {
  FeatureFields,
  UNGROUPED_SECTION,
  UnsupportedValueEditor,
  featureControlId,
  featureRowTestId,
  featureSectionTestId,
  featureSections,
} from "./FeatureFields.js";
export type {
  FeatureFieldsProps,
  FeatureHint,
  FeatureRowProps,
  UnsupportedValueEditorProps,
} from "./FeatureFields.js";
export { FeatureBadges, FeatureValueList } from "./FeatureBadges.js";
export type { FeatureDisplayProps } from "./FeatureBadges.js";
