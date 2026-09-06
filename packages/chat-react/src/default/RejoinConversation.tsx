/**
 * «Return to conversation» — the way back from a departure (stapel-chat 0.8.6).
 *
 * ── Why this one does NOT ask first ───────────────────────────────────────
 *
 * Leaving is confirmed because the verb on the wire is `DELETE` and two people
 * press it meaning two different things (`LeaveConversation.tsx` says the
 * rest). Returning is the same choice pointed the other way and it has none of
 * that: it puts a thread back on ONE person's list, takes nothing from
 * anybody, creates no membership, and is idempotent. A confirmation here would
 * be a speed bump on the recovery from a mistake — asking a person who has
 * just realised they pressed the wrong thing whether they are sure they want
 * to undo it.
 *
 * So it acts on the press, and the surface it acts on is one row.
 *
 * ── Why it can render NOTHING ─────────────────────────────────────────────
 *
 * `POST /conversations/{id}/rejoin` does not exist before stapel-chat 0.8.6,
 * and the pair announces `>=0.8 <0.9` — so a deployment inside the range it
 * promises can answer `404` to this URL. That answer is about the SERVER, not
 * this thread (`model/mutations.ts` records it against the deployment), and
 * from then on every one of these controls is gone: a control that is known
 * not to work must not be offered again, on this row or any other.
 *
 * It is hidden rather than disabled-with-a-sentence because there is nothing
 * for a person to do about it and nothing they did to cause it. A greyed
 * button reading "this server is too old" is chrome about our release train
 * standing in somebody's inbox.
 *
 * ── Why the refusal renders here and is not retried ───────────────────────
 *
 * The one refusal that is really this request's is
 * `error.403.chat_not_participant` — a settled answer, the same one `GET` and
 * `DELETE` on that thread give — so `useRejoinConversation` does not retry it
 * and the row keeps it on screen underneath the control. A row that swallowed
 * it would leave a person pressing a button that visibly does nothing.
 */
import type { ReactElement } from "react";
import { Button, Flex } from "antd";
import { useErrorDisplay, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens-antd";
import {
  useRejoinConversation,
  useRejoinSupported,
} from "../model/mutations.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

export interface RejoinConversationButtonProps {
  readonly conversationId: string;
  /**
   * The `204` landed and the row is already out of the left list's cache.
   *
   * The left view itself needs nothing — the row is gone on the next paint —
   * so this is for a host showing that thread somewhere else on the same
   * screen, the mirror of `<LeaveConversationDialog onLeft>`.
   */
  readonly onRejoined?: (conversationId: string) => void;
  /** Full-width, for a row that stacks its controls. Default: no. */
  readonly block?: boolean;
}

/** The control, and the request behind it. */
export function RejoinConversationButton(
  props: RejoinConversationButtonProps
): ReactElement | null {
  const t = useT();
  const errorDisplay = useErrorDisplay(CHAT_I18N_KEYS.unknownError);
  const supported = useRejoinSupported();
  const rejoin = useRejoinConversation();
  const { conversationId, onRejoined } = props;

  if (!supported) return null;

  return (
    <Flex vertical gap={spacing[2]} style={{ minWidth: 0 }}>
      <Button
        size="small"
        loading={rejoin.isPending}
        onClick={() => {
          rejoin.mutate(conversationId, {
            onSuccess: () => {
              onRejoined?.(conversationId);
            },
          });
        }}
        block={props.block ?? false}
        data-testid="chat-rejoin"
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        {rejoin.isPending
          ? t(CHAT_I18N_KEYS.rejoinPending)
          : t(CHAT_I18N_KEYS.rejoinAction)}
      </Button>
      {/* Nothing is drawn while there is nothing to say — `ErrorAlert` renders
          null for a null error, and the row keeps its height. */}
      <ErrorAlert error={errorDisplay(rejoin.error)} testId="chat-rejoin-error" />
    </Flex>
  );
}
