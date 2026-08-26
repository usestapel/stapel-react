/**
 * THE DOOR BESIDE A BLOCKED CONTROL — drawn on its own, because its whole
 * contract is about what it does NOT render.
 *
 * `<SignInLink/>` is three lines of skin and two years of argument. A stated
 * reason ("Sign in to message the seller.") is better than a grey rectangle,
 * and still leaves the visitor hunting the header for the way in. So the reason
 * comes with the door — and the door is the HOST's route, never the pair's:
 * `{href}` for a storefront that navigates, `{onSignIn}` for a tenant app that
 * opens its own modal, exactly one of the two, never both.
 *
 * The variant that matters most is `no-route`. A host with no sign-in route at
 * all gets NOTHING — not a dead link, not a trailing space. The separating
 * space lives inside the component precisely so the absent-link case renders as
 * exactly its own sentence; putting it at the call site is what leaves a
 * trailing space in every caller's assertion, and a stray gap in every skin.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { Typography } from "antd";
import { useT } from "@stapel/core";
import type { SignInCta } from "@stapel/core";
import { SignInLink } from "../src/default/SignInLink.js";
import { CHAT_I18N_KEYS } from "../src/i18n/keys.js";
import { ChatDemoHarness } from "./_harness.js";

/** The sentence this link is always attached to, rendered the way
 * `<StartChatButton/>` renders it — muted, beside the switched-off control. */
function BlockedReason(props: { cta: SignInCta | undefined }): ReactElement {
  const t = useT();
  return (
    <Typography.Text type="secondary">
      {t(CHAT_I18N_KEYS.startBlockedSignIn)}
      <SignInLink cta={props.cta} testId="chat-demo-sign-in" />
    </Typography.Text>
  );
}

function Door(props: { cta: SignInCta | undefined }): ReactElement {
  return (
    <ChatDemoHarness>
      <div style={{ maxWidth: 420 }}>
        <BlockedReason cta={props.cta} />
      </div>
    </ChatDemoHarness>
  );
}

/** A storefront: a real anchor, because arriving at a sign-in page is one of
 * the few navigations a full load costs nothing. */
const HREF_CTA: SignInCta = { href: "/login?next=/listing/bicycle" };

/** A tenant app that routes internally and opens its own surface. */
const HANDLER_CTA: SignInCta = {
  onSignIn: () => {
    // A demo host's router would go here. Doing nothing is honest: this
    // package does not own the destination and never invents one.
  },
};

export default defineDemo({
  id: "chat.sign-in-link",
  title: "Sign-in door (default skin)",
  description:
    "The link that turns a stated reason into an action a visitor can take. Renders core's `SignInCta` — `{href}` or `{onSignIn}`, never both — and renders NOTHING when the host has no sign-in route, so a reason with no door is exactly its own sentence and not a dead affordance.",
  component: SignInLink,
  tokens: ["link", "text-muted"],
  variants: {
    default: {
      description:
        "Phone width, the storefront arm: the reason and a real anchor back to the listing. This is the pairing a signed-out visitor meets on a listing card.",
      viewport: "phone",
      step: "href",
      render: () => <Door cta={HREF_CTA} />,
    },
    "host-routed": {
      description:
        "The `{onSignIn}` arm — a tenant app that opens its own sign-in surface instead of navigating away.",
      viewport: "phone",
      step: "on_sign_in",
      render: () => <Door cta={HANDLER_CTA} />,
    },
    "no-route": {
      description:
        "No sign-in route configured: the sentence stands alone, with no dead link and no trailing space after it.",
      viewport: "desktop",
      step: "absent",
      render: () => <Door cta={undefined} />,
    },
  },
});
