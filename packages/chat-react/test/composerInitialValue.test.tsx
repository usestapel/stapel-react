/**
 * THE QUESTION SOMEBODY ALREADY CHOSE.
 *
 * `@stapel/listings-react` 0.30.0 put four canned questions above a listing's
 * contact control, and the press had nowhere to land: the text travelled in
 * router state, the thread opened on an empty composer, and the person retyped
 * the sentence they had just picked. `initialValue` is the landing place, and
 * the three properties that make it a seed rather than a controlled value are
 * asserted here.
 *
 *   1. it SEEDS the box — the sentence is on screen, sendable, before anyone
 *      has typed a character;
 *   2. it is NOT an interaction — `pristine` stays true, so the composer is
 *      neutral exactly as an empty untouched one is. A seeded box that printed
 *      a refusal (or that had already "failed" something) would be the product
 *      blaming the reader for a sentence the product wrote;
 *   3. it seeds ONCE. A later value is ignored, because a prop that kept
 *      writing into the box would overwrite what the person had typed since —
 *      on a parent re-render nothing on screen caused.
 *
 * And the skin half: `<ConversationThreadPanel initialText>` is what a thread
 * screen passes, and the textarea is what it has to reach.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { MessageComposer } from "../src/index.js";
import { ConversationThreadPanel } from "../src/default/index.js";
import type { MessageComposerBag } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { BUYER, CONVERSATION_ID, conversation, messagePage } from "./fixtures.js";

/** The bag's three answers, on screen. */
function Bag(props: { readonly bag: MessageComposerBag }): React.ReactElement {
  return (
    <div>
      <span data-testid="value">{props.bag.value}</span>
      <span data-testid="pristine">{String(props.bag.pristine)}</span>
      <span data-testid="blocked">{String(!props.bag.availability.available)}</span>
    </div>
  );
}

function renderHeadless(initialValue?: string): void {
  const server = mockServer({});
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <MessageComposer
        conversationId={CONVERSATION_ID}
        {...(initialValue !== undefined ? { initialValue } : {})}
      >
        {(bag) => <Bag bag={bag} />}
      </MessageComposer>
    </TestHarness>
  );
}

describe("<MessageComposer initialValue>", () => {
  it("opens with the sentence already in the box", () => {
    renderHeadless("Is it still available?");
    expect(screen.getByTestId("value").textContent).toBe("Is it still available?");
  });

  it("is not an interaction: the composer stays pristine and unblocked", () => {
    renderHeadless("Is it still available?");
    // Pristine, so no refusal is printed under a box nobody has addressed —
    // and NOT blocked, because there is something to send: the seed is a
    // message, not a placeholder.
    expect(screen.getByTestId("pristine").textContent).toBe("true");
    expect(screen.getByTestId("blocked").textContent).toBe("false");
  });

  it("without it the box is empty and the send is blocked, as before", () => {
    renderHeadless();
    expect(screen.getByTestId("value").textContent).toBe("");
    expect(screen.getByTestId("pristine").textContent).toBe("true");
    expect(screen.getByTestId("blocked").textContent).toBe("true");
  });

  it("seeds ONCE — a later value never overwrites what is in the box", async () => {
    function Rerenderer(): React.ReactElement {
      const [seed, setSeed] = useState("first question");
      return (
        <>
          <button type="button" onClick={() => setSeed("second question")}>
            change the seed
          </button>
          <MessageComposer conversationId={CONVERSATION_ID} initialValue={seed}>
            {(bag) => <Bag bag={bag} />}
          </MessageComposer>
        </>
      );
    }
    render(
      <TestHarness server={mockServer({})} realtime={{ socketUrl: null }}>
        <Rerenderer />
      </TestHarness>
    );
    expect(screen.getByTestId("value").textContent).toBe("first question");
    screen.getByRole("button", { name: "change the seed" }).click();
    await waitFor(() =>
      expect(screen.getByTestId("value").textContent).toBe("first question")
    );
  });
});

describe("<ConversationThreadPanel initialText>", () => {
  it("lands the quick question in the thread's own textarea", async () => {
    const server = mockServer({
      "GET /conversations/": { body: conversation() },
      "GET /messages": { body: messagePage([1, 2]) },
      "POST /read": { body: {} },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationThreadPanel
          conversationId={CONVERSATION_ID}
          viewerId={BUYER}
          initialText="Is it still available?"
        />
      </TestHarness>
    );
    const box = await waitFor(() => {
      const found = document.querySelector("textarea");
      if (found === null) throw new Error("no composer");
      return found;
    });
    expect(box.value).toBe("Is it still available?");
  });
});
