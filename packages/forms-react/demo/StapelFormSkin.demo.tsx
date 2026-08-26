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
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import {
  DEMO_PUBLIC_FORM,
  DEMO_PUBLIC_FORM_UNSUPPORTED,
  DEMO_PUBLIC_ID,
} from "./fixtures.js";

/**
 * One variant's data, built ONCE at module scope: the harness memoizes its
 * runtime and query client on the identity of `seed`/`handlers`, so a fixture
 * rebuilt per render would drop the seeded cache on the floor.
 *
 * The seed is what the story photographs; the handlers answer the SAME data,
 * so a refetch in Ladle confirms the story instead of replacing it.
 */
interface Fixture {
  readonly seed: readonly DemoSeed[];
  readonly handlers: DemoHandlers;
}

function fixture(form: unknown): Fixture {
  return {
    seed: [[formsQueryKeys.publicForm(DEMO_PUBLIC_ID), form]],
    handlers: { [`/public/${DEMO_PUBLIC_ID}/`]: form },
  };
}

const PUBLISHED = fixture(DEMO_PUBLIC_FORM);
const UNSUPPORTED = fixture(DEMO_PUBLIC_FORM_UNSUPPORTED);

function Form(props: { fixture: Fixture }): ReactElement {
  return (
    <FormsDemoHarness
      seed={props.fixture.seed}
      handlers={props.fixture.handlers}
    >
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
      render: () => <Form fixture={PUBLISHED} />,
    },
    "unsupported-kind": {
      viewport: "phone",
      step: "submit_blocked",
      description:
        "The LOUD fallback: a kind this build cannot draw gets a notice in the field's place AND blocks the submit, naming the kind. Dropping a possibly-required field silently is the failure this replaces.",
      render: () => <Form fixture={UNSUPPORTED} />,
    },
  },
});
