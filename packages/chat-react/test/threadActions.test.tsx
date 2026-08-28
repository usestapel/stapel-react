/**
 * REPORT AND BLOCK, from inside the thread — and the dialog rule they arrive
 * through.
 *
 * The two verbs belong to peer pairs (`@stapel/moderation-react`,
 * `@stapel/profiles-react`) that this one may not import, so they are
 * host-supplied slots. What this file pins is the part a host cannot get
 * wrong on its own:
 *
 *   - with neither slot wired there is NO overflow control, because a menu
 *     that opens onto nothing promises an action the deployment lacks;
 *   - with a slot wired the menu opens as a BOTTOM SHEET on a phone and as a
 *     modal above it (the fleet rule, `@stapel/tokens-antd/skin`), which is
 *     asserted at both widths rather than assumed at one;
 *   - the slot is told which person the thread is with, so "block" has a
 *     target it did not have to guess.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { ConversationThreadPanel } from "../src/default/index.js";
import type { ChatSlots, ChatThreadActionSlotProps } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { BUYER, CONVERSATION_ID, SELLER, conversation, messagePage } from "./fixtures.js";

const DESK_WIDTH = 1024;
const PHONE_WIDTH = 390;

afterEach(() => {
  window.innerWidth = DESK_WIDTH;
});

function renderThread(slots: ChatSlots): void {
  const server = mockServer({
    "GET /messages": { body: messagePage([1, 2]) },
    "POST /read": { body: {} },
    "GET /conversations/": { body: conversation() },
  });
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }} slots={slots}>
      <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
    </TestHarness>
  );
}

/** Stands in for moderation-react's `ReportButton` / a profiles block control. */
function actionSlot(testId: string, seen: ChatThreadActionSlotProps[]) {
  return function Slot(props: ChatThreadActionSlotProps): ReactElement {
    seen.push(props);
    return (
      <button type="button" data-testid={testId} onClick={props.close}>
        {testId}
      </button>
    );
  };
}

describe("the thread's overflow menu", () => {
  it("is absent when the host wired neither verb", async () => {
    renderThread({});
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-message")).toHaveLength(2)
    );
    expect(screen.queryByTestId("chat-thread-menu-open")).toBeNull();
  });

  it("opens as a MODAL above phone widths, carrying both verbs", async () => {
    window.innerWidth = DESK_WIDTH;
    const seen: ChatThreadActionSlotProps[] = [];
    renderThread({
      report: actionSlot("host-report", seen),
      block: actionSlot("host-block", seen),
    });
    await waitFor(() =>
      expect(screen.getByTestId("chat-thread-menu-open")).toBeTruthy()
    );
    screen.getByTestId("chat-thread-menu-open").click();
    await waitFor(() => expect(screen.getByTestId("host-report")).toBeTruthy());
    expect(screen.getByTestId("host-block")).toBeTruthy();
    expect(
      screen.getByTestId("chat-thread-menu").getAttribute("data-stapel-dialog-surface")
    ).toBe("modal");
    // The slot knows who it is about — a block with no target is a guess.
    expect(seen[0]?.counterpartyId).toBe(SELLER);
    expect(seen[0]?.viewerId).toBe(BUYER);
    expect(seen[0]?.conversationId).toBe(CONVERSATION_ID);
  });

  it("opens as a BOTTOM SHEET on a phone", async () => {
    window.innerWidth = PHONE_WIDTH;
    renderThread({ report: actionSlot("host-report", []) });
    await waitFor(() =>
      expect(screen.getByTestId("chat-thread-menu-open")).toBeTruthy()
    );
    screen.getByTestId("chat-thread-menu-open").click();
    await waitFor(() => expect(screen.getByTestId("host-report")).toBeTruthy());
    expect(
      screen.getByTestId("chat-thread-menu").getAttribute("data-stapel-dialog-surface")
    ).toBe("sheet");
    // Only what the host wired is offered.
    expect(screen.queryByTestId("host-block")).toBeNull();
  });

  it("the trigger carries an accessible name — it is an icon", async () => {
    renderThread({ block: actionSlot("host-block", []) });
    await waitFor(() =>
      expect(screen.getByLabelText("Conversation options")).toBeTruthy()
    );
  });
});
