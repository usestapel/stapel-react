/**
 * `<StartCallButton/>` — "Call", skinned, beside "Message".
 *
 * Same shape as `<StartChatButton/>` and the same rule: pressable, or switched
 * off WITH a sentence. A greyed-out phone icon with no explanation is worse
 * here than for messaging, because the reasons are less guessable — "you are
 * already on a call" is invisible from this screen.
 *
 * It places no call. `<StartCall>` holds the gate and this draws it; the HOST
 * wires `onCall` to `@stapel/video-react`'s `useCalls().place(…)`. A thread
 * header that imported the video pair to draw a button would put a WebRTC
 * stack in the bundle of every host that shows a conversation and never calls.
 *
 * ── The thread header slot ───────────────────────────────────────────────
 *
 * `<ConversationThreadPanel renderHeaderActions>` is where this goes, and it
 * is a SLOT rather than a built-in for one reason: a deployment without
 * stapel-video installed must not grow a call button that 404s. A host that
 * has calls passes one; a host that does not passes nothing and the header is
 * exactly what it was.
 */
import type { ReactElement } from "react";
import { Button, Space, Typography } from "antd";
import { useActionGate, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { StartCall } from "../headless/StartCall.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ChatSkinTheme } from "./theme.js";

export interface StartCallButtonProps {
  /** The other person. */
  peerId: string | null | undefined;
  /** The viewer, when known. */
  viewerId?: string | null;
  /** The thread the call hangs off — required by the server's authorizer. */
  conversationId: string | null | undefined;
  /** Already on a call? From `useCalls().call !== undefined`. */
  busy?: boolean;
  /** A call is being placed. */
  pending?: boolean;
  /** Ring them. Wire to `useCalls().place({ calleeId, threadKey })`. */
  onCall: (args: { peerId: string; conversationId: string }) => void;
  /** Icon-only, for a crowded thread header. The `aria-label` carries the
   * name either way — an icon button without one is announced as "button" —
   * and any reason it is switched off still renders on the page beside it. */
  compact?: boolean;
}

export function StartCallButton(props: StartCallButtonProps): ReactElement {
  const { peerId, viewerId, conversationId, busy, pending, onCall, compact } =
    props;
  return (
    <ChatSkinTheme>
      <StartCall
        peerId={peerId}
        {...(viewerId !== undefined ? { viewerId } : {})}
        conversationId={conversationId}
        {...(busy !== undefined ? { busy } : {})}
        {...(pending !== undefined ? { pending } : {})}
        onCall={onCall}
      >
        {(bag) => (
          <StartCallBody
            availability={bag.availability}
            isStarting={bag.isStarting}
            call={bag.call}
            compact={compact === true}
          />
        )}
      </StartCall>
    </ChatSkinTheme>
  );
}

function StartCallBody(props: {
  availability: ActionAvailability;
  isStarting: boolean;
  call: () => void;
  compact: boolean;
}): ReactElement {
  const t = useT();
  const gate = useActionGate(props.availability);
  const label = t(CHAT_I18N_KEYS.callButton);

  const button = (
    <Button
      disabled={gate.disabled}
      loading={props.isStarting}
      onClick={props.call}
      aria-label={label}
      data-testid="chat-call-button"
      data-analytics="none"
      data-analytics-reason="placing a call is a server write in another module; the host app wraps it with its own tracked()"
    >
      {props.compact ? "📞" : label}
    </Button>
  );

  return (
    <Space orientation="vertical">
      {/* The sentence is on the PAGE in both arms — never in a hover, in
          either. Touch has no hover, and a disabled antd button swallows the
          pointer events a tooltip listens for, so the one case where the text
          mattered is the one case a tooltip cannot show it. The compact arm
          keeps its `aria-label`, which is what an icon control actually needs.
          */}
      {button}
      {gate.reason ? (
        <Typography.Text type="secondary" data-testid="chat-call-blocked">
          {t(gate.reason)}
        </Typography.Text>
      ) : null}
    </Space>
  );
}
