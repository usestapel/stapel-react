/**
 * REPORT AND BLOCK, from inside the thread — and the dialog rule they arrive
 * through.
 *
 * The two verbs belong to peer pairs (`@stapel/moderation-react`,
 * `@stapel/profiles-react`) that this one may not import, so they are
 * host-supplied slots. What this file pins is the part a host cannot get
 * wrong on its own:
 *
 *   - with neither slot wired the menu is STILL there and holds exactly one
 *     entry, because leaving is this pair's own verb (stapel-chat 0.8.5) and
 *     not a host's. It used to be absent in that state, on the rule that a
 *     menu opening onto nothing promises an action the deployment lacks —
 *     the rule stands, and the menu is no longer ever empty;
 *   - with a slot wired the menu opens as a BOTTOM SHEET on a phone and as a
 *     modal above it (the fleet rule, `@stapel/tokens-antd/skin`), which is
 *     asserted at both widths rather than assumed at one;
 *   - the slot is told which person the thread is with, so "block" has a
 *     target it did not have to guess — and it is not rendered AT ALL until
 *     there is one. The menu opens on the first paint, before
 *     `GET /conversations/` answers and while the header still has no
 *     counterparty, and the host entries used to be drawn in that gap with
 *     `counterpartyId: null`. So this samples the SETTLED props, and asserts
 *     separately that no render of either slot ever saw a null target.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { ConversationThreadPanel } from "../src/default/index.js";
import type {
  ChatSlots,
  ChatThreadActionSlotProps,
  Conversation,
} from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { BUYER, CONVERSATION_ID, SELLER, conversation, messagePage } from "./fixtures.js";

const DESK_WIDTH = 1024;
const PHONE_WIDTH = 390;

afterEach(() => {
  window.innerWidth = DESK_WIDTH;
});

function renderThread(slots: ChatSlots, row: Conversation = conversation()): void {
  const server = mockServer({
    "GET /messages": { body: messagePage([1, 2]) },
    "POST /read": { body: {} },
    "GET /conversations/": { body: row },
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
  it("holds this pair's own verb when the host wired neither of theirs", async () => {
    renderThread({});
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-message")).toHaveLength(2)
    );
    // The menu exists — leaving is stapel-chat's endpoint, not a slot — and
    // what it opens onto is exactly one control, not an empty sheet.
    screen.getByTestId("chat-thread-menu-open").click();
    await waitFor(() => expect(screen.getByTestId("chat-leave-open")).toBeTruthy());
    expect(screen.queryByTestId("host-report")).toBeNull();
    expect(screen.queryByTestId("host-block")).toBeNull();
  });

  it("opens as a MODAL above phone widths, carrying both verbs", async () => {
    window.innerWidth = DESK_WIDTH;
    const seen: ChatThreadActionSlotProps[] = [];
    renderThread({
      report: actionSlot("host-report", seen),
      block: actionSlot("host-block", seen),
    });
    // Opened on the FIRST paint — no `await` above this line, so
    // `GET /conversations/` has certainly not answered and the header still
    // has no counterparty. That frame is what CI caught and what the sampling
    // below is about; waiting first would only sometimes reproduce it, which
    // is how this passed here and went red there.
    screen.getByTestId("chat-thread-menu-open").click();
    await waitFor(() => expect(screen.getByTestId("host-report")).toBeTruthy());
    expect(screen.getByTestId("host-block")).toBeTruthy();
    expect(
      screen.getByTestId("chat-thread-menu").getAttribute("data-stapel-dialog-surface")
    ).toBe("modal");
    // The slot knows who it is about — a block with no target is a guess.
    await waitFor(() => expect(seen.at(-1)?.counterpartyId).toBe(SELLER));
    expect(seen.at(-1)?.viewerId).toBe(BUYER);
    expect(seen.at(-1)?.conversationId).toBe(CONVERSATION_ID);
    // And it never had to: not one render of either entry was handed a null
    // target, which is what "the entry waits for the conversation" means.
    // Asserting only the settled props would pass with the entry drawn onto
    // nothing first — the state this whole rule exists to remove.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((props) => props.counterpartyId !== null)).toBe(true);
  });

  it("withholds the host's verbs on a group — there is no single target", async () => {
    const seen: ChatThreadActionSlotProps[] = [];
    renderThread(
      {
        report: actionSlot("host-report", seen),
        block: actionSlot("host-block", seen),
      },
      conversation({
        kind: "group",
        participants: [
          { user_id: BUYER, role: "member", last_read_seq: 1 },
          { user_id: SELLER, role: "member", last_read_seq: 3 },
          { user_id: "u-third", role: "member", last_read_seq: 0 },
        ],
      })
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-message")).toHaveLength(2)
    );
    screen.getByTestId("chat-thread-menu-open").click();
    // The way off the thread is still offered — leaving needs no target — and
    // it is the only entry: "block them" among three people is a guess the
    // settled conversation cannot resolve either, so the wait never ends here
    // and the entry is simply not drawn.
    await waitFor(() => expect(screen.getByTestId("chat-leave-open")).toBeTruthy());
    expect(screen.queryByTestId("host-report")).toBeNull();
    expect(screen.queryByTestId("host-block")).toBeNull();
    expect(seen).toHaveLength(0);
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
