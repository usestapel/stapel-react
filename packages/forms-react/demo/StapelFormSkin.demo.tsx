/**
 * The whole answer to "the host page says 'put form <id> here'": one component,
 * no session, no workspace id, no auth client — the two public routes are
 * anonymous, so a marketing page can embed this and nothing else.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { StapelForm } from "../src/default/index.js";
import { formsQueryKeys } from "../src/index.js";
import { FormsDemoHarness, SkinFrame } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";
import {
  DEMO_PUBLIC_FORM,
  DEMO_PUBLIC_FORM_UNSUPPORTED,
  DEMO_PUBLIC_ID,
} from "./fixtures.js";

function seedFor(form: unknown): readonly DemoSeed[] {
  return [[formsQueryKeys.publicForm(DEMO_PUBLIC_ID), form]];
}

function Form(props: { form: unknown }): ReactElement {
  return (
    <FormsDemoHarness seed={seedFor(props.form)}>
      <SkinFrame maxWidth="34rem">
        <StapelForm publicId={DEMO_PUBLIC_ID} />
      </SkinFrame>
    </FormsDemoHarness>
  );
}

export default defineDemo({
  id: "forms.stapel-form",
  title: "Public form (default skin)",
  description:
    "A published schema rendered as a form: one antd widget per stapel-attributes kind, the admin's own labels, and a submit bar whose blocked reason is text beside the button rather than a tooltip a disabled control can never show.",
  component: StapelForm,
  covers: ["FormFill"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "ready",
      description:
        "Seven kinds at once — header, text, long text, select, number, boolean, date.",
      render: () => <Form form={DEMO_PUBLIC_FORM} />,
    },
    "unsupported-kind": {
      viewport: "phone",
      step: "submit_blocked",
      description:
        "The LOUD fallback: a kind this build cannot draw gets a notice in the field's place AND blocks the submit, naming the kind. Dropping a possibly-required field silently is the failure this replaces.",
      render: () => <Form form={DEMO_PUBLIC_FORM_UNSUPPORTED} />,
    },
  },
});
