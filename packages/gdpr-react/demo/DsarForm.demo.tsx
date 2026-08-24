/**
 * The front door of Art. 12, in both of its genuinely different shapes.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DsarForm } from "../src/default/DsarForm.js";
import { GdprDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

/** Nothing is read on this screen — the form is a write. */
const IDLE: DemoHandlers = {};

function Form(props: {
  variant: "app" | "anonymous";
  defaultKind?: "access" | "erasure" | "rectification" | "portability";
}): ReactElement {
  return (
    <GdprDemoHarness handlers={IDLE}>
      <DsarForm
        variant={props.variant}
        {...(props.defaultKind !== undefined ? { defaultKind: props.defaultKind } : {})}
      />
    </GdprDemoHarness>
  );
}

export default defineDemo({
  id: "gdpr.dsar-form",
  title: "Make a data-protection request",
  description:
    "One component, two callers that are not a style choice. Signed in (`app`), the server takes the email off the session and IGNORES a supplied one — so the form does not ask for it, because asking would invite somebody to type a different address and believe the answer goes there. Anonymous, the email IS the only identity the request has, so it is required and refused HERE rather than by the server's bare 400, on the one page whose visitor has no account and no support channel to ask.",
  component: DsarForm,
  tokens: ["surface-raised"],
  variants: {
    default: {
      description: "Signed in: kind and note, and no email field at all.",
      viewport: "phone",
      step: "app",
      render: () => <Form variant="app" />,
    },
    anonymous: {
      description:
        "The public form: an email field, because it is the only identity the request has.",
      viewport: "phone",
      step: "anonymous",
      render: () => <Form variant="anonymous" />,
    },
    "erasure-preselected": {
      description:
        "A 'delete my data' link in a privacy policy lands on the same form with the kind chosen.",
      viewport: "desktop",
      step: "app",
      render: () => <Form variant="app" defaultKind="erasure" />,
    },
  },
});
