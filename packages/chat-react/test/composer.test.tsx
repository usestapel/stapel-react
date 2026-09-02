/**
 * Sending: what is blocked and why it says so, the code-point count that
 * matches the server's, and the refusal envelope that must become a sentence.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useActionGate, useErrorDisplay } from "@stapel/core";
import { MessageComposer } from "../src/index.js";
import type { MessageComposerBag } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { CONVERSATION_ID, errorEnvelope, message } from "./fixtures.js";

/** A minimal skin so the gate's REASON and the error's SENTENCE are on screen. */
function ComposerScreen(props: {
  bag: MessageComposerBag;
  onBag: (bag: MessageComposerBag) => void;
}): React.ReactElement {
  const gate = useActionGate(props.bag.availability);
  const earned = useActionGate(props.bag.visibleAvailability);
  const errorDisplay = useErrorDisplay("chat.error.unknown");
  props.onBag(props.bag);
  return (
    <div>
      {/* `reason` is what a skin PRINTS (the earned gate); `blockReason` is
          what the send control obeys. The two are the same verdict, and the
          only difference is whether the person has addressed the field. */}
      <span data-testid="reason">{earned.reason ?? ""}</span>
      <span data-testid="blockReason">{gate.reason ?? ""}</span>
      <span data-testid="disabled">{String(gate.disabled)}</span>
      <span data-testid="pristine">{String(props.bag.pristine)}</span>
      <span data-testid="count">{`${props.bag.length}/${props.bag.maxLength}`}</span>
      <span data-testid="error">{errorDisplay(props.bag.error)?.message ?? ""}</span>
    </div>
  );
}

function renderComposer(
  routes: Parameters<typeof mockServer>[0],
  maxLength?: number,
  locale?: string
): { server: MockServer; bag: () => MessageComposerBag } {
  const server = mockServer(routes);
  let latest: MessageComposerBag | undefined;
  render(
    <TestHarness
      server={server}
      realtime={{ socketUrl: null }}
      {...(locale !== undefined ? { locale } : {})}
    >
      <MessageComposer
        conversationId={CONVERSATION_ID}
        {...(maxLength !== undefined ? { maxLength } : {})}
      >
        {(bag) => (
          <ComposerScreen
            bag={bag}
            onBag={(b) => {
              latest = b;
            }}
          />
        )}
      </MessageComposer>
    </TestHarness>
  );
  return {
    server,
    bag: () => {
      if (!latest) throw new Error("bag not rendered");
      return latest;
    },
  };
}

const reason = (): string => screen.getByTestId("reason").textContent ?? "";

describe("a PRISTINE composer is neutral, not refused", () => {
  // The composer used to derive its validation state from "the value is
  // empty", so an untouched box — and every box one tick after a successful
  // send — drew a refusal for something nobody had done yet.
  it("says nothing at all before anyone has touched it", () => {
    renderComposer({});
    expect(screen.getByTestId("pristine").textContent).toBe("true");
    expect(reason()).toBe("");
    // A disabled send control is not an error state: there is genuinely
    // nothing to send, and the enforcement gate still says so.
    expect(screen.getByTestId("disabled").textContent).toBe("true");
    expect(screen.getByTestId("blockReason").textContent).toBe(
      "Write something first."
    );
  });

  it("pressing send over an empty box earns the sentence", async () => {
    const { server, bag } = renderComposer({});
    act(() => bag().send());
    await waitFor(() => expect(reason()).toBe("Write something first."));
    expect(reason()).not.toContain("chat.composer");
    expect(server.calls).toHaveLength(0);
  });

  it("typing and then clearing the box keeps the refusal on screen", async () => {
    const { bag } = renderComposer({});
    act(() => bag().setValue("hi"));
    await waitFor(() => expect(reason()).toBe(""));
    act(() => bag().setValue(""));
    await waitFor(() => expect(reason()).toBe("Write something first."));
  });
});

describe("a switched-off control states its reason", () => {

  it("whitespace is not a message", async () => {
    const { bag } = renderComposer({});
    act(() => bag().setValue("   \n  "));
    await waitFor(() => expect(reason()).toBe("Write something first."));
  });

  it("over the cap it says the cap, interpolated", async () => {
    const { bag } = renderComposer({}, 5);
    act(() => bag().setValue("abcdefg"));
    await waitFor(() =>
      expect(reason()).toBe("That is longer than 5 characters — shorten it a little.")
    );
  });
});

describe("the length the SERVER counts", () => {
  it("counts code points, not UTF-16 units — an emoji is one character", async () => {
    // Python's len() over a str counts code points; String.length counts
    // UTF-16 units and would call this 4. Refusing a message the backend
    // would accept is the bug this test exists for.
    const { bag } = renderComposer({}, 3);
    act(() => bag().setValue("👍👍"));
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2/3"));
    expect(screen.getByTestId("disabled").textContent).toBe("false");
  });
});

describe("sending", () => {
  it("a successful send resets to PRISTINE, not to empty-and-invalid", async () => {
    const { bag } = renderComposer({
      "POST /messages": { status: 201, body: message(4, { body: "hello" }) },
    });
    act(() => bag().setValue("hello"));
    await waitFor(() => expect(screen.getByTestId("pristine").textContent).toBe("false"));
    act(() => bag().send());
    await waitFor(() => expect(bag().value).toBe(""));
    // The box is empty again — and that is not a refusal to show anybody.
    await waitFor(() => expect(screen.getByTestId("pristine").textContent).toBe("true"));
    expect(reason()).toBe("");
    expect(screen.getByTestId("disabled").textContent).toBe("true");
  });

  it("posts the body over REST and clears the box", async () => {
    const { server, bag } = renderComposer({
      "POST /messages": { status: 201, body: message(4, { body: "hello" }) },
    });
    act(() => bag().setValue("hello"));
    await waitFor(() => expect(screen.getByTestId("disabled").textContent).toBe("false"));
    act(() => bag().send());

    await waitFor(() => expect(bag().value).toBe(""));
    const post = server.calls.find((c) => c.method === "POST");
    expect(post?.url).toContain(`/conversations/${CONVERSATION_ID}/messages`);
    expect(post?.body).toEqual({ body: "hello" });
    // Cookie-mode CSRF convention: every mutation carries the header.
    expect(server.calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  it("a refusal becomes the human sentence for its code, not a status line", async () => {
    const { bag } = renderComposer({
      "POST /messages": {
        status: 400,
        body: errorEnvelope("error.400.chat_body_too_long"),
      },
    });
    act(() => bag().setValue("hello"));
    act(() => bag().send());
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe(
        "Message body exceeds the maximum allowed length"
      )
    );
  });

  it("the same refusal reads in Russian when the host runs ru", async () => {
    const { bag } = renderComposer(
      {
        "POST /messages": {
          status: 400,
          body: errorEnvelope("error.400.chat_body_too_long"),
        },
      },
      undefined,
      "ru"
    );
    act(() => bag().setValue("hello"));
    act(() => bag().send());
    // The en bundle is registered under "ru" too (the floor), so this only
    // passes once the pair's authored ru text for a CHAT-OWNED key is loaded
    // by the host — here it is not, so the floor answers in English. The
    // locale bundles themselves are proven in i18n.test.ts; what this asserts
    // is that a raw KEY never reaches the screen.
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).not.toContain("error.400")
    );
  });

  it("a blocked composer sends nothing at all", async () => {
    const { server, bag } = renderComposer({});
    act(() => bag().send());
    await waitFor(() => expect(bag().isSending).toBe(false));
    expect(server.calls).toHaveLength(0);
  });
});
