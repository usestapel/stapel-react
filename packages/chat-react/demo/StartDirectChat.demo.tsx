/** "Message the seller" — one press, one thread, however many times pressed. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, spacing } from "@stapel/tokens";
import { useActionGate, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { StartDirectChat } from "../src/index.js";
import { ChatDemoHarness, DEMO_CONVERSATION, DemoCard } from "./_harness.js";

function StartRow(props: {
  availability: ActionAvailability;
  start: () => void;
  opened: boolean;
}): ReactElement {
  const t = useT();
  const gate = useActionGate(props.availability);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing["2"] }}>
      <button
        disabled={gate.disabled}
        onClick={props.start}
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
        {t("chat.start.button")}
      </button>
      {gate.reason ? (
        <span style={{ color: cssVar("text-muted") }}>{gate.reason}</span>
      ) : null}
      {props.opened ? (
        <span style={{ color: cssVar("text-muted") }}>{t("chat.kind.direct")}</span>
      ) : null}
    </div>
  );
}

function StartBody(props: { sellerId: string | null; viewerId: string }): ReactElement {
  return (
    <DemoCard heading="StartDirectChat">
      <StartDirectChat sellerId={props.sellerId} viewerId={props.viewerId}>
        {({ availability, start, conversation }) => (
          <StartRow
            availability={availability}
            start={start}
            opened={conversation !== undefined}
          />
        )}
      </StartDirectChat>
    </DemoCard>
  );
}

function StartDirectChatDemo(props: {
  sellerId: string | null;
  viewerId: string;
}): ReactElement {
  return (
    <ChatDemoHarness handlers={{ "/conversations": DEMO_CONVERSATION }}>
      <StartBody sellerId={props.sellerId} viewerId={props.viewerId} />
    </ChatDemoHarness>
  );
}

/**
 * Three variants, because the interesting half of this control is when it is
 * switched OFF and has to say why: a seller to write to, no seller on the
 * listing, and the viewer's own listing.
 */
export default defineDemo({
  id: "chat.start",
  title: "Message the seller",
  description:
    "The headless StartDirectChat opens the direct thread with a person — get-or-create, keyed by the participant pair, so pressing twice cannot fan out into two threads. Blocked states carry a readable reason instead of a grey button.",
  component: StartDirectChat,
  // The action name this pair contributes to a host's auto-anonymous list.
  // It is a constant, not a component, so it has no surface of its own — but
  // it belongs to this demo: "start a direct chat" is the act a host names
  // when it decides a guest may be minted for it.
  covers: ["CHAT_ELEVATION_ACTIONS"],
  tokens: ["card-bg", "card-border"],
  variants: {
    default: {
      render: () => (
        <StartDirectChatDemo sellerId="u-seller" viewerId="u-buyer" />
      ),
    },
    "no-seller": {
      render: () => <StartDirectChatDemo sellerId={null} viewerId="u-buyer" />,
    },
    "own-listing": {
      render: () => (
        <StartDirectChatDemo sellerId="u-buyer" viewerId="u-buyer" />
      ),
    },
  },
});
