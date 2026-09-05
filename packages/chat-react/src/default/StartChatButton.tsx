/**
 * `<StartChatButton/>` — "message the seller" on a listing card, skinned.
 *
 * The control is either pressable or switched off WITH a sentence beside it
 * (no seller on the listing; the listing is your own; you are not signed in).
 * It never renders as a grey rectangle with no explanation — and when the host
 * supplies `signIn`, the sentence comes with the door: a stated reason whose
 * next action is a link the visitor cannot find on their own is only half an
 * answer (storefront Wave D, G-3).
 *
 * ── One sentence, fourteen buttons ────────────────────────────────────────
 *
 * That rule is right for ONE control and wrong for a LIST of them. Measured on
 * the host's phone results page: fourteen cards, fourteen copies of "Sign in
 * to message the seller" down one column — the same sentence, about the same
 * session, repeated once per listing. The reason has not changed; only the
 * number of places it is printed has.
 *
 * `refusal` is the surface's answer to that, and every arm keeps the sentence
 * reachable:
 *
 *  - `"inline"` (default, and what this control has always drawn) — beside
 *    this button. Right for a listing PAGE, where there is one of them;
 *  - `"pooled"` — the sentence is registered with the enclosing `PaneGate`
 *    and printed ONCE for the pane, while every button keeps its
 *    `aria-describedby` pointing at that copy. A screen reader still reads the
 *    reason WITH the control it belongs to: the sentence moves, it does not
 *    disappear, which is the difference between pooling and hiding;
 *  - `"none"` — this control says nothing and the HOST has said it (a banner
 *    above the list, its own sign-in bar). The last arm is the only one that
 *    can leave a switched-off control unexplained, so it is opt-in and it is
 *    named for what the caller is taking on.
 */
import type { ReactElement } from "react";
import { Button, Space, Typography } from "antd";
import { useActionGate, useErrorDisplay, useT } from "@stapel/core";
import type { ActionAvailability, SignInCta, SignInCtaProp } from "@stapel/core";
import type { Conversation } from "../api/types.js";
import { StartDirectChat } from "../headless/StartDirectChat.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { GatedButton } from "@stapel/tokens-antd/skin";
import { ErrorAlert } from "./ErrorAlert.js";
import { SignInLink } from "./SignInLink.js";
import { ChatSkinTheme } from "./theme.js";

/** Where the refusal sentence is printed — see the module note. */
export type StartChatRefusal = "inline" | "pooled" | "none";

export interface StartChatButtonProps extends SignInCtaProp {
  /**
   * Where the "why is this off" sentence goes. Default `"inline"` — beside
   * this button, which is what a listing page wants and what a list of
   * fourteen cards does not. See the module note.
   */
  refusal?: StartChatRefusal;
  sellerId: string | null | undefined;
  viewerId?: string | null;
  /**
   * What the thread is ABOUT — `"listing"` and the listing id in a classified
   * marketplace. Supplying them opens (or reopens) the thread for THIS
   * listing rather than the seller's one catch-all thread, and the thread
   * then shows the listing's card at its top. Optional: without them the
   * control behaves exactly as it always did.
   */
  subjectType?: string | null;
  subjectKey?: string | number | null;
  onOpened?: (conversation: Conversation) => void;
  block?: boolean;
}

function StartChatBody(props: {
  availability: ActionAvailability;
  isStarting: boolean;
  error: unknown;
  start: () => void;
  block: boolean | undefined;
  signIn: SignInCta | undefined;
  refusal: StartChatRefusal;
}): ReactElement {
  const t = useT();
  const gate = useActionGate(props.availability);
  const errorDisplay = useErrorDisplay(CHAT_I18N_KEYS.unknownError);
  const label = props.isStarting
    ? t(CHAT_I18N_KEYS.startStarting)
    : t(CHAT_I18N_KEYS.startButton);

  // Only the CONTROL differs between the arms — the column around it, and the
  // error under it, are the same three nodes in all three. Writing the wrapper
  // once is 50-odd bytes of skin bundle, and one place for a change to the
  // column to land rather than two that can drift.
  const shared = {
    type: "primary",
    block: props.block ?? false,
    loading: props.isStarting,
    onClick: props.start,
    "data-analytics": "none",
    "data-analytics-reason":
      "business action — host app wraps with its own tracked()",
  } as const;

  return (
    <Space orientation="vertical" style={{ width: props.block ? "100%" : undefined }}>
      {/* POOLED: the sentence is the gate's to place, and inside a `PaneGate`
          it lands in the pane's own footnote once, with this button's
          `aria-describedby` pointing at it. Outside one it behaves exactly
          like the inline arm, so a host that asks for pooling and forgets the
          scope loses nothing.

          `GatedButton` rather than a hand-wired `GatedControl`: the binding,
          the blocked paint and the reason's placement are the skin's to
          decide, and a second copy of that wiring here is a second thing to
          keep in step with it. */}
      {props.refusal === "pooled" ? (
        <GatedButton
          gate={props.availability}
          whenBlocked="inert"
          testId="chat-start-button"
          {...shared}
        >
          {label}
        </GatedButton>
      ) : (
        <Button disabled={gate.disabled} data-testid="chat-start-button" {...shared}>
          {label}
        </Button>
      )}
      {/* `"none"`: the HOST has said it. The one arm that may leave a
          switched-off control unexplained, which is why it is opt-in.
          `"pooled"` has already printed it, once, for the pane. */}
      {gate.reason && props.refusal === "inline" ? (
        <Typography.Text type="secondary" data-testid="chat-start-blocked">
          {gate.reason}
          <SignInLink cta={props.signIn} testId="chat-start-sign-in" />
        </Typography.Text>
      ) : null}
      <ErrorAlert error={errorDisplay(props.error)} />
    </Space>
  );
}

export function StartChatButton(props: StartChatButtonProps): ReactElement {
  return (
    <StartDirectChat
      sellerId={props.sellerId}
      {...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {})}
      {...(props.subjectType !== undefined ? { subjectType: props.subjectType } : {})}
      {...(props.subjectKey !== undefined ? { subjectKey: props.subjectKey } : {})}
      {...(props.onOpened !== undefined ? { onOpened: props.onOpened } : {})}
    >
      {({ availability, isStarting, error, start }) => (
        // `bare` by default: this control is dropped onto a listing card the
        // host already painted, so the wrapper's job is antd's THEME, not a
        // second rectangle behind the button.
        <ChatSkinTheme>
          <StartChatBody
            availability={availability}
            isStarting={isStarting}
            error={error}
            start={start}
            block={props.block}
            signIn={props.signIn}
            refusal={props.refusal ?? "inline"}
          />
        </ChatSkinTheme>
      )}
    </StartDirectChat>
  );
}
