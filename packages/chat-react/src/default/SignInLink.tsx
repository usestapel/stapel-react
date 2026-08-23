/**
 * The door beside a blocked control.
 *
 * `actionBlocked` ended the grey-rectangle incident by making every
 * switched-off control state its reason. It did not end the next problem:
 * "sign in to message the seller" is a reason whose next action is a LINK, and
 * this pair rendered the sentence and stopped there — leaving the visitor to
 * find the header themselves (storefront Wave D, G-3).
 *
 * WHERE that link goes is the container's business, never the pair's: the
 * storefront's is `/login?next=<current>`, a tenant app's may be a modal. So
 * the shape is core's `SignInCta` — `{href}` or `{onSignIn}`, never both — and
 * the copy is this pair's, because core floors `en` and `ru` while this pair
 * also ships `es`.
 *
 * A host that routes internally passes `onSignIn`; the `href` arm renders a
 * plain anchor on purpose, because arriving at a sign-in page is one of the
 * few navigations a full load costs nothing.
 */
import type { ReactElement } from "react";
import { Typography } from "antd";
import { useT } from "@stapel/core";
import type { SignInCta } from "@stapel/core";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

export interface SignInLinkProps {
  /** Absent: no link — a host with no sign-in route shows the reason alone. */
  readonly cta: SignInCta | undefined;
  readonly testId: string;
}

export function SignInLink(props: SignInLinkProps): ReactElement | null {
  const t = useT();
  const { cta } = props;
  if (cta === undefined) return null;
  // The separating space belongs HERE, not at the call site: a reason with no
  // door must render as exactly its own sentence, and a `{" "}` left behind by
  // an absent link is a trailing space in every caller's assertion.
  return (
    <>
      {" "}
      <Typography.Link
        data-testid={props.testId}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
        {...(cta.href !== undefined
          ? { href: cta.href }
          : { onClick: cta.onSignIn })}
      >
        {t(CHAT_I18N_KEYS.startSignIn)}
      </Typography.Link>
    </>
  );
}
