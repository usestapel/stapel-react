/**
 * THE WAY BACK — and the one frame that proves leaving is not a deletion.
 *
 * stapel-chat 0.8.5 gave a person a way out of a thread and no way back into
 * it: the thread was off their list, out of the counts and out of `?search=`,
 * and it was deliberately still there. 0.8.6 closes it —
 * `GET /conversations?left=true` lists them and
 * `POST /conversations/{id}/rejoin` clears the caller's `left_at` and nothing
 * else, so the thread returns with the badge it had and where the departure
 * left it.
 *
 * The control is photographed on its own because two of its properties are
 * invisible in the inbox shot beside it:
 *
 *  - IT ASKS NOTHING. Leaving is confirmed because two people press it meaning
 *    two different things; returning is the safe half of that same choice and
 *    a confirmation there is a speed bump on the recovery FROM a mistake.
 *  - IT CARRIES THE ONE REFUSAL IT HAS. `403 chat_not_participant` is settled
 *    — the same answer `GET` and `DELETE` on that thread give — so it is not
 *    retried and it is rendered under the control rather than swallowed,
 *    which is the second variant.
 *
 * (There is a third answer this control can get and it has no picture on
 * purpose: a `404` means the deployment predates the verb, and every rejoin
 * control on the screen is then GONE. An empty frame is not evidence.)
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { RejoinConversationButton } from "../src/default/RejoinConversation.js";
import { ChatSkinTheme } from "../src/default/theme.js";
import { CHAT_I18N_KEYS } from "../src/index.js";
import { ChatDemoHarness, DEMO_LEFT_LIST } from "./_harness.js";

/** The two rows of the demo left list, and the departures they are sorted by. */
const MINE = DEMO_LEFT_LIST[0];
const NOT_MINE = DEMO_LEFT_LIST[1];

/**
 * Demo CONTENT, not copy: the catalogue needs the counterpart's name above the
 * control so the frame reads as a ROW off the «Left» tab rather than as
 * a lone button on a page. The product's own words — the departure line and
 * the control — come from the i18n keys below.
 */
const DEMO_COUNTERPART = "Marta Kovács";
const DEMO_STRANGER = "Anton Berg";

/**
 * One row of the left list, as the panel draws it: the departure sentence and
 * the way back, side by side BELOW the row control (the row itself opens the
 * thread, so a button inside it would be a control inside a control).
 */
function LeftRow(props: {
  readonly conversationId: string;
  readonly leftAt: string;
  readonly who: string;
}): ReactElement {
  const t = useT();
  return (
    <ChatSkinTheme surface="raised">
      <Flex vertical gap={spacing[2]} style={{ padding: spacing[4], minWidth: 0 }}>
        <Typography.Text strong>{props.who}</Typography.Text>
        <Flex align="center" justify="space-between" wrap="wrap" gap={spacing[2]}>
          <Typography.Text type="secondary">
            {t(CHAT_I18N_KEYS.leftAt, {
              date: new Intl.DateTimeFormat("en", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(Date.parse(props.leftAt)),
            })}
          </Typography.Text>
          <RejoinConversationButton conversationId={props.conversationId} />
        </Flex>
      </Flex>
    </ChatSkinTheme>
  );
}

/** The control as it is offered — nothing has been asked of the server yet. */
function Offered(): ReactElement {
  return (
    <ChatDemoHarness socket="off">
      <LeftRow
        conversationId={MINE?.id ?? ""}
        leftAt={MINE?.left_at ?? ""}
        who={DEMO_COUNTERPART}
      />
    </ChatDemoHarness>
  );
}

/**
 * The refusal, on a thread this person is not a party to. The `play` step
 * presses the control, because the state this variant is FOR is one round trip
 * away and a static frame would photograph the button that summons it.
 */
function Refused(): ReactElement {
  return (
    <ChatDemoHarness
      socket="off"
      handlers={{
        "/rejoin": [403, { localizable_error: "error.403.chat_not_participant" }],
      }}
    >
      <LeftRow
        conversationId={NOT_MINE?.id ?? ""}
        leftAt={NOT_MINE?.left_at ?? ""}
        who={DEMO_STRANGER}
      />
    </ChatDemoHarness>
  );
}

export default defineDemo({
  id: "chat.rejoin",
  title: "Returning to a conversation (default skin)",
  description:
    "The undo of a departure (stapel-chat 0.8.6 POST /conversations/{id}/rejoin -> 204). It clears the caller's left_at and nothing else — read markers and updated_at are untouched, so the thread comes back with the badge it had and where the departure left it, not at the top of the inbox — which is why the pair re-reads the list instead of splicing the row in at a position it would have had to invent. It asks no confirmation: leaving is the half of this choice that needs a question, and putting a thread back on one list takes nothing from anybody.",
  component: RejoinConversationButton,
  tokens: ["surface-raised", "text", "text-muted", "error"],
  variants: {
    default: {
      description:
        "A row off the «Left» tab at phone width: when this person left, and the one control that thread has left to offer. The overflow menu is absent — its single entry was the exit they have already taken.",
      viewport: "phone",
      step: "offered",
      render: () => <Offered />,
    },
    refused: {
      description:
        "The one refusal this request has, on a thread the caller is not a party to: `error.403.chat_not_participant`, the same key GET and DELETE on that URL give them — because returning is an undo and never a door into a conversation nobody put you in. It is not retried (the answer is settled, and three round trips would buy the same sentence) and the control stays on screen underneath it, so a person is told rather than left pressing a button that visibly does nothing.",
      viewport: "phone",
      step: "refused",
      render: () => <Refused />,
      play: async ({ click, find }) => {
        await click('[data-testid="chat-rejoin"]');
        await find('[data-testid="chat-rejoin-error"]');
      },
    },
  },
});
