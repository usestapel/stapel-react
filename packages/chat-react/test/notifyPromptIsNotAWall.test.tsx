/**
 * THE NOTIFICATION ASK IS A LINE, NOT A WALL (D64, desktop walker P2).
 *
 * The ask used to be a modal sheet: it opened over the open thread a second
 * or two after the first message, and until it was answered `.ant-modal-wrap`
 * swallowed every click outside its own box — the composer, the message list,
 * the other conversation in the split. A walker run waited 30s at the input
 * and failed; a person just finds the page dead.
 *
 * A permission the product is ASKING FOR politely may not take the screen
 * hostage. So the ask renders in the thread's own flow, above the composer:
 *
 *  - no modal mask, no dialog surface, nothing intercepting pointer events
 *    outside its own box;
 *  - it lives inside the thread panel's DOM, not in a portal over it;
 *  - "Allow" still reaches the browser, "Not now" still dismisses WITHOUT
 *    spending the one refusal the browser grants.
 */
import type { PermissionBag, PermissionStatus } from "@stapel/core";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatNotificationsPrompt } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";

function bag(overrides: Partial<PermissionBag> = {}): PermissionBag {
  return {
    kind: "notifications",
    status: "prompt",
    supported: true,
    asking: false,
    request: async (): Promise<PermissionStatus> => "granted",
    refresh: () => {},
    ...overrides,
  };
}

/** The prompt at its value moment: the thread is loaded and a message has
 * arrived since. Rendered beside a stand-in composer, which is exactly what
 * the modal used to cover. */
function renderAsk(permission: PermissionBag = bag()) {
  const view = render(
    <TestHarness server={mockServer({})} realtime={{ socketUrl: null }}>
      <div>
        <ChatNotificationsPrompt lastSeq={1} ready permission={permission} />
        <button type="button" data-testid="behind-the-ask">
          send
        </button>
      </div>
    </TestHarness>
  );
  // The tide mark is taken on the first ready render; the ask opens when
  // `lastSeq` moves past it — a message exchanged, in either direction.
  view.rerender(
    <TestHarness server={mockServer({})} realtime={{ socketUrl: null }}>
      <div>
        <ChatNotificationsPrompt lastSeq={2} ready permission={permission} />
        <button type="button" data-testid="behind-the-ask">
          send
        </button>
      </div>
    </TestHarness>
  );
  return view;
}

describe("the notification ask does not take the screen hostage", () => {
  it("opens at the value moment", () => {
    renderAsk();
    expect(screen.queryByTestId("chat-notifications-prompt")).not.toBeNull();
  });

  it("draws no modal mask and no dialog surface — nothing to intercept a click", () => {
    renderAsk();
    expect(document.querySelector(".ant-modal-wrap")).toBeNull();
    expect(document.querySelector(".ant-drawer-mask")).toBeNull();
    expect(document.querySelector("[data-stapel-dialog-surface]")).toBeNull();
  });

  it("renders in the thread's own flow, not in a portal over it", () => {
    const { container } = renderAsk();
    expect(container.querySelector("[data-testid='chat-notifications-prompt']")).not.toBeNull();
  });

  it("the control behind it stays clickable while the ask stands", () => {
    const clicked = vi.fn();
    render(
      <TestHarness server={mockServer({})} realtime={{ socketUrl: null }}>
        <div>
          <ChatNotificationsPrompt lastSeq={1} ready permission={bag()} />
          <button type="button" data-testid="behind-the-ask" onClick={clicked}>
            send
          </button>
        </div>
      </TestHarness>
    );
    fireEvent.click(screen.getByTestId("behind-the-ask"));
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("Allow reaches the browser; dismissing does not spend the one refusal", async () => {
    const request = vi.fn(async (): Promise<PermissionStatus> => "granted");
    renderAsk(bag({ request }));
    fireEvent.click(screen.getByTestId("chat-notifications-allow"));
    expect(request).toHaveBeenCalledTimes(1);

    const dismissed = vi.fn(async (): Promise<PermissionStatus> => "granted");
    renderAsk(bag({ request: dismissed }));
    fireEvent.click(screen.getAllByTestId("chat-notifications-dismiss")[0] as HTMLElement);
    expect(dismissed).not.toHaveBeenCalled();
  });

  it("dismissal closes the ask", () => {
    renderAsk();
    fireEvent.click(screen.getByTestId("chat-notifications-dismiss"));
    expect(screen.queryByTestId("chat-notifications-prompt")).toBeNull();
  });
});
