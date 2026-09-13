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
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ListingDetailPane, QUICK_QUESTIONS_MAX } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { OWNER, detail, statusInfo } from "./fixtures.js";

afterEach(cleanup);

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
    // EVERY ONE OPENS WITH A GREETING (founder, 2026-09-13). The chip's whole
    // job is to become the first line of a message to a stranger, and these
    // four landed in somebody's inbox as bare interrogatives.
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Hello! Is it still available?",
      "Hello! Is the price negotiable?",
      "Hello! Can I come and see it?",
      "Hello! Do you deliver?",
    ]);
    // UNDER the door into the conversation, which is what a pressed chip
    // opens (2026-09-13). They spent a release above it, and on a 390px phone
    // four wrapping chips are a row and a half standing between the price and
    // the only two controls a buyer came for — the contact row then needed a
    // scroll on every listing. A chip is a shortcut INTO the conversation the
    // button opens, so it cannot usefully stand before the door.
    const contact = screen.getByTestId("listings-detail-contact");
    expect(
      contact.compareDocumentPosition(
        screen.getByTestId("listings-detail-questions")
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(chips[1] as HTMLElement);
    expect(asked).toEqual(["Hello! Is the price negotiable?"]);
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

/**
 * THE SET FOLLOWS WHAT THE LISTING IS ABOUT.
 *
 * The founder opened a job vacancy on the live site and was offered to ask the
 * hiring manager whether their vacancy was still for sale. Every listing on
 * the board — vacancies, services, flats — got a goods classified's four.
 *
 * WHAT THESE ASSERT: the sentences a reader is actually offered, per topic,
 * and that nothing on a vacancy asks about a sale or a delivery. Read as text
 * off the chips rather than as "the right key was passed", because a key
 * wired to the wrong catalogue entry type-checks.
 *
 * WHAT THEY CANNOT SEE: the chips are asserted in ENGLISH, which is the
 * catalogue's own default and the only locale this harness registers. That
 * the Russian and Spanish forms exist and are complete is
 * `i18n.test.ts`'s claim over the whole catalogue, not this file's; how the
 * longer sentences WRAP on a 390px phone is a browser fact and is asserted
 * nowhere here.
 */
describe("which questions a listing offers", () => {
  async function chipsFor(
    topic: Parameters<typeof ListingDetailPane>[0]["questionTopic"]
  ): Promise<readonly string[]> {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          onQuickQuestion={() => undefined}
          {...(topic !== undefined ? { questionTopic: topic } : {})}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-questions")).toBeTruthy();
    });
    return screen
      .getAllByTestId("listings-detail-question")
      .map((chip) => chip.textContent ?? "");
  }

  it("asks a vacancy whether it is still OPEN, and never whether it is for sale", async () => {
    const chips = await chipsFor("jobs");
    expect(chips[0]).toBe("Hello! Is the vacancy still open?");
    for (const chip of chips) {
      expect(chip).not.toContain("available");
      expect(chip).not.toContain("deliver");
      expect(chip).not.toContain("price");
    }
  });

  it("asks a service whether it is still PROVIDED", async () => {
    const chips = await chipsFor("services");
    expect(chips[0]).toBe("Hello! Do you still provide this service?");
    for (const chip of chips) expect(chip).not.toContain("deliver");
  });

  it("keeps the goods four for goods, for transport and for property", async () => {
    const goods = [
      "Hello! Is it still available?",
      "Hello! Is the price negotiable?",
      "Hello! Can I come and see it?",
      "Hello! Do you deliver?",
    ];
    expect(await chipsFor("goods")).toEqual(goods);
    cleanup();
    expect(await chipsFor("transport")).toEqual(goods);
    cleanup();
    expect(await chipsFor("realty")).toEqual(goods);
  });

  it("gives a host that states nothing exactly what it had", async () => {
    expect(await chipsFor(undefined)).toEqual([
      "Hello! Is it still available?",
      "Hello! Is the price negotiable?",
      "Hello! Can I come and see it?",
      "Hello! Do you deliver?",
    ]);
  });

  it("lets a host's own list win over every topic", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          questionTopic="jobs"
          quickQuestions={["Own question"]}
          onQuickQuestion={() => undefined}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-questions")).toBeTruthy();
    });
    expect(
      screen.getAllByTestId("listings-detail-question").map((chip) => chip.textContent)
    ).toEqual(["Own question"]);
  });
});
