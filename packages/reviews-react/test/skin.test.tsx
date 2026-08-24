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
  ReviewModerationPanel,
  ReviewResponseComposer,
  ReviewsPanel,
} from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import {
  ALREADY_RESPONDED_409,
  DUPLICATE_400,
  FIRST_PAGE,
  FORBIDDEN_403,
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
    // A DIFFERENT sentence from the review LIST's "No reviews yet". Both
    // absences render on any page that mounts the aggregate above the list —
    // the storefront's listing page printed the identical words twice, forty
    // pixels apart, and it read as a rendering bug rather than as two facts.
    expect(screen.getByText("No rating yet")).toBeTruthy();
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

  it("has no sign-in arm at all — the aggregate is AllowAny since 0.3.0", async () => {
    render(
      <TestProviders server={mockServer({ "/reviews/aggregate": { body: UNRATED } })}>
        <RatingBadge target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-rating-none")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-rating-sign-in")).toBeNull();
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

  it("shows a guest the rows, and never a sign-in wall", async () => {
    // The harness mounts no session manager — the storefront guest case. The
    // list is IsAuthenticatedOrReadOnly since 0.3.0, so the reviews are the
    // content, not something behind a prompt.
    render(
      <TestProviders server={mockServer({ "/reviews": { body: FIRST_PAGE } })}>
        <ReviewListPanel target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-rows")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-list-sign-in")).toBeNull();
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
    const { container } = render(
      <TestProviders server={mockServer({ "/reviews": { body: page([review()]) } })}>
        <ReviewListPanel target={TARGET} />
      </TestProviders>
    );
    // The reason is the substrate's, now: `GatedButton` renders it as visible
    // text and points the button's aria-describedby at it. Never a tooltip —
    // a disabled antd Button fires none of the events one listens for.
    await waitFor(() => {
      expect(container.querySelector("[data-stapel-gated-reason]")).toBeTruthy();
    });
    expect(screen.getByText("That is all of them")).toBeTruthy();
    const wrapper = screen.getByTestId("reviews-load-more-gate");
    expect(wrapper.getAttribute("data-stapel-gated")).toBe("blocked");
    const button = screen.getByTestId("reviews-load-more");
    const reason = container.querySelector("[data-stapel-gated-reason]");
    expect(button.getAttribute("aria-describedby")).toBe(reason?.id);
  });

  it("says 'you asked for all, you got published' instead of implying a whole list", async () => {
    // The view narrows a non-moderator's include=all to published SILENTLY —
    // no error, no marker in the body — so a pane that trusted the request
    // showed a short list as if it were the whole thing (audit RV-4).
    render(
      <TestProviders server={mockServer({ "/reviews": { body: page([review()]) } })}>
        <ReviewListPanel target={TARGET} include="all" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-narrowed")).toBeTruthy();
    });
  });

  it("stays quiet about the scope when a hidden row PROVES the grant", async () => {
    render(
      <TestProviders
        server={mockServer({
          "/reviews": { body: page([review(), review({ id: "h", status: "hidden" })]) },
        })}
      >
        <ReviewListPanel target={TARGET} include="all" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-row-hidden")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-list-narrowed")).toBeNull();
  });

  it("stays quiet about the scope for a declared moderator with nothing hidden", async () => {
    render(
      <TestProviders server={mockServer({ "/reviews": { body: page([review()]) } })}>
        <ReviewListPanel target={TARGET} include="all" canModerate />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-rows")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-list-narrowed")).toBeNull();
  });

  it("dates every review without a host slot, and never as a raw ISO string", async () => {
    render(
      <TestProviders server={mockServer({ "/reviews": { body: page([review()]) } })}>
        <ReviewListPanel target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list-rows")).toBeTruthy();
    });
    const rows = screen.getByTestId("reviews-list-rows");
    expect(rows.textContent).not.toContain("2026-08-20T10:00:00Z");
    expect(rows.textContent).toContain("2026");
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

  it("says 'sign in to leave a review' when the POST answers 401", async () => {
    // The last home of that state: the reads are anonymous, the write is not
    // (there has to be an author to attribute the review to).
    render(
      <TestProviders server={mockServer({ "POST /reviews": UNAUTHENTICATED_401 })}>
        <ReviewFormCard target={TARGET} />
      </TestProviders>
    );
    const stars = screen
      .getByTestId("reviews-form-rate")
      .querySelectorAll<HTMLElement>("div[role='radio']");
    const star = stars[stars.length - 1];
    expect(star).toBeTruthy();
    if (star) fireEvent.click(star);
    fireEvent.click(screen.getByTestId("reviews-form-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("reviews-form-sign-in")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-form-failed")).toBeNull();
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

describe("<ReviewModerationPanel>", () => {
  it("badges every state and gates each verdict on where the row stands", async () => {
    const server = mockServer({
      "/reviews": {
        body: page([
          review({ id: "p", status: "pending" }),
          review({ id: "h", status: "hidden" }),
        ]),
      },
    });
    render(
      <TestProviders server={server}>
        <ReviewModerationPanel target={TARGET} canModerate />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-moderation-rows")).toBeTruthy();
    });
    expect(screen.getByTestId("reviews-row-pending")).toBeTruthy();
    expect(screen.getByTestId("reviews-row-hidden")).toBeTruthy();
    // Re-applying the state a row is already in is an upstream no-op that
    // answers 200 — a button that appears to do nothing. Blocked BEFORE the
    // click, with the fact as its reason.
    expect(screen.getByText("Already hidden")).toBeTruthy();
  });

  it("switches both verdicts off with a reason when the host declares no moderator", async () => {
    render(
      <TestProviders
        server={mockServer({ "/reviews": { body: page([review()]) } })}
      >
        <ReviewModerationPanel target={TARGET} canModerate={false} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-moderation-rows")).toBeTruthy();
    });
    // Not removed: a moderator whose can_moderate callback is mis-wired needs
    // to see the control refused, not a pane with no buttons on it.
    expect(screen.getByTestId("reviews-moderation-hide")).toBeTruthy();
    expect(
      screen.getAllByText(
        "Only a moderator of this item can hide or publish reviews"
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("reviews-moderation-narrowed")).toBeTruthy();
  });

  it("publishes a pending row and reports the status the SERVER answered with", async () => {
    const server = mockServer({
      "POST /moderate": { body: review({ id: "p", status: "published" }) },
      "/reviews": { body: page([review({ id: "p", status: "pending" })]) },
    });
    render(
      <TestProviders server={server}>
        <ReviewModerationPanel target={TARGET} canModerate />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-moderation-rows")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("reviews-moderation-publish"));
    await waitFor(() => {
      expect(screen.getByTestId("reviews-moderation-settled")).toBeTruthy();
    });
    const posted = server.calls.find((call) => call.method === "POST");
    expect(posted?.url).toContain("/reviews/p/moderate");
    expect(posted?.body).toEqual({ action: "publish" });
  });

  it("asks before hiding, because hiding also takes the review out of the rating", async () => {
    const server = mockServer({
      "POST /moderate": { body: review({ id: "r1", status: "hidden" }) },
      "/reviews": { body: page([review({ id: "r1" })]) },
    });
    render(
      <TestProviders server={server}>
        <ReviewModerationPanel target={TARGET} canModerate />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-moderation-rows")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("reviews-moderation-hide"));
    // Nothing has been sent yet — the confirmation is the surface, and on a
    // phone it is a bottom sheet (SkinConfirm), never a Popconfirm.
    expect(server.calls.some((call) => call.method === "POST")).toBe(false);
    await waitFor(() => {
      expect(screen.getByTestId("stapel-confirm-ok")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("stapel-confirm-ok"));
    await waitFor(() => {
      expect(server.calls.some((call) => call.method === "POST")).toBe(true);
    });
    const posted = server.calls.find((call) => call.method === "POST");
    expect(posted?.body).toEqual({ action: "hide" });
  });

  it("says the server refused the verdict, and does not call it a crash", async () => {
    const server = mockServer({
      "POST /moderate": FORBIDDEN_403,
      "/reviews": { body: page([review({ id: "p", status: "pending" })]) },
    });
    render(
      <TestProviders server={server}>
        <ReviewModerationPanel target={TARGET} canModerate />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-moderation-rows")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("reviews-moderation-publish"));
    await waitFor(() => {
      // BOTH verdicts on that row carry it: the 403 is a statement about the
      // actor, not about the button that happened to provoke it.
      expect(
        screen.getAllByText(
          "The server does not accept you as a moderator of this item"
        )
      ).toHaveLength(2);
    });
    expect(screen.queryByTestId("reviews-moderation-failed")).toBeNull();
  });

  it("shows a designed empty state, never a spinner that never stops", async () => {
    render(
      <TestProviders server={mockServer({ "/reviews": { body: page([]) } })}>
        <ReviewModerationPanel target={TARGET} canModerate />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-moderation-empty")).toBeTruthy();
    });
  });
});

describe("<ReviewResponseComposer>", () => {
  it("offers the box to the owner, blocked until there are words in it", () => {
    render(
      <TestProviders server={mockServer({})}>
        <ReviewResponseComposer target={TARGET} review={review()} canRespond />
      </TestProviders>
    );
    expect(screen.getByTestId("reviews-response-composer")).toBeTruthy();
    expect(screen.getByText("Write the reply first")).toBeTruthy();
    // Said BEFORE the one reply is spent, not after.
    expect(screen.getByTestId("reviews-response-one-shot")).toBeTruthy();
  });

  it("writes the reply and shows what the SERVER stored, not what was typed", async () => {
    const answered = review({
      response: {
        author_id: "seller",
        body: "Photos updated, thanks.",
        created_at: "2026-08-23T09:00:00Z",
      },
    });
    const server = mockServer({
      "POST /response": { status: 201, body: answered },
      "/reviews": { body: page([review()]) },
    });
    render(
      <TestProviders server={server}>
        <ReviewResponseComposer target={TARGET} review={review()} canRespond />
      </TestProviders>
    );
    fireEvent.change(screen.getByTestId("reviews-response-body"), {
      target: { value: "  Photos updated, thanks.  " },
    });
    fireEvent.click(screen.getByTestId("reviews-response-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("reviews-row-response")).toBeTruthy();
    });
    expect(screen.getByTestId("reviews-response-sent")).toBeTruthy();
    // Trimmed: a stray newline would be stored forever, unfixably.
    const posted = server.calls.find((call) => call.method === "POST");
    expect(posted?.body).toEqual({ body: "Photos updated, thanks." });
    expect(posted?.url).toContain("/reviews/r1/response");
  });

  it("shows a reply that already exists and offers no box at all", () => {
    const answered = review({
      response: {
        author_id: "seller",
        body: "Thanks!",
        created_at: "2026-08-21T10:00:00Z",
      },
    });
    render(
      <TestProviders server={mockServer({})}>
        <ReviewResponseComposer target={TARGET} review={answered} canRespond />
      </TestProviders>
    );
    expect(screen.getByTestId("reviews-row-response")).toBeTruthy();
    expect(screen.queryByTestId("reviews-response-body")).toBeNull();
  });

  it("turns the 409 into the same 'already answered' sentence, not a banner", async () => {
    const server = mockServer({ "POST /response": ALREADY_RESPONDED_409 });
    render(
      <TestProviders server={server}>
        <ReviewResponseComposer target={TARGET} review={review()} canRespond />
      </TestProviders>
    );
    fireEvent.change(screen.getByTestId("reviews-response-body"), {
      target: { value: "Too late" },
    });
    fireEvent.click(screen.getByTestId("reviews-response-submit"));
    await waitFor(() => {
      expect(screen.getByText("This review already has a reply")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-response-failed")).toBeNull();
  });

  it("says nothing under a review a reader cannot answer (`quiet`)", () => {
    const { container } = render(
      <TestProviders server={mockServer({})}>
        <ReviewResponseComposer target={TARGET} review={review()} quiet />
      </TestProviders>
    );
    expect(screen.queryByTestId("reviews-response-composer")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("but states the reason when the console asks for it (`quiet` off)", () => {
    render(
      <TestProviders server={mockServer({})}>
        <ReviewResponseComposer
          target={TARGET}
          review={review()}
          canRespond={false}
        />
      </TestProviders>
    );
    expect(
      screen.getByText("Only the owner of this item can reply to its reviews")
    ).toBeTruthy();
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
