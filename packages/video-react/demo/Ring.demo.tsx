/**
 * THE RING — the one screen in this package that arrives uninvited.
 *
 * A call reaches somebody who is doing something else. That is the only case
 * there is, which is why `<CallsProvider>` is mounted ONCE at the app root and
 * the overlay draws over whatever page is underneath. A ring that lived inside
 * the chat thread would ring for the one person already looking at it.
 *
 * The demos below put a page under the overlay on purpose: the interesting
 * thing about this surface is not the card, it is that the card is on top of
 * something the person had not finished reading.
 *
 * `<CallsProvider>` renders nothing of its own — it is the state and the
 * transport — so it is photographed here, through the overlay it feeds.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, radii, spacing } from "@stapel/tokens";
import { CallsProvider } from "../src/index.js";
import { IncomingCallOverlay } from "../src/default/IncomingCallOverlay.js";
import { RingDemoFrame, ringingDemoCall } from "./_calls.js";

const CALLEE = "u-4c02";
const CALLER = "u-9a1f";

/** A page to be interrupted. Deliberately dull: the point is that it is
 * whatever the person was on, and the ring does not care. */
function PageUnderneath(): ReactElement {
  return (
    <div
      style={{
        padding: spacing[4],
        borderRadius: radii.md,
        background: cssVar("surface-raised"),
        minHeight: 220,
      }}
      aria-hidden
    >
      <div
        style={{
          height: 12,
          width: "60%",
          borderRadius: radii.sm,
          background: cssVar("border-subtle"),
          marginBottom: spacing[3],
        }}
      />
      <div
        style={{
          height: 12,
          width: "85%",
          borderRadius: radii.sm,
          background: cssVar("border-subtle"),
          marginBottom: spacing[3],
        }}
      />
      <div
        style={{
          height: 12,
          width: "40%",
          borderRadius: radii.sm,
          background: cssVar("border-subtle"),
        }}
      />
    </div>
  );
}

function Ring(props: {
  viewerId: string;
  media?: string;
  variant?: "fullscreen" | "card";
}): ReactElement {
  const call = ringingDemoCall({
    ...(props.media !== undefined ? { media: props.media } : {}),
    // Far enough ahead that the countdown is drawn rather than already zero —
    // the deadline is the SERVER's field, and the overlay reads it rather
    // than starting a clock of its own.
    expires_at: new Date(Date.now() + 38_000).toISOString(),
    started_at: new Date(Date.now() - 7_000).toISOString(),
  });
  return (
    <RingDemoFrame call={call}>
      <CallsProvider userId={props.viewerId} notifyWhenHidden={false}>
        <PageUnderneath />
        <IncomingCallOverlay
          nameFor={(id) => (id === CALLER ? "Анна" : "Пётр")}
          renderSubject={() => "Велосипед Merida, 21 000 ₽"}
          {...(props.variant !== undefined ? { variant: props.variant } : {})}
        />
      </CallsProvider>
    </RingDemoFrame>
  );
}

export default defineDemo({
  id: "video.ring",
  title: "An incoming call",
  description:
    "Mounted once at the app root, over whatever page the person is on. Full frame on a phone, a card on a desktop. It carries the caller, what the call is ABOUT (a seller with forty conversations needs to know which one this is) and a countdown against the SERVER's own deadline — a client that started its own 45 seconds when the frame arrived would keep ringing for a call that is already over.",
  component: CallsProvider,
  covers: ["IncomingCallOverlay"],
  tokens: ["surface-raised", "border-subtle"],
  variants: {
    incoming: {
      description:
        "The callee's screen on a phone: full frame, so the tap that answers cannot miss and cannot hit the page underneath.",
      viewport: "phone",
      step: "incoming",
      render: () => <Ring viewerId={CALLEE} variant="fullscreen" />,
    },
    "incoming-desktop": {
      description:
        "The same call on a desktop, as a card in the corner — the page underneath stays readable, because a full-screen takeover on a large display is a modal nobody asked for.",
      viewport: "desktop",
      step: "incoming",
      render: () => <Ring viewerId={CALLEE} variant="card" />,
    },
    "audio-only": {
      description:
        "An audio call, said so on the ring rather than discovered after answering.",
      viewport: "phone",
      step: "incoming_audio",
      render: () => <Ring viewerId={CALLEE} media="audio" variant="fullscreen" />,
    },
    outgoing: {
      description:
        "The CALLER's own screen — the same component, in its calling state with a cancel. One overlay for both ends, because both have to close on the same event and two components would be two chances for one of them not to.",
      viewport: "phone",
      step: "outgoing",
      render: () => <Ring viewerId={CALLER} variant="fullscreen" />,
    },
  },
});
