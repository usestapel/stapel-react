/**
 * "ASK THE SELLER" — the four canned questions, and the seam the press leaves
 * this pair through.
 *
 * The gap (REPORT §16, all four comparisons; inventory: "No canned
 * ask-the-seller quick-question prompts"): the reference puts four questions and a
 * free-text box on every listing, and this page had one primary and nothing
 * that starts a sentence for a reader who does not know how to open one.
 *
 * The chips are the pane's; the PRESS is not, and that is the load-bearing
 * half. `@stapel/chat-react`'s door takes no initial message — `StartDirectChat`
 * takes a seller and a subject, `useStartDirectChat` posts `{userId, subject}`,
 * `<MessageComposer>` opens on an empty string — so a chip that claimed to
 * "prefill the composer" would be inventing a seam the other pair does not
 * have. `onQuickQuestion` reports the text and the container seeds its own
 * composer; without it there is no block, because a chip that does nothing is
 * worse than no chip.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ListingDetailPane, QUICK_QUESTIONS_MAX } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { OWNER, detail, statusInfo } from "./fixtures.js";

function server() {
  return mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": { body: detail() },
  });
}

describe("the four questions a buyer starts with", () => {
  it("draws the pair's own defaults and reports the one pressed", async () => {
    const asked: string[] = [];
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          onQuickQuestion={(text) => {
            asked.push(text);
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-questions")).toBeTruthy();
    });
    const chips = screen.getAllByTestId("listings-detail-question");
    expect(chips).toHaveLength(QUICK_QUESTIONS_MAX);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Is it still available?",
      "Is the price negotiable?",
      "Can I come and see it?",
      "Do you deliver?",
    ]);
    // Above the door into the conversation, which is what a pressed chip
    // opens — never under it.
    const contact = screen.getByTestId("listings-detail-contact");
    expect(
      screen
        .getByTestId("listings-detail-questions")
        .compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(chips[1] as HTMLElement);
    expect(asked).toEqual(["Is the price negotiable?"]);
  });

  it("takes the host's own list, and never draws more than four", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          onQuickQuestion={() => undefined}
          quickQuestions={["Does it start?", "Any rust?", "Service book?", "Swap?", "Fifth"]}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-questions")).toBeTruthy();
    });
    const chips = screen.getAllByTestId("listings-detail-question");
    // A fifth does not lengthen the row on a phone — it wraps, and pushes the
    // page's one primary action a line further down.
    expect(chips).toHaveLength(QUICK_QUESTIONS_MAX);
    expect(chips[0]?.textContent).toBe("Does it start?");
  });

  it("draws nothing when nobody can act on a press, and nothing for the owner", async () => {
    const { unmount } = render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-contact")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-questions")).toBeNull();
    unmount();

    // The owner IS the person being asked.
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          viewerId={OWNER}
          onQuickQuestion={() => undefined}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-edit")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-questions")).toBeNull();
  });

  it("switches off wholesale on an empty list", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          onQuickQuestion={() => undefined}
          quickQuestions={[]}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-contact")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-questions")).toBeNull();
  });
});
