/**
 * The `/default` skin: the load arms reaching a screen, the two states that
 * must not look like each other (no reviews / not signed in), and the badge a
 * moderated row carries.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  RatingBadge,
  ReviewFormCard,
  ReviewListPanel,
  ReviewsPanel,
} from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import {
  DUPLICATE_400,
  FIRST_PAGE,
  RATED,
  TARGET,
  UNAUTHENTICATED_401,
  UNRATED,
  page,
  review,
} from "./fixtures.js";

describe("<RatingBadge>", () => {
  it("draws no star row at all for a target nobody has rated", async () => {
    render(
      <TestProviders server={mockServer({ "/reviews/aggregate": { body: UNRATED } })}>
        <RatingBadge target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-rating-none")).toBeTruthy();
    });
    expect(screen.getByText("No reviews yet")).toBeTruthy();
    // The whole point: antd's <Rate value={0}> would have drawn five empty
    // stars, which is the worst possible score, not "not rated".
    expect(screen.queryByTestId("reviews-rating-stars")).toBeNull();
  });

  it("draws the stars and both numbers for a rated target", async () => {
    render(
      <TestProviders server={mockServer({ "/reviews/aggregate": { body: RATED } })}>
        <RatingBadge target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-rating-stars")).toBeTruthy();
    });
    expect(screen.getByText("4.3 out of 5")).toBeTruthy();
    expect(screen.getByText("12 reviews")).toBeTruthy();
  });

  it("renders a supplied roll-up without asking the server anything", async () => {
    const server = mockServer({ "/reviews/aggregate": { body: RATED } });
    render(
      <TestProviders server={server}>
        <RatingBadge
          target={{ targetType: "seller", targetKey: "s1" }}
          aggregate={{ avg: 4.8, count: 137 }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByText("137 reviews")).toBeTruthy();
    });
    expect(server.calls).toHaveLength(0);
  });

  it("says 'sign in' rather than 'not rated' on a 401", async () => {
    render(
      <TestProviders
        server={mockServer({ "/reviews/aggregate": UNAUTHENTICATED_401 })}
      >
        <RatingBadge target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-rating-sign-in")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-rating-none")).toBeNull();
  });
});

describe("<ReviewListPanel>", () => {
  it("renders the rows, the owner's reply, and no raw author id", async () => {
    const server = mockServer({
      "/reviews": {
        body: page([
          review({
            id: "r1",
            author_id: "9f1c-secret-user-id",
            response: {
              author_id: "seller",
              body: "Thanks!",
              created_at: "2026-08-21T10:00:00Z",
            },
          }),
        ]),
      },
    });
    render(
      <TestProviders server={server}>
        <ReviewListPanel target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-rows")).toBeTruthy();
    });
    expect(screen.getByTestId("reviews-row-response")).toBeTruthy();
    expect(screen.getByText("A customer")).toBeTruthy();
    expect(screen.queryByText("9f1c-secret-user-id")).toBeNull();
  });

  it("badges a pending row, a hidden row and a state it does not know", async () => {
    const server = mockServer({
      "/reviews": {
        body: page([
          review({ id: "p", status: "pending" }),
          review({ id: "h", status: "hidden" }),
          review({ id: "q", status: "quarantined" }),
        ]),
      },
    });
    render(
      <TestProviders server={server}>
        <ReviewListPanel target={TARGET} include="all" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-row-pending")).toBeTruthy();
    });
    expect(screen.getByTestId("reviews-row-hidden")).toBeTruthy();
    expect(screen.getByText("Unknown state: quarantined")).toBeTruthy();
  });

  it("shows the empty state only for a READY empty list", async () => {
    render(
      <TestProviders server={mockServer({ "/reviews": { body: page([]) } })}>
        <ReviewListPanel target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-empty")).toBeTruthy();
    });
  });

  it("shows 'sign in to read the reviews' on a 401, never the empty state", async () => {
    render(
      <TestProviders server={mockServer({ "/reviews": UNAUTHENTICATED_401 })}>
        <ReviewListPanel target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-sign-in")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-list-empty")).toBeNull();
    expect(screen.queryByTestId("reviews-list-failed")).toBeNull();
  });

  it("renders a refusal with a retry on a real outage", async () => {
    render(
      <TestProviders
        server={mockServer({
          "/reviews": { status: 503, body: { localizable_error: "stapel.http.503" } },
        })}
      >
        <ReviewListPanel target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-failed")).toBeTruthy();
    });
  });

  it("switches the load-more control off WITH a reason at the end of the run", async () => {
    render(
      <TestProviders server={mockServer({ "/reviews": { body: page([review()]) } })}>
        <ReviewListPanel target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-load-more-reason")).toBeTruthy();
    });
    expect(screen.getByText("That is all of them")).toBeTruthy();
  });
});

describe("<ReviewFormCard>", () => {
  it("blocks submit with a readable reason until a rating is chosen", () => {
    render(
      <TestProviders server={mockServer({})}>
        <ReviewFormCard target={TARGET} />
      </TestProviders>
    );
    expect(screen.getByText("Choose a rating first")).toBeTruthy();
  });

  it("collapses into the 'already rated' note when the host says so", () => {
    render(
      <TestProviders server={mockServer({})}>
        <ReviewFormCard target={TARGET} alreadyReviewed />
      </TestProviders>
    );
    expect(screen.getByTestId("reviews-form-duplicate")).toBeTruthy();
    expect(screen.queryByTestId("reviews-form-submit")).toBeNull();
  });

  it("turns the 400 duplicate into the same note, not an error banner", async () => {
    render(
      <TestProviders server={mockServer({ "POST /reviews": DUPLICATE_400 })}>
        <ReviewFormCard target={TARGET} />
      </TestProviders>
    );
    const stars = screen
      .getByTestId("reviews-form-rate")
      .querySelectorAll<HTMLElement>("div[role='radio']");
    const last = stars[stars.length - 1];
    expect(last).toBeTruthy();
    if (last) fireEvent.click(last);
    fireEvent.click(screen.getByTestId("reviews-form-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("reviews-form-duplicate")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-form-failed")).toBeNull();
  });
});

describe("<ReviewsPanel>", () => {
  it("composes the rating, the list and the form off ONE list request", async () => {
    const server = mockServer({
      "/reviews/aggregate": { body: RATED },
      "/reviews": { body: FIRST_PAGE },
    });
    render(
      <TestProviders server={server}>
        <ReviewsPanel target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-rows")).toBeTruthy();
    });
    expect(screen.getByTestId("reviews-form")).toBeTruthy();
    // The panel reads the list twice (rows + own-review pre-check) through
    // the same query key: a cache hit, not a second request.
    const listCalls = server.calls.filter(
      (call) => !call.url.includes("/aggregate")
    );
    expect(listCalls).toHaveLength(1);
  });

  it("does not offer the form to the viewer whose review is already there", async () => {
    const server = mockServer({
      "/reviews/aggregate": { body: RATED },
      "/reviews": { body: page([review({ author_id: "me" })]) },
    });
    render(
      <TestProviders server={server}>
        <ReviewsPanel target={TARGET} viewerId="me" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-form-duplicate")).toBeTruthy();
    });
  });

  it("hides the form entirely when the host says this reader may not review", async () => {
    const server = mockServer({
      "/reviews/aggregate": { body: RATED },
      "/reviews": { body: FIRST_PAGE },
    });
    render(
      <TestProviders server={server}>
        <ReviewsPanel target={TARGET} canReview={false} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-rows")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-form")).toBeNull();
  });
});
