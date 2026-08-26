/**
 * "MESSAGE THE SELLER" AS IT SHIPS — the control a listing card mounts, and the
 * three ways it is switched off.
 *
 * The interesting half of this button is never the pressable state. It is what
 * happens when it cannot be pressed: a grey rectangle with no explanation is
 * the defect `actionBlocked` ended, and a stated reason whose next action is a
 * link the visitor cannot find is the half-answer `SignInLink` ended after it.
 * So three of the four variants below are refusals, each with its sentence on
 * the page — never in a hover, which on the phone this is drawn at does not
 * exist at all.
 *
 * `block` is on for the phone variants because that is how a listing card
 * actually mounts it: full width, thumb-height, at the bottom of the card.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MandateProvider, mandateResolved } from "@stapel/core";
import type { MandatePrincipal } from "@stapel/core";
import { StartChatButton } from "../src/default/StartChatButton.js";
import { ChatDemoHarness, DEMO_INBOX } from "./_harness.js";

/** Where this host sends a signed-out visitor. A storefront's own route, not
 * the pair's — the pair only knows there IS a door. */
const SIGN_IN = { href: "/login?next=/listing/bicycle" } as const;

/**
 * Every variant names its PRINCIPAL, because "signed out" is not something
 * this control derives from a `viewerId` — it is read off core's mandate axis
 * (`useMandate()`), so a visitor is told to sign in BEFORE the click instead of
 * being handed a 401 after it. A demo that passed `viewerId={null}` and hoped
 * would silently draw the signed-in button under the "signed out" name; the
 * demo distinctness guard is what caught that here.
 */
function Button(props: {
  principal: MandatePrincipal;
  sellerId: string | null;
  viewerId: string | null;
  block?: boolean;
  signIn?: { readonly href: string };
}): ReactElement {
  return (
    <ChatDemoHarness handlers={{ "/conversations": DEMO_INBOX[0] ?? {} }}>
      <MandateProvider source={{ state: mandateResolved(props.principal) }}>
        <div style={{ maxWidth: 420 }}>
          <StartChatButton
            sellerId={props.sellerId}
            viewerId={props.viewerId}
            block={props.block ?? false}
            {...(props.signIn ? { signIn: props.signIn } : {})}
          />
        </div>
      </MandateProvider>
    </ChatDemoHarness>
  );
}

export default defineDemo({
  id: "chat.start-chat-button",
  title: "Message the seller (default skin)",
  description:
    "The shipped listing-card control. Pressable, or switched off WITH the sentence that says why — and, when the host supplies a sign-in route, with the door beside the sentence. Opening is get-or-create by participant pair, so pressing twice cannot fan out into two threads.",
  component: StartChatButton,
  tokens: ["brand", "text-on-accent", "text-muted"],
  variants: {
    default: {
      description:
        "A signed-in member, phone width, full-bleed as a listing card mounts it: a seller to write to and nothing in the way.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <Button principal="member" sellerId="u-seller" viewerId="u-buyer" block />
      ),
    },
    "signed-out": {
      description:
        "An anonymous visitor: the refusal that has a next action. The reason and the door, on the page, one tap apart — never a hover, and never a button that simply vanishes (a control that disappears teaches nobody that messaging the seller is possible at all).",
      viewport: "phone",
      step: "sign_in",
      render: () => (
        <Button
          principal="anonymous"
          sellerId="u-seller"
          viewerId={null}
          block
          signIn={SIGN_IN}
        />
      ),
    },
    "own-listing": {
      description:
        "Your own listing. A reason with no door, because there is nothing for the visitor to do — and the sentence renders alone, with no stray space where a link would have been.",
      viewport: "phone",
      step: "self",
      render: () => (
        <Button principal="member" sellerId="u-buyer" viewerId="u-buyer" block />
      ),
    },
    "no-seller": {
      description:
        "A listing with nobody attached to write to, at desk width.",
      viewport: "desktop",
      step: "unknown_seller",
      render: () => (
        <Button principal="member" sellerId={null} viewerId="u-buyer" />
      ),
    },
  },
});
