/**
 * The one screen that shows a secret — and the only time it is shown.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SecretReveal } from "../src/default/SecretReveal.js";
import { WebhooksDemoHarness } from "./_harness.js";
import { CREATED_WITH_SECRET } from "./_fixtures.js";

function Reveal(props: { docs?: boolean }): ReactElement {
  return (
    <WebhooksDemoHarness>
      <SecretReveal
        secret={CREATED_WITH_SECRET.secret}
        onAcknowledge={() => undefined}
        {...(props.docs === true
          ? { docsHref: "https://docs.example.com/webhooks/verify" }
          : {})}
      />
    </WebhooksDemoHarness>
  );
}

export default defineDemo({
  id: "webhooks.secret-reveal",
  title: "Signing secret (shown once)",
  description:
    "The backend keeps a hash; the 201 of a create and the 200 of a rotate are the only two responses that ever carry the plaintext, and no read returns it. So this is the last place the value exists outside the receiver that will verify with it — which is why the warning is ABOVE the value rather than under it, why copying is a real button with an aria-label instead of a decorative glyph, and why the exit is an explicit acknowledgement rather than a ✕ somebody can hit before reading. Acknowledging drops the value from memory: nothing in the page keeps a copy after the person says they have it.",
  component: SecretReveal,
  tokens: ["warning", "surface-raised"],
  variants: {
    default: {
      description:
        "With the host's verification docs linked — the half of the contract that lives in the backend's signing module and is served nowhere.",
      viewport: "desktop",
      step: "with_docs",
      render: () => <Reveal docs />,
    },
    phone: {
      description:
        "390px, where the value wraps and the copy button is the only realistic way to take it.",
      viewport: "phone",
      step: "phone",
      render: () => <Reveal docs />,
    },
    "no-docs": {
      description:
        "A host that has not passed `docsHref`: the link is simply absent. A dead 'read the docs' pointing nowhere would be worse than none.",
      viewport: "desktop",
      step: "no_docs",
      render: () => <Reveal />,
    },
  },
});
