/**
 * "CALL" AS IT SHIPS — the thread-header control, and the four ways it is off.
 *
 * chat places no call. `@stapel/video-react` does, and this button holds the
 * half chat owns: whether these two people may talk, about this thing, right
 * now. Everything below is a refusal the server would otherwise deliver AFTER
 * the press — 403 because the pair is not in a thread, 409 because one of them
 * is already on a call — which is the one moment a refusal is useless.
 *
 * The `busy` reason is the one worth looking at. "You are already on a call"
 * is INVISIBLE from a thread header: the call is happening somewhere else in
 * the app, over another page, and nothing on this screen says so. A grey
 * button with no sentence would read as a bug.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MandateProvider, mandateResolved } from "@stapel/core";
import type { MandatePrincipal } from "@stapel/core";
import { StartCallButton } from "../src/default/StartCallButton.js";
import { ChatDemoHarness } from "./_harness.js";

function Control(props: {
  principal: MandatePrincipal;
  peerId: string | null;
  viewerId: string | null;
  conversationId: string | null;
  busy?: boolean;
  compact?: boolean;
}): ReactElement {
  return (
    <ChatDemoHarness>
      <MandateProvider source={{ state: mandateResolved(props.principal) }}>
        <div style={{ maxWidth: 420 }}>
          <StartCallButton
            peerId={props.peerId}
            viewerId={props.viewerId}
            conversationId={props.conversationId}
            busy={props.busy ?? false}
            compact={props.compact ?? false}
            onCall={() => undefined}
          />
        </div>
      </MandateProvider>
    </ChatDemoHarness>
  );
}

export default defineDemo({
  id: "chat.start-call-button",
  title: "Call (default skin)",
  description:
    "The thread-header control. It answers whether these two people may talk — the same axes 'message the seller' reads — and calls back; the host wires that to @stapel/video-react's useCalls().place(). Neither package depends on the other, which is why a host that shows conversations and never calls carries no WebRTC stack.",
  component: StartCallButton,
  // `StartCall` is the headless half this button draws; covering it here keeps
  // the two photographed as the one control they are. A string literal, not
  // the identifier — the gate parses this statically and cannot follow an
  // import.
  covers: ["StartCall"],
  tokens: ["brand", "text-muted"],
  variants: {
    default: {
      description:
        "A signed-in member, in a direct thread with a counterpart: pressable, with nothing in the way.",
      viewport: "desktop",
      step: "ready",
      render: () => (
        <Control
          principal="member"
          peerId="u-seller"
          viewerId="u-buyer"
          conversationId="conv-1"
        />
      ),
    },
    busy: {
      description:
        "Already on a call. The refusal that is otherwise invisible from this screen: the call is happening over some other page, and a grey button with no sentence would read as a bug rather than as a state.",
      viewport: "desktop",
      step: "busy",
      render: () => (
        <Control
          principal="member"
          peerId="u-seller"
          viewerId="u-buyer"
          conversationId="conv-1"
          busy
        />
      ),
    },
    "signed-out": {
      description:
        "A visitor. Told to sign in BEFORE the press — and, unlike messaging, with no elevation path: minting an anonymous account so a stranger's phone can ring is a different bargain from minting one to deliver a message somebody typed.",
      viewport: "phone",
      step: "sign_in",
      render: () => (
        <Control
          principal="anonymous"
          peerId="u-seller"
          viewerId={null}
          conversationId="conv-1"
        />
      ),
    },
    "no-thread": {
      description:
        "No conversation to hang the call off. The server's authorizer REQUIRES one — a user id is not a phone number, and membership of a thread is what makes it one — so the control is blocked rather than pressed into a 403.",
      viewport: "phone",
      step: "no_thread",
      render: () => (
        <Control
          principal="member"
          peerId="u-seller"
          viewerId="u-buyer"
          conversationId={null}
        />
      ),
    },
    compact: {
      description:
        "Icon-only, for a crowded thread header. The accessible name and the tooltip carry the label either way — an icon button with no name is announced as 'button' — and the sentence still renders on the page, because a hover does not exist on the phone this is mostly used on.",
      viewport: "phone",
      step: "compact",
      render: () => (
        <Control
          principal="member"
          peerId="u-buyer"
          viewerId="u-buyer"
          conversationId="conv-1"
          compact
        />
      ),
    },
  },
});
