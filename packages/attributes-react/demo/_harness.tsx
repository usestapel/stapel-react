/**
 * Shared harness for the attributes-react demos (frontend-guardrails §4.2).
 * Demos are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * dimensions and no hardcoded prose.
 *
 * It carries NO chrome of its own: no debug card, no class-name heading, no
 * `state.step` chip. That shape is exactly how twenty packages shipped
 * showcases in which the antd skin on disk had never been photographed once.
 * Its whole job is to supply the one thing the editors cannot supply
 * themselves — a translator (option labels, `prefix`/`postfix` and
 * `trueLabel`/`falseLabel` are catalogue KEYS, not copy) — plus the PAGE's
 * paint, which is a host's job and never the component's.
 *
 * The `SkinTheme` below is that paint and nothing more: every surface in
 * `src/default/**` is its own `SkinTheme surface="bare"` root now, so the
 * editors are on the document's side of light/dark with or without this
 * wrapper. `test/responsive.test.tsx` renders them with NO skin above them
 * and asserts exactly that, so this harness cannot go back to being the thing
 * that makes the shots look right while the shipped component is broken.
 *
 * This package is an L0 library, not a pair: no runtime, no queries, no
 * `fetch`. Feature definitions arrive inside the responses of the modules that
 * own them, so there is nothing to mock here and a demo seeds by passing
 * props — which is also why every variant below is already IN the state it
 * documents rather than one click away from it.
 */
import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { FlowError } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import { featureErrorsBySlug, mirrorValidate, toFeaturesDto } from "../src/index.js";
import type { FeatureDef } from "../src/index.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields } from "../src/default/index.js";

/**
 * `demo.*` is an UNMANAGED namespace, so `i18n-key-exists` treats these as
 * app-local and never false-positives on them.
 *
 * And the map is this package's central claim, made visible: every key below
 * is a config VALUE arriving from the catalogue — an option's `label`, a
 * number's `postfix`, a bool's `trueLabel`. The engine declares them
 * translatable per type (`get_translation_keys`); the deployment supplies the
 * words. A demo that photographed `demo.fuel.diesel` on a chip would be
 * documenting the bug `src/default/labels.ts` was written to close.
 */
const demoBundleEn: Record<string, string> = {
  "demo.unit.litre": "L",
  "demo.price.negotiable": "Negotiable",
  "demo.price.fixed": "Fixed price",
  "demo.fuel.petrol": "Petrol",
  "demo.fuel.diesel": "Diesel",
  "demo.fuel.electric": "Electric",
  "demo.extra.abs": "ABS",
  "demo.extra.esp": "Stability control",
  "demo.extra.ac": "Air conditioning",
  "demo.extra.gps": "Navigation",
  "demo.extra.roof": "Sunroof",
  "demo.condition.used": "Used",
  "demo.condition.new": "New",
  "demo.body.passenger": "Passenger",
  "demo.body.sedan": "Sedan",
  "demo.body.hatchback": "Hatchback",
  "demo.body.commercial": "Commercial",
  "demo.body.van": "Van",
  "demo.colour.red": "Red",
  "demo.colour.blue": "Blue",
  "demo.colour.silver": "Silver",

  // Copy the demo STAND-INS render. A demo is product code (compiled, linted
  // with the product ruleset, rendered), so a literal string in one is the
  // same defect as a literal string in a skin.
  "demo.action.publish": "Publish listing",
};

export const DEMO_KEYS = {
  publish: "demo.action.publish",
} as const;

/** Provider frame every attributes demo variant renders inside. */
export function AttributesDemoHarness(props: {
  /** `"base"` for a full form, `"raised"` (the default) for a panel. */
  readonly surface?: SkinSurface;
  readonly children: ReactNode;
}): ReactElement {
  const i18n = useMemo(() => {
    const engine = createI18n({ locale: "en" });
    registerAttributesI18n(engine);
    engine.registerBundle("en", demoBundleEn);
    return engine;
  }, []);
  return (
    <I18nProvider i18n={i18n}>
      <SkinTheme surface={props.surface ?? "raised"}>{props.children}</SkinTheme>
    </I18nProvider>
  );
}

/**
 * A live `<FeatureFields/>` — the composer's half of the seam, in miniature.
 *
 * The component holds no state by design (a host owns the draft), so a demo
 * that wants working controls has to own it. This is the smallest honest
 * version of what `listings-react`'s composer does, and it opens SEEDED: the
 * values are already in, so a static shot photographs the answered form
 * instead of an empty one under a name that says "filled in".
 */
export function EditableFeatureFields(props: {
  readonly features: readonly FeatureDef[];
  readonly initialValues?: Readonly<Record<string, unknown>>;
  /** Show the mirror's refusals from the first frame — what a person sees
   * after a submit was refused, which is the only time they are useful. */
  readonly showErrors?: boolean;
  /** A submit is in flight: every editor goes read-only. */
  readonly submitting?: boolean;
}): ReactElement {
  const [values, setValues] = useState<Readonly<Record<string, unknown>>>(
    props.initialValues ?? {}
  );
  const errors: Readonly<Record<string, FlowError>> = useMemo(() => {
    if (props.showErrors !== true) return {};
    return featureErrorsBySlug(mirrorValidate(props.features, toFeaturesDto(props.features, values)));
  }, [props.features, props.showErrors, values]);
  return (
    <FeatureFields
      features={props.features}
      values={values}
      errors={errors}
      disabled={props.submitting === true}
      onChange={(slug, value) => setValues((prev) => ({ ...prev, [slug]: value }))}
    />
  );
}
