/** A thread: replay from the journal, plus the composer that appends to it. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, spacing, fontSize } from "@stapel/tokens";
import { matchList, useActionGate, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { ConversationThread, MessageComposer } from "../src/index.js";
import {
  ChatDemoHarness,
  DEMO_CONVERSATION,
  DEMO_MESSAGE_PAGE,
  DemoCard,
} from "./_harness.js";

function ComposerRow(props: {
  value: string;
  setValue: (next: string) => void;
  availability: ActionAvailability;
  send: () => void;
  length: number;
  maxLength: number;
}): ReactElement {
  const t = useT();
  const gate = useActionGate(props.availability);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing["2"] }}>
      <input
        value={props.value}
        onChange={(event) => props.setValue(event.target.value)}
        placeholder={t("chat.composer.placeholder")}
        style={{
          padding: spacing["2"],
          borderRadius: 4,
          border: `1px solid ${cssVar("border-subtle")}`,
          background: cssVar("surface-sunken"),
          color: cssVar("text"),
        }}
      />
      <div style={{ display: "flex", gap: spacing["2"], alignItems: "center" }}>
        <button
          disabled={gate.disabled}
          onClick={props.send}
          data-analytics="none"
          data-analytics-reason="headless demo action; the host instruments this"
          style={{
            background: cssVar("brand"),
            color: cssVar("text-on-accent"),
            border: "none",
            borderRadius: 4,
            padding: `${spacing["2"]}px ${spacing["4"]}px`,
          }}
        >
          {t("chat.composer.send")}
        </button>
        {gate.reason ? (
          <span style={{ color: cssVar("text-muted") }}>{gate.reason}</span>
        ) : null}
        <span style={{ marginLeft: "auto", color: cssVar("text-muted") }}>
          {`${props.length}/${props.maxLength}`}
        </span>
      </div>
    </div>
  );
}

function ThreadBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="ConversationThread">
      <ConversationThread conversationId={DEMO_CONVERSATION.id}>
        {({ state, transport }) => (
          <>
            <span style={{ color: cssVar("text-muted"), fontSize: fontSize.sm.fontSize }}>
              {t(
                transport === "socket"
                  ? "chat.transport.live"
                  : transport === "polling"
                    ? "chat.transport.polling"
                    : "chat.transport.idle"
              )}
            </span>
            {matchList(state, {
              loading: () => (
                <span style={{ color: cssVar("text-muted") }}>
                  {t("chat.thread.loading")}
                </span>
              ),
              failed: () => (
                <span style={{ color: cssVar("error") }}>{t("chat.error.unknown")}</span>
              ),
              empty: () => (
                <span style={{ color: cssVar("text-muted") }}>
                  {t("chat.thread.empty")}
                </span>
              ),
              ready: (messages) => (
                <ul style={{ margin: 0, padding: 0 }}>
                  {messages.map((message) => (
                    <li
                      key={message.id}
                      style={{
                        listStyle: "none",
                        padding: `${spacing["1"]}px 0`,
                        color:
                          message.kind === "system"
                            ? cssVar("text-muted")
                            : cssVar("text"),
                      }}
                    >
                      {message.body}
                    </li>
                  ))}
                </ul>
              ),
            })}
          </>
        )}
      </ConversationThread>
      <MessageComposer conversationId={DEMO_CONVERSATION.id}>
        {({ value, setValue, availability, send, length, maxLength }) => (
          <ComposerRow
            value={value}
            setValue={setValue}
            availability={availability}
            send={send}
            length={length}
            maxLength={maxLength}
          />
        )}
      </MessageComposer>
    </DemoCard>
  );
}

function ConversationThreadDemo(): ReactElement {
  return (
    <ChatDemoHarness
      handlers={{
        "/messages": DEMO_MESSAGE_PAGE,
        "/read": {},
      }}
    >
      <ThreadBody />
    </ChatDemoHarness>
  );
}

/**
 * The canned history is one page ending at `seq` 3, so the thread renders its
 * window and the composer starts blocked ("write something first") with the
 * reason readable beside the button — never a grey rectangle. The demo runs
 * with the socket transport off, which is the point of the seam: this screen
 * does not change when it is on.
 */
export default defineDemo({
  id: "chat.thread",
  title: "Conversation thread",
  description:
    "The headless ConversationThread renders a contiguous, seq-ordered window over the message journal, and MessageComposer appends to it over REST with a stated reason whenever sending is blocked.",
  component: ConversationThread,
  covers: ["MessageComposer"],
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <ConversationThreadDemo /> },
  },
});
