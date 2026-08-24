/** The door beside a blocked control. */
import type { ReactElement } from "react";
import { Typography } from "antd";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import type { SignInCta } from "@stapel/core";
import { SignInLink } from "../src/default/index.js";
import { REVIEWS_I18N_KEYS } from "../src/index.js";
import { ReviewsDemoHarness } from "./_harness.js";

/**
 * Rendered exactly as the form renders it: inside the sentence that states the
 * reason, never as a lone button on a blank page — the reason and the door are
 * one line of copy.
 */
function Door(props: { cta: SignInCta | undefined }): ReactElement {
  const t = useT();
  return (
    <Typography.Text type="secondary">
      {t(REVIEWS_I18N_KEYS.formSignInRequired)}
      <SignInLink cta={props.cta} testId="reviews-demo-sign-in" />
    </Typography.Text>
  );
}

function Framed(props: { cta: SignInCta | undefined }): ReactElement {
  return (
    <ReviewsDemoHarness>
      <Door cta={props.cta} />
    </ReviewsDemoHarness>
  );
}

export default defineDemo({
  id: "reviews.sign-in-link",
  title: "Sign-in door",
  description:
    "actionBlocked ended the grey-rectangle incident by making every switched-off control state its reason. It did not end the next problem: 'sign in to leave a review' is a reason whose next action is a LINK, and this pair used to render the sentence and stop there, leaving the visitor to find the header themselves. WHERE the link goes is the container's business, never the pair's — the shape is core's SignInCta, {href} or {onSignIn} and never both — so the href arm renders a plain anchor (arriving at a sign-in page is one of the few navigations a full load costs nothing) and the handler arm renders a control a router can intercept. A host with no sign-in route at all passes nothing and gets the reason alone, with no trailing space where the link would have been.",
  component: SignInLink,
  tokens: ["brand"],
  variants: {
    "a route (href)": {
      viewport: "phone",
      step: "href",
      description: "A plain anchor — a full load to the sign-in page.",
      render: () => <Framed cta={{ href: "/login?next=/listing/42" }} />,
    },
    "no door at all": {
      viewport: "phone",
      step: "absent",
      description: "No sign-in route: the reason renders alone.",
      render: () => <Framed cta={undefined} />,
    },
    "a handler (onSignIn)": {
      viewport: "desktop",
      step: "on-sign-in",
      description: "A host that routes internally, or opens a modal.",
      render: () => <Framed cta={{ onSignIn: () => undefined }} />,
    },
  },
});
