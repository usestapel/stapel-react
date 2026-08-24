/**
 * The public intake page — the only screen in this pair a stranger can reach,
 * and until now the only legally required one with no route.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PrivacyRequestPane } from "../src/default/PrivacyRequestPane.js";
import { DemoCaptcha, GdprDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

/** Nothing is read here: a visitor with no session reads nothing and writes once. */
const IDLE: DemoHandlers = {};

function Page(props: {
  captcha?: boolean;
  defaultKind?: "access" | "erasure" | "rectification" | "portability";
}): ReactElement {
  return (
    <GdprDemoHarness handlers={IDLE}>
      <PrivacyRequestPane
        {...(props.captcha === true
          ? { captcha: <DemoCaptcha />, captchaToken: "token-from-the-widget" }
          : {})}
        {...(props.defaultKind !== undefined ? { defaultKind: props.defaultKind } : {})}
      />
    </GdprDemoHarness>
  );
}

export default defineDemo({
  id: "gdpr.privacy-request",
  title: "Privacy requests (public)",
  description:
    "`POST /dsar` is AllowAny because the form a regulator expects to exist cannot require a login — so this page is a ROUTE with no menu entry (`public.privacy-request`, surface `public`): listing it in a signed-in person's menu would show 'make a data-protection request' twice, the second one asking for the email the session already knows. The captcha is a SLOT: this package ships none and cannot know a deployment's provider, so an unfilled slot renders a dev-only placeholder rather than silently submitting requests a captcha-configured backend will refuse.",
  component: PrivacyRequestPane,
  tokens: ["surface", "text", "text-muted"],
  variants: {
    default: {
      description:
        "No captcha wired: the slot says so in a dev build and renders nothing in production.",
      viewport: "phone",
      step: "intake",
      render: () => <Page />,
    },
    "with-captcha": {
      description: "The host's challenge widget in the slot, its token threaded to the form.",
      viewport: "phone",
      step: "intake-captcha",
      render: () => <Page captcha />,
    },
    "erasure-from-a-policy-link": {
      description:
        "Arrived from a 'delete my data' link in the privacy policy, at desk width: the kind is chosen, the email is still required.",
      viewport: "desktop",
      step: "intake-erasure",
      render: () => <Page captcha defaultKind="erasure" />,
    },
  },
});
