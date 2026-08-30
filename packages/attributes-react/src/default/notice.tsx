/**
 * The LOUD last rung of the resolution ladder, in its own module so both the
 * field rows and the vocabulary-backed editors can reach it without importing
 * each other (`FeatureFields` -> `editors` is the ladder's direction; the
 * reverse would be a cycle).
 *
 * NOT a skipped field. A category can legally carry a type this build has no
 * editor for, or a `ref_select` whose vocabulary source the host never wired
 * up, and drawing nothing would silently drop a feature that may be MANDATORY
 * — the person would submit a listing they could not complete and be told, by
 * the server, that an attribute they never saw is missing.
 */
import type { ReactElement } from "react";
import { Alert } from "antd";
import { useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { FeatureDef } from "../types.js";
import { featureName, featureType } from "../types.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";
import type { AttributesI18nKey } from "../i18n/keys.js";

export interface UnsupportedValueEditorProps {
  readonly feature: FeatureDef;
  /**
   * Which sentence to say. Absent, the notice reads the feature's `config`
   * and says either "no type at all" or "no editor for this type" — the two
   * cases it has always covered. A caller that knows better names its own
   * reason (a `ref_*` field with no `VocabularyClientProvider` above it, a
   * rule set that does not parse), so the person is told the actual fact
   * rather than a generic one.
   */
  readonly reason?: AttributesI18nKey;
}

/**
 * It names the FEATURE and says the sentence; the type SLUG travels as
 * `data-attributes-type` instead of being rendered. That is the C-DEVCOPY fix
 * from the visual pass: `size_grid` is an identifier out of a Python registry,
 * and "this build has no editor for it" is a fact about our release process —
 * neither is something a seller can act on, and support can still read both
 * off the DOM.
 */
export function UnsupportedValueEditor(
  props: UnsupportedValueEditorProps
): ReactElement {
  const t = useT();
  const type = featureType(props.feature);
  const reason =
    props.reason ??
    (type === undefined
      ? ATTRIBUTES_I18N_KEYS.untypedFeature
      : ATTRIBUTES_I18N_KEYS.unsupportedType);
  return (
    <SkinTheme surface="bare">
      <Alert
        type="warning"
        showIcon
        data-testid="attributes-unsupported-type"
        data-attributes-type={type ?? "(none)"}
        data-attributes-reason={reason}
        title={featureName(props.feature)}
        description={t(reason)}
      />
    </SkinTheme>
  );
}
