/**
 * The call control's GATE — the half chat owns.
 *
 * chat places no call. What it answers is "may these two people talk, about
 * this thing, right now", from the same axes `<StartDirectChat>` reads, and
 * every arm below is a refusal the server would otherwise deliver AFTER the
 * press — which is the one moment it is useless.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { useActionGate } from "@stapel/core";
import type { StartCallBag } from "../src/index.js";
import { StartCall } from "../src/headless/StartCall.js";
import { StartCallButton } from "../src/default/StartCallButton.js";
import { TestHarness, mockServer } from "./harness.js";

/** The gate as a screen sees it — through `useActionGate`, which is the one
 * reviewed reading of an `ActionAvailability` in the fleet. */
function Probe(props: { bag: StartCallBag }): ReactElement {
  const gate = useActionGate(props.bag.availability);
  return (
    <div>
      <span data-testid="available">{String(props.bag.availability.available)}</span>
      <span data-testid="reason">{gate.reason ?? ""}</span>
      <button type="button" data-testid="press" onClick={props.bag.call}>
        call
      </button>
    </div>
  );
}

const ME = "u-me";
const THEM = "u-them";
const THREAD = "conv-1";

function gate(props: Partial<Parameters<typeof StartCall>[0]> = {}): {
  onCall: ReturnType<typeof vi.fn>;
} {
  const onCall = vi.fn();
  const server = mockServer({});
  render(
    <TestHarness server={server}>
      <StartCall
        peerId={props.peerId === undefined ? THEM : props.peerId}
        viewerId={props.viewerId ?? ME}
        conversationId={props.conversationId === undefined ? THREAD : props.conversationId}
        {...(props.busy !== undefined ? { busy: props.busy } : {})}
        {...(props.pending !== undefined ? { pending: props.pending } : {})}
        {...(props.ensureConversation !== undefined
          ? { ensureConversation: props.ensureConversation }
          : {})}
        onCall={onCall}
      >
        {(bag) => <Probe bag={bag} />}
      </StartCall>
    </TestHarness>
  );
  return { onCall };
}

describe("who may press it", () => {
  it("is available for a signed-in person with a thread and a counterpart", () => {
    gate();
    expect(screen.getByTestId("available").textContent).toBe("true");
  });

  it("blocks with a reason when there is nobody to call", () => {
    // A button that cannot do anything is worse than an absent one, and a
    // greyed one with no sentence is worse still.
    gate({ peerId: null });
    expect(screen.getByTestId("available").textContent).toBe("false");
    // The RESOLVED sentence, not the key: a reason that renders as
    // `chat.call.blocked.unknown_peer` on somebody's screen is a missing
    // bundle entry, and asserting the key would pass straight through it.
    expect(screen.getByTestId("reason").textContent).toBe(
      "There is nobody to call here."
    );
  });

  it("blocks calling yourself", () => {
    gate({ peerId: ME });
    expect(screen.getByTestId("reason").textContent).toBe(
      "This is your own listing."
    );
  });

  it("blocks with no thread rather than being pressed into a 403", () => {
    // The server's authorizer REQUIRES a conversation: a user id is not a
    // phone number, and membership of a thread is what makes it one.
    gate({ conversationId: null });
    expect(screen.getByTestId("reason").textContent).toBe(
      "Open the conversation first, then call."
    );
  });

  it("blocks while this person is already on a call", () => {
    // The server answers 409 video_call_busy, correctly and uselessly after
    // the press. "You are already on a call" is invisible from a thread
    // header otherwise.
    gate({ busy: true });
    expect(screen.getByTestId("reason").textContent).toBe(
      "You are already on a call."
    );
  });

  it("blocks while a call is being placed, so a double tap places one", () => {
    gate({ pending: true });
    expect(screen.getByTestId("available").textContent).toBe("false");
  });
});

describe("the gate is not advisory", () => {
  it("does not call back while blocked", () => {
    // A host that wired the callback to its own control must not be able to
    // bypass the reason by pressing anyway.
    const { onCall } = gate({ busy: true });
    fireEvent.click(screen.getByTestId("press"));
    expect(onCall).not.toHaveBeenCalled();
  });

  it("hands back the peer and the thread when it is available", () => {
    const { onCall } = gate();
    fireEvent.click(screen.getByTestId("press"));
    expect(onCall).toHaveBeenCalledWith({ peerId: THEM, conversationId: THREAD });
  });
});

describe("the skinned button", () => {
  function draw(props: Partial<Parameters<typeof StartCallButton>[0]> = {}): ReactElement {
    const server = mockServer({});
    render(
      <TestHarness server={server}>
        <StartCallButton
          peerId={props.peerId === undefined ? THEM : props.peerId}
          viewerId={ME}
          conversationId={THREAD}
          {...(props.busy !== undefined ? { busy: props.busy } : {})}
          {...(props.compact !== undefined ? { compact: props.compact } : {})}
          onCall={props.onCall ?? (() => undefined)}
        />
      </TestHarness>
    );
    return <></>;
  }

  it("renders a pressable control", () => {
    draw();
    const button = screen.getByTestId("chat-call-button");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByTestId("chat-call-blocked")).toBeNull();
  });

  it("switches off WITH the sentence, never as a bare grey rectangle", () => {
    draw({ busy: true });
    expect(
      screen.getByTestId("chat-call-button").hasAttribute("disabled")
    ).toBe(true);
    expect(screen.getByTestId("chat-call-blocked")).toBeTruthy();
  });

  it("keeps an accessible name in the compact arm", () => {
    // An icon button with no name is announced as "button". The label carries
    // it whether or not the glyph replaces the text.
    draw({ compact: true });
    expect(
      screen.getByTestId("chat-call-button").getAttribute("aria-label")
    ).toBeTruthy();
  });
});

describe("a thread the press itself creates", () => {
  /**
   * On a listing page nobody has written to the seller yet, so there IS no
   * conversation — and "Call" is exactly what the person wants there. With
   * only `conversationId` to read, the control's one honest answer was
   * "open the conversation first", which left hosts hiding the button or
   * pre-creating an empty thread for every listing anyone looked at.
   */
  it("is pressable with no thread when the host can make one", () => {
    gate({ conversationId: null, ensureConversation: async () => "conv-new" });
    expect(screen.getByTestId("available").textContent).toBe("true");
    expect(screen.getByTestId("reason").textContent).toBe("");
  });

  it("makes the thread on the press and calls into the one it made", async () => {
    const made: string[] = [];
    const { onCall } = gate({
      conversationId: null,
      ensureConversation: async () => {
        made.push("asked");
        return "conv-new";
      },
    });
    fireEvent.click(screen.getByTestId("press"));
    await waitFor(() => {
      expect(onCall).toHaveBeenCalledWith({
        peerId: THEM,
        conversationId: "conv-new",
      });
    });
    expect(made).toEqual(["asked"]);
  });

  it("never asks when a thread is already in hand", () => {
    const ensure = vi.fn(async () => "conv-new");
    const { onCall } = gate({ ensureConversation: ensure });
    fireEvent.click(screen.getByTestId("press"));
    expect(onCall).toHaveBeenCalledWith({ peerId: THEM, conversationId: THREAD });
    expect(ensure).not.toHaveBeenCalled();
  });

  it("keeps every OTHER gate — the seam is not a bypass", () => {
    // A visitor with no identity, a missing counterpart and a call already in
    // progress still block before the press, which is the whole point of the
    // component.
    gate({
      conversationId: null,
      busy: true,
      ensureConversation: async () => "conv-new",
    });
    expect(screen.getByTestId("available").textContent).toBe("false");
    expect(screen.getByTestId("reason").textContent).toBe(
      "You are already on a call."
    );
  });

  it("places no call when nothing was made", async () => {
    // Resolving to nothing is a refusal, not a call with no thread — which is
    // the 403 this gate exists to avoid.
    const { onCall } = gate({
      conversationId: null,
      ensureConversation: async () => null,
    });
    fireEvent.click(screen.getByTestId("press"));
    await waitFor(() => {
      expect(screen.getByTestId("available").textContent).toBe("true");
    });
    expect(onCall).not.toHaveBeenCalled();
  });

  it("says on the page when making the thread failed", async () => {
    // A press that had to make the thread can fail before there is a call to
    // fail, and the gate's vocabulary cannot say that: a blocked REASON is a
    // fact that was true before the press.
    const server = mockServer({});
    render(
      <TestHarness server={server}>
        <StartCallButton
          peerId={THEM}
          viewerId={ME}
          conversationId={null}
          ensureConversation={async () => {
            throw new Error("no thread for you");
          }}
          onCall={() => undefined}
        />
      </TestHarness>
    );
    expect(
      screen.getByTestId("chat-call-button").hasAttribute("disabled")
    ).toBe(false);
    fireEvent.click(screen.getByTestId("chat-call-button"));
    await waitFor(() => {
      expect(screen.getByTestId("chat-call-failed")).toBeTruthy();
    });
  });
});
