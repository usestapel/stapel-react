/**
 * THE EMPTY ARM IS A SLOT, AND `null` IS ONE OF ITS ANSWERS.
 *
 * "No reviews yet" is the right sentence for a reviews PAGE and the wrong one
 * inside a card that has already said, in its own words, that this seller has
 * no reviews. Measured on a live storefront: the seller card's own empty line
 * and this pane's empty state, stacked forty pixels apart, saying the same
 * thing twice — and the workaround was a CSS rule hiding our test id, which
 * makes a pair's rendering a host's stylesheet's business.
 *
 * So the three cases are distinguished by identity, not by truthiness: absent
 * keeps the pair's own state, a node replaces it, `null` renders nothing. The
 * middle one matters as much as the last: a slot that can only be emptied is
 * half a slot.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ReviewListPanel, ReviewsPanel } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { TARGET, page, review } from "./fixtures.js";

const NO_REVIEWS = page([], { has_next: false });

function mountEmpty(emptyState?: ReactNode | null): void {
  render(
    <TestProviders server={mockServer({ "/reviews": { body: NO_REVIEWS } })}>
      <ReviewListPanel
        target={TARGET}
        {...(emptyState !== undefined ? { emptyState } : {})}
      />
    </TestProviders>
  );
}

/** The load arm has settled on "empty" — not still loading. */
async function settled(): Promise<HTMLElement> {
  return await waitFor(() => {
    const arm = document.querySelector<HTMLElement>(
      '[data-stapel-load-state="empty"]'
    );
    expect(arm).not.toBeNull();
    return arm as HTMLElement;
  });
}

describe("<ReviewListPanel emptyState>", () => {
  it("keeps the pair's own sentence when the host says nothing", async () => {
    mountEmpty();
    await settled();
    expect(screen.getByTestId("reviews-list-empty")).toBeTruthy();
    expect(screen.getByText("No reviews yet")).toBeTruthy();
  });

  it("renders NOTHING for `null` — the host's card already said it", async () => {
    mountEmpty(null);
    const arm = await settled();
    // The arm still exists (the list is empty, and that is a real state); it
    // just says nothing, so the card around it is not arguing with itself.
    expect(arm.textContent).toBe("");
    expect(screen.queryByTestId("reviews-list-empty")).toBeNull();
    expect(screen.queryByText("No reviews yet")).toBeNull();
    // …and `null` does not fall through to the SUBSTRATE's default empty
    // state either, which is what a nullish-coalescing slot would have done.
    expect(arm.querySelector(".ant-empty")).toBeNull();
  });

  it("renders the host's own node when it has one to give", async () => {
    mountEmpty(<p data-testid="host-empty">Be the first to review</p>);
    await settled();
    expect(screen.getByTestId("host-empty").textContent).toBe(
      "Be the first to review"
    );
    // Replaced, not stacked on top of.
    expect(screen.queryByTestId("reviews-list-empty")).toBeNull();
  });

  it("does not touch a list that HAS rows", async () => {
    render(
      <TestProviders
        server={mockServer({
          "/reviews": { body: page([review({ id: "r1" })]) },
        })}
      >
        <ReviewListPanel target={TARGET} emptyState={null} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-rows")).toBeTruthy();
    });
    expect(screen.getByText("Great")).toBeTruthy();
  });
});

describe("<ReviewsPanel emptyState> — the slot on the component hosts mount", () => {
  /**
   * `<ReviewListPanel>` had the slot and `<ReviewsPanel>` is what a listing
   * page actually mounts, so the storefront could not reach it: it hid
   * `reviews-list-empty` with a CSS rule instead, which is the pair rendering
   * something the host cannot decline — the exact defect the slot closed one
   * component down.
   */
  function mountPanel(emptyState?: ReactNode | null): void {
    render(
      <TestProviders server={mockServer({ "/reviews": { body: NO_REVIEWS } })}>
        <ReviewsPanel
          target={TARGET}
          canReview={false}
          {...(emptyState !== undefined ? { emptyState } : {})}
        />
      </TestProviders>
    );
  }

  it("keeps the pair's own sentence when the host says nothing", async () => {
    mountPanel();
    await settled();
    expect(screen.getByTestId("reviews-list-empty")).toBeTruthy();
  });

  it("forwards `null` — nothing is drawn, and no stylesheet is involved", async () => {
    mountPanel(null);
    const arm = await settled();
    expect(arm.textContent).toBe("");
    expect(screen.queryByTestId("reviews-list-empty")).toBeNull();
    expect(arm.querySelector(".ant-empty")).toBeNull();
  });

  it("forwards the host's own node", async () => {
    mountPanel(<p data-testid="host-empty">Be the first to review</p>);
    await settled();
    expect(screen.getByTestId("host-empty")).toBeTruthy();
    expect(screen.queryByTestId("reviews-list-empty")).toBeNull();
  });
});
