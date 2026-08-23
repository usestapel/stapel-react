/**
 * The door beside the reason — storefront Wave D, named gap G-3.
 *
 * "Sign in to leave a review" was the whole message: true, translated, and
 * dead-ended. The visitor was told what to do and not where, so the storefront
 * had to put its own notice a screen away from the control it was about.
 *
 * `signIn` is core's `SignInCta`, so the shape is the same one
 * `@stapel/chat-react` and `@stapel/listings-react` take. What is asserted
 * here is the pair's half: the reason and the door render TOGETHER, and the
 * form is never hidden from a visitor.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReviewFormCard, ReviewsPanel } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { FIRST_PAGE, RATED, TARGET, UNAUTHENTICATED_401 } from "./fixtures.js";

/** Rate and send — the gesture that reaches the 401. */
function submit(): void {
  const stars = screen
    .getByTestId("reviews-form-rate")
    .querySelectorAll<HTMLElement>("div[role='radio']");
  const star = stars[stars.length - 1];
  expect(star).toBeTruthy();
  if (star) fireEvent.click(star);
  fireEvent.click(screen.getByTestId("reviews-form-submit"));
}

describe("an anonymous author", () => {
  it("is shown the form, then the reason AND the way to sign in", async () => {
    render(
      <TestProviders server={mockServer({ "POST /reviews": UNAUTHENTICATED_401 })}>
        <ReviewFormCard target={TARGET} signIn={{ href: "/login?next=/l/7" }} />
      </TestProviders>
    );

    // Never hidden: the form is offered, because hiding it teaches nobody
    // that reviews exist.
    expect(screen.getByTestId("reviews-form-submit")).toBeTruthy();

    submit();

    await waitFor(() => {
      expect(screen.getByTestId("reviews-form-sign-in")).toBeTruthy();
    });
    const door = screen.getByTestId("reviews-form-sign-in-cta");
    expect(door.getAttribute("href")).toBe("/login?next=/l/7");
    // The two are one sentence, not two screens: the door is INSIDE the
    // element that carries the reason.
    expect(
      screen.getByTestId("reviews-form-sign-in").contains(door)
    ).toBe(true);
  });

  it("takes a callback instead, for a host that opens a modal", async () => {
    const onSignIn = vi.fn();
    render(
      <TestProviders server={mockServer({ "POST /reviews": UNAUTHENTICATED_401 })}>
        <ReviewFormCard target={TARGET} signIn={{ onSignIn }} />
      </TestProviders>
    );

    submit();

    await waitFor(() => {
      expect(screen.getByTestId("reviews-form-sign-in-cta")).toBeTruthy();
    });
    const door = screen.getByTestId("reviews-form-sign-in-cta");
    // No href on this arm: a control that navigates AND calls back is two
    // answers to one question.
    expect(door.hasAttribute("href")).toBe(false);
    fireEvent.click(door);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("still says the reason alone when the host has no sign-in route", async () => {
    render(
      <TestProviders server={mockServer({ "POST /reviews": UNAUTHENTICATED_401 })}>
        <ReviewFormCard target={TARGET} />
      </TestProviders>
    );

    submit();

    await waitFor(() => {
      expect(screen.getByTestId("reviews-form-sign-in")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-form-sign-in-cta")).toBeNull();
    // …and exactly the sentence, with nothing dangling where the link is not.
    expect(screen.getByTestId("reviews-form-sign-in").textContent).toBe(
      "Sign in to leave a review"
    );
  });
});

describe("<ReviewsPanel>", () => {
  it("passes the door down to the form it composes", async () => {
    render(
      <TestProviders
        server={mockServer({
          "/reviews/aggregate": { body: RATED },
          "POST /reviews": UNAUTHENTICATED_401,
          "/reviews": { body: FIRST_PAGE },
        })}
      >
        <ReviewsPanel target={TARGET} signIn={{ href: "/login?next=/l/7" }} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByTestId("reviews-form-submit")).toBeTruthy();
    });
    submit();

    await waitFor(() => {
      expect(
        screen.getByTestId("reviews-form-sign-in-cta").getAttribute("href")
      ).toBe("/login?next=/l/7");
    });
  });
});
