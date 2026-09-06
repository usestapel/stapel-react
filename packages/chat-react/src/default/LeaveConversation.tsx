/**
 * «Leave conversation» — the way off a thread, and the sentence that says what
 * that means.
 *
 * ── Why there is a confirmation at all ────────────────────────────────────
 *
 * The verb on the wire is `DELETE` and the act is not a delete. stapel-chat
 * 0.8.5 stamps the caller's participant row and takes the thread off THEIR
 * list; every message stays, the other party's copy is untouched, the leaver
 * still reaches their own history by id, and an authored reply brings the
 * thread back. Two people press this control meaning two different things —
 * "tidy my inbox" and "destroy this for both of us" — and only one of them is
 * what happens. So the confirmation is not a speed bump: it is the only place
 * the product ever says which of the two this is, and it says both halves in
 * one sentence, before the press.
 *
 * ── Why it is CONTROLLED, and rendered beside the menu that opens it ──────
 *
 * A dialog closes over a person's screen, and the menu it was chosen from has
 * to get out of the way first (`model/slots.ts` — the same rule the report
 * sheet follows). But a `SkinDialog` destroys its children when it hides, so a
 * confirmation rendered INSIDE the overflow sheet would be unmounted by the
 * very press that opened it. Hence the shape: the menu owns the flag, closes
 * itself, and renders this as its SIBLING.
 *
 * ── Why the row goes on the 204 and not on the click ──────────────────────
 *
 * `DELETE` is idempotent, so the one refusal that is really this request's is
 * `error.403.chat_not_participant` — a settled answer, not a blip.
 * `useLeaveConversation` therefore does not retry it, and this surface stays
 * OPEN to render it: a confirmation that closed on a refusal would leave a
 * person looking at an inbox that did not change, with nothing on screen
 * saying why.
 */
import type { ReactElement } from "react";
import { Button, Flex, Typography } from "antd";
import { STAPEL_UI_KEYS, useErrorDisplay, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens-antd";
import { SkinDialog } from "@stapel/tokens-antd/skin";
import { useLeaveConversation } from "../model/mutations.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

export interface LeaveConversationDialogProps {
  readonly conversationId: string;
  readonly open: boolean;
  /** Dismissed without leaving — Esc, the mask, "Cancel", the close button. */
  readonly onClose: () => void;
  /**
   * The `204` landed and the row is already out of the inbox cache. A THREAD
   * screen closes itself here — the conversation it is showing is no longer on
   * this person's list — while an inbox needs nothing, because the row it drew
   * is gone on the next paint.
   */
  readonly onLeft?: (conversationId: string) => void;
}

/** The confirmation, and the request behind it. */
export function LeaveConversationDialog(
  props: LeaveConversationDialogProps
): ReactElement {
  const t = useT();
  const errorDisplay = useErrorDisplay(CHAT_I18N_KEYS.unknownError);
  const leave = useLeaveConversation();
  const { conversationId, onLeft, onClose } = props;

  const dismiss = (): void => {
    // A refusal read once is a refusal answered; it must not be waiting on
    // screen the next time this dialog is opened.
    leave.reset();
    onClose();
  };

  return (
    /* A bottom sheet on a phone, a modal above it — the fleet dialog rule,
       stated once in the token bridge and never re-decided here. Deliberately
       NOT `maskClosable: false`: leaving is the destructive-LOOKING half of
       this choice, and the cheap way out stays cheap. */
    <SkinDialog
      open={props.open}
      onClose={dismiss}
      title={t(CHAT_I18N_KEYS.leaveAction)}
      dismissLabel={t(STAPEL_UI_KEYS.dismiss)}
      data-testid="chat-leave-confirm"
      footer={
        <Flex gap={spacing[2]} justify="flex-end" wrap="wrap">
          <Button
            onClick={dismiss}
            data-testid="chat-leave-cancel"
            data-analytics="none"
            data-analytics-reason="dismisses a confirmation without acting — the outcome worth counting is the leave, and it is counted where the request is made"
          >
            {t(STAPEL_UI_KEYS.cancel)}
          </Button>
          <Button
            danger
            type="primary"
            loading={leave.isPending}
            onClick={() => {
              leave.mutate(conversationId, {
                onSuccess: () => {
                  onClose();
                  onLeft?.(conversationId);
                },
              });
            }}
            data-testid="chat-leave-submit"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          >
            {leave.isPending
              ? t(CHAT_I18N_KEYS.leavePending)
              : t(CHAT_I18N_KEYS.leaveConfirm)}
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={spacing[3]} style={{ width: "100%" }}>
        {/* The refusal renders HERE and the dialog stays open around it.
            `chat_not_participant` is a settled answer — the same one a GET on
            this URL gives — so there is nothing to try again, only something
            to be told. */}
        <ErrorAlert error={errorDisplay(leave.error)} testId="chat-leave-error" />
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {t(CHAT_I18N_KEYS.leaveBody)}
        </Typography.Paragraph>
      </Flex>
    </SkinDialog>
  );
}

/**
 * The control that opens {@link LeaveConversationDialog} — written once
 * because it is offered from two screens (the thread's overflow sheet and an
 * inbox row's menu) and a second copy of a destructive-looking button is a
 * second copy to get the wording of wrong.
 *
 * A plain trigger with no dialog of its own, for the reason above: the caller
 * holds the flag, so the menu this sits in can close before the confirmation
 * opens without taking the confirmation down with it.
 */
export function LeaveConversationTrigger(props: {
  readonly onPress: () => void;
  readonly block?: boolean;
}): ReactElement {
  const t = useT();
  return (
    <Button
      danger
      block={props.block ?? true}
      onClick={props.onPress}
      data-testid="chat-leave-open"
      data-analytics="none"
      data-analytics-reason="business action — host app wraps with its own tracked()"
    >
      {t(CHAT_I18N_KEYS.leaveAction)}
    </Button>
  );
}
