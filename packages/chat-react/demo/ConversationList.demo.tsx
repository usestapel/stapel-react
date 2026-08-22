/** The inbox — a headless load-more list with server-computed unread badges. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, spacing, fontSize } from "@stapel/tokens";
import { matchList, useErrorDisplay, useT } from "@stapel/core";
import { ConversationList } from "../src/index.js";
import type { Conversation } from "../src/index.js";
import {
  ChatDemoHarness,
  DEMO_CONVERSATION_PAGE,
  DemoActions,
  DemoButton,
  DemoCard,
} from "./_harness.js";

function Row(props: { conversation: Conversation }): ReactElement {
  const t = useT();
  const { conversation } = props;
  return (
    <li
      style={{
        listStyle: "none",
        padding: `${spacing["2"]}px 0`,
        borderTop: `1px solid ${cssVar("border-subtle")}`,
        display: "flex",
        justifyContent: "space-between",
        gap: spacing["3"],
      }}
    >
      <strong style={{ fontSize: fontSize.md.fontSize }}>
        {t("chat.kind.direct")}
      </strong>
      {conversation.unread_count > 0 ? (
        <span style={{ color: cssVar("link") }}>
          {t("chat.list.unread", { count: conversation.unread_count })}
        </span>
      ) : null}
    </li>
  );
}

function ListBody(): ReactElement {
  const t = useT();
  const errorDisplay = useErrorDisplay("chat.error.unknown");
  return (
    <DemoCard heading="ConversationList">
      <ConversationList>
        {({ state, refetch }) => (
          <>
            {matchList(state, {
              loading: () => (
                <span style={{ color: cssVar("text-muted") }}>
                  {t("chat.list.loading")}
                </span>
              ),
              failed: (error) => (
                <span style={{ color: cssVar("error") }}>
                  {errorDisplay(error)?.message}
                </span>
              ),
              empty: () => (
                <span style={{ color: cssVar("text-muted") }}>
                  {t("chat.list.empty")}
                </span>
              ),
              ready: (rows) => (
                <ul style={{ margin: 0, padding: 0 }}>
                  {rows.map((row) => (
                    <Row key={row.id} conversation={row} />
                  ))}
                </ul>
              ),
            })}
            <DemoActions>
              <DemoButton run={refetch} labelKey="demo.action.refresh" />
            </DemoActions>
          </>
        )}
      </ConversationList>
    </DemoCard>
  );
}

function ConversationListDemo(): ReactElement {
  return (
    <ChatDemoHarness handlers={{ "/conversations": DEMO_CONVERSATION_PAGE }}>
      <ListBody />
    </ChatDemoHarness>
  );
}

/**
 * The canned handler returns one page with a single unread thread, so the list
 * renders its badge and its caught-up end state. The list is kept fresh by the
 * transport seam's polling half — the module mounts no socket for the inbox.
 */
export default defineDemo({
  id: "chat.conversations",
  title: "Conversation list",
  description:
    "The headless ConversationList renders the caller's threads with server-computed unread counts, behind a LoadState a skin cannot flatten. Covers the provider that wires the runtime.",
  component: ConversationList,
  covers: ["ChatProvider"],
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <ConversationListDemo /> },
  },
});
