/**
 * The ladder's loud last rung.
 *
 * A category can legally carry a value type this build has no editor for —
 * the engine's registry is open and a deployment adds types without asking a
 * frontend to ship first. Drawing nothing would silently drop a feature that
 * may be MANDATORY: the person submits a listing they could not complete and
 * is told, by the server, that an attribute they never saw is missing.
 *
 * Two things this demo exists to hold in place, both filed by the visual pass
 * as class C-DEVCOPY:
 *
 *  - the notice says a SENTENCE, not `size_grid` and not "this build". A type
 *    slug is an identifier out of a Python registry and our release process is
 *    not something a seller can act on; both travel as `data-attributes-type`
 *    where support can still read them.
 *  - the blocked submit names the blocked FEATURES ("Size grid, Warranty"),
 *    which is what a person can see on the page, rather than the type slugs.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex } from "antd";
import { useT } from "@stapel/core";
import { GatedControl } from "@stapel/tokens-antd/skin";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { unsupportedTypeGate } from "../src/index.js";
import type { FeatureDef } from "../src/index.js";
import {
  BUILTIN_VALUE_EDITOR_TYPES,
  FeatureFields,
  UnsupportedValueEditor,
} from "../src/default/index.js";
import { AttributesDemoHarness, DEMO_KEYS } from "./_harness.js";
import { BROKEN, MIXED_FEATURES, SIZE_GRID } from "./fixtures.js";

/** The notice on its own, without a form around it — one row, two reasons. */
function Notices(props: { readonly features: readonly FeatureDef[] }): ReactElement {
  return (
    <Flex vertical gap={spacing[3]}>
      {props.features.map((feature) => (
        <UnsupportedValueEditor key={feature.slug} feature={feature} />
      ))}
    </Flex>
  );
}

/**
 * The form plus the submit the undrawable feature is blocking.
 *
 * `<FeatureFields/>` holds no state by design — the composer that owns the
 * draft owns the values — so a demo with working controls owns them here.
 */
function BlockedForm(): ReactElement {
  const t = useT();
  const [values, setValues] = useState<Readonly<Record<string, unknown>>>({});
  const gate = unsupportedTypeGate(MIXED_FEATURES, BUILTIN_VALUE_EDITOR_TYPES);
  return (
    <Flex vertical gap={spacing[4]}>
      <FeatureFields
        features={MIXED_FEATURES}
        values={values}
        onChange={(slug, value) => setValues((prev) => ({ ...prev, [slug]: value }))}
      />
      <GatedControl gate={gate}>
        {(bind) => (
          <Button type="primary" {...bind}>
            {t(DEMO_KEYS.publish)}
          </Button>
        )}
      </GatedControl>
    </Flex>
  );
}

export default defineDemo({
  id: "attributes.unsupported",
  title: "A type this build cannot draw",
  description:
    "The third rung of the resolution ladder: no host registration, no skin builtin, so the row becomes a NOTICE — never a skipped field. While one is on screen `unsupportedTypeGate` blocks the submit and names the blocked features. The row itself is label-less, because the notice already names the feature and the visual pass caught it printed twice.",
  component: UnsupportedValueEditor,
  covers: ["FeatureFields"],
  tokens: ["surface-raised"],
  variants: {
    "unknown type": {
      description:
        "A mandatory feature whose type has no editor here. The sentence carries no slug; `data-attributes-type=\"size_grid\"` does.",
      viewport: "phone",
      step: "unsupported",
      render: () => (
        <AttributesDemoHarness>
          <Notices features={[SIZE_GRID]} />
        </AttributesDemoHarness>
      ),
    },
    "no type at all": {
      description:
        "A config that declares no type is MISCONFIGURED, not exotic — a different fact about the catalogue, so a different sentence.",
      viewport: "desktop",
      step: "untyped",
      render: () => (
        <AttributesDemoHarness>
          <Notices features={[BROKEN]} />
        </AttributesDemoHarness>
      ),
    },
    "submit blocked": {
      description:
        "The whole point: the form still draws every feature it can, and the submit is off with the blocked FEATURES named beside it — not a grey button, and not a list of type slugs.",
      viewport: "desktop",
      step: "blocked",
      render: () => (
        <AttributesDemoHarness surface="base">
          <BlockedForm />
        </AttributesDemoHarness>
      ),
    },
  },
});
