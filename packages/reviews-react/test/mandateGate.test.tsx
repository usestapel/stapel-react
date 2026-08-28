/**
 * The review write is refused BEFORE the click, not after it.
 *
 * The regression this closes: a storefront now mints an anonymous account for
 * a stranger who presses "save this listing", so a visitor arrives at the
 * review form already authenticated. `POST /reviews` therefore stopped
 * answering 401 — stapel-reviews refuses that session with its own
 * `ALLOW_ANONYMOUS_WRITES` 403 instead — and the form, which had been reading
 * the 401, let the visitor choose a rating, write a comment, press Send and
 * collect a red banner with a raw key in it.
 *
 * So the axis is asked up front, through core's `MandateSource` seam — and the
 * wall it puts up is the CLIENT half of stapel-reviews'
 * `ALLOW_ANONYMOUS_WRITES`, opened by a host naming `reviews.write` on its
 * elevation source rather than by the pair guessing. Wire nothing, which is
 * every host today, and the wall stands on both sides.
 *
 * The two `unresolved` arms are what this suite watches hardest, because they
 * are what a careless `if (!isMember)` gets wrong: `asking` is a WAIT and
 * `unavailable` is not a verdict at all.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import type { ElevationSource } from "@stapel/core";
import { REVIEWS_ELEVATION_ACTIONS, ReviewForm } from "../src/index.js";
import type { ReviewFormBag } from "../src/index.js";
import { ReviewFormCard } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { MockServer, TestMandate } from "./harness.js";
import { ANONYMOUS_NOT_ALLOWED_403, TARGET, review } from "./fixtures.js";

function Probe(props: { bag: ReviewFormBag }): ReactElement {
  const { bag } = props;
  return (
    <div>
      <span data-testid="gate">
        {bag.canSubmit.available ? "available" : bag.canSubmit.block.code}
      </span>
      <span data-testid="sign-in">{String(bag.signInRequired)}</span>
      <span data-testid="error">{bag.error?.code ?? "none"}</span>
      <span data-testid="visibility">{bag.submittedVisibility ?? "none"}</span>
      <button type="button" data-testid="rate" onClick={() => bag.setRating(5)}>
        rate
      </button>
      <button type="button" data-testid="submit" onClick={bag.submit}>
        submit
      </button>
    </div>
  );
}

/**
 * `mandate` omitted mounts NO `<MandateProvider>` and `elevation` omitted
 * mounts NO `<ElevationProvider>` — the host that wired neither.
 */
function renderForm(
  server: MockServer,
  mandate?: TestMandate,
  elevation?: ElevationSource
): void {
  render(
    <TestProviders
      server={server}
      {...(mandate !== undefined ? { mandate } : {})}
      {...(elevation !== undefined ? { elevation } : {})}
    >
      <ReviewForm target={TARGET}>{(bag) => <Probe bag={bag} />}</ReviewForm>
    </TestProviders>
  );
}

/** Choose a rating and press Send — the gesture that used to buy the banner. */
function tryToSubmit(): void {
  fireEvent.click(screen.getByTestId("rate"));
  fireEvent.click(screen.getByTestId("submit"));
}

describe.each(["anonymous", "guest"] as const)(
  "a visitor whose mandate is %s",
  (mandate) => {
    it("is told to sign in before anything is typed", () => {
      renderForm(mockServer({}), mandate);
      // Not after a round trip: the state is true on the first render.
      expect(screen.getByTestId("sign-in").textContent).toBe("true");
      expect(screen.getByTestId("gate").textContent).toBe(
        "reviews.submit.blocked.sign_in"
      );
    });

    it("sends nothing, even pressing the button", () => {
      const server = mockServer({});
      renderForm(server, mandate);
      tryToSubmit();
      expect(server.calls).toHaveLength(0);
      expect(screen.getByTestId("visibility").textContent).toBe("none");
    });

    it("is a sign-in prompt and not a red banner", () => {
      renderForm(mockServer({}), mandate);
      expect(screen.getByTestId("error").textContent).toBe("none");
    });
  }
);

describe("a member", () => {
  it("writes the review exactly as before", async () => {
    const server = mockServer({ "POST /reviews": { status: 201, body: review() } });
    renderForm(server, "member");
    expect(screen.getByTestId("sign-in").textContent).toBe("false");
    tryToSubmit();
    await waitFor(() => {
      expect(screen.getByTestId("visibility").textContent).toBe("published");
    });
    expect(server.calls).toHaveLength(1);
  });
});

describe("the two answers that are not verdicts", () => {
  it("renders `asking` as a WAIT — not as a refusal", () => {
    renderForm(mockServer({}), "asking");
    // The distinction the five required arms of `matchMandate` exist for: the
    // control is held, and nobody is told they may not review.
    expect(screen.getByTestId("gate").textContent).toBe(
      "reviews.submit.blocked.mandate_unknown"
    );
    expect(screen.getByTestId("sign-in").textContent).toBe("false");
  });

  it("sends nothing while the axis is still being asked", () => {
    const server = mockServer({});
    renderForm(server, "asking");
    tryToSubmit();
    expect(server.calls).toHaveLength(0);
  });

  it("keeps the form when the axis could NOT be asked", async () => {
    // `unavailable` is also what core answers outside a `<MandateProvider>`.
    // A refusal here would take the form away from every host that has not
    // wired the axis, and the module still refuses the POST if the guess is
    // wrong.
    const server = mockServer({ "POST /reviews": { status: 201, body: review() } });
    renderForm(server, "unavailable");
    expect(screen.getByTestId("sign-in").textContent).toBe("false");
    tryToSubmit();
    await waitFor(() => {
      expect(screen.getByTestId("visibility").textContent).toBe("published");
    });
  });
});

describe("a host that never wired the axis at all", () => {
  it("gets the form it had yesterday", async () => {
    const server = mockServer({ "POST /reviews": { status: 201, body: review() } });
    renderForm(server);
    expect(screen.getByTestId("sign-in").textContent).toBe("false");
    expect(screen.getByTestId("gate").textContent).toBe(
      "reviews.submit.blocked.no_rating"
    );
    tryToSubmit();
    await waitFor(() => {
      expect(screen.getByTestId("visibility").textContent).toBe("published");
    });
  });

  it("and still reads the refusal when it arrives — now in BOTH spellings", async () => {
    // The race the up-front gate cannot win: no axis, so the 403 is the only
    // thing that says it. It has to land on the sign-in state, not on the
    // generic error surface.
    const server = mockServer({ "POST /reviews": ANONYMOUS_NOT_ALLOWED_403 });
    renderForm(server);
    tryToSubmit();
    await waitFor(() => {
      expect(screen.getByTestId("sign-in").textContent).toBe("true");
    });
    expect(screen.getByTestId("error").textContent).toBe("none");
  });
});

describe("the skin puts the door where the form was", () => {
  it("shows the reason and the way in, with no textarea to fill first", () => {
    render(
      <TestProviders server={mockServer({})} mandate="guest">
        <ReviewFormCard target={TARGET} signIn={{ href: "/login?next=/l/7" }} />
      </TestProviders>
    );
    expect(screen.getByTestId("reviews-form-sign-in").textContent).toContain(
      "Sign in to leave a review"
    );
    expect(
      screen.getByTestId("reviews-form-sign-in-cta").getAttribute("href")
    ).toBe("/login?next=/l/7");
    // The point of the whole change: there is nothing to fill in and no
    // button to press, so the refusal cannot be discovered by being refused.
    expect(screen.queryByTestId("reviews-form-rate")).toBeNull();
    expect(screen.queryByTestId("reviews-form-submit")).toBeNull();
  });

  it("leaves the form standing for a member", () => {
    render(
      <TestProviders server={mockServer({})} mandate="member">
        <ReviewFormCard target={TARGET} signIn={{ href: "/login" }} />
      </TestProviders>
    );
    expect(screen.getByTestId("reviews-form-submit")).toBeTruthy();
    expect(screen.queryByTestId("reviews-form-sign-in")).toBeNull();
  });
});

/**
 * The wall follows the HOST, not a judgement welded into the library.
 *
 * `ALLOW_ANONYMOUS_WRITES` is stapel-reviews' own switch, and a client that
 * refused what the server accepts would be the two halves disagreeing in the
 * direction hardest to notice — nobody files a bug about a form they were
 * never offered. So the client half is the same per-action list the sibling
 * pairs read: name `reviews.write` and the form opens for a stranger and mints
 * on submit; name nothing and every visitor sees the wall above.
 */
function elevationFor(
  actions: readonly string[] = [REVIEWS_ELEVATION_ACTIONS.write]
): { source: ElevationSource; elevate: ReturnType<typeof vi.fn> } {
  const elevate = vi.fn((): Promise<void> => Promise.resolve());
  return { source: { actions, elevate }, elevate };
}

describe("a deployment that lets guests review", () => {
  it("offers the form to an anonymous visitor instead of refusing", () => {
    const { source } = elevationFor();
    renderForm(mockServer({}), "anonymous", source);
    expect(screen.getByTestId("sign-in").textContent).toBe("false");
    expect(screen.getByTestId("gate").textContent).toBe(
      "reviews.submit.blocked.no_rating"
    );
  });

  it("does not mint on render — a crawler costs nothing", () => {
    const { source, elevate } = elevationFor();
    renderForm(mockServer({}), "anonymous", source);
    expect(elevate).not.toHaveBeenCalled();
  });

  it("mints first, then posts — in that order", async () => {
    const order: string[] = [];
    const source: ElevationSource = {
      actions: [REVIEWS_ELEVATION_ACTIONS.write],
      elevate: () => {
        order.push("mint");
        return Promise.resolve();
      },
    };
    const server = mockServer({
      "POST /reviews": () => {
        order.push("review");
        return { status: 201, body: review() };
      },
    });
    renderForm(server, "anonymous", source);
    tryToSubmit();

    await waitFor(() => {
      expect(screen.getByTestId("visibility").textContent).toBe("published");
    });
    // The order IS the feature: a review that overtakes its own account buys
    // the 401 the up-front gate had just avoided.
    expect(order).toEqual(["mint", "review"]);
  });

  it("abandons the review when the mint fails", async () => {
    const source: ElevationSource = {
      actions: [REVIEWS_ELEVATION_ACTIONS.write],
      elevate: () => Promise.reject(new Error("429")),
    };
    const server = mockServer({
      "POST /reviews": { status: 201, body: review() },
    });
    renderForm(server, "anonymous", source);
    tryToSubmit();

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).not.toBe("none");
    });
    // Nothing was written under an account that does not exist.
    expect(server.calls).toHaveLength(0);
    expect(screen.getByTestId("visibility").textContent).toBe("none");
  });

  it("leaves the wall standing for a host that named a DIFFERENT action", () => {
    // The same visitor, the same session, a source that names only the heart.
    // This is what makes the list per-action rather than per-visitor: saving a
    // listing may mint, and reviewing still may not.
    const { source, elevate } = elevationFor(["listings.favorite"]);
    const server = mockServer({});
    renderForm(server, "anonymous", source);
    expect(screen.getByTestId("sign-in").textContent).toBe("true");
    expect(screen.getByTestId("gate").textContent).toBe(
      "reviews.submit.blocked.sign_in"
    );
    tryToSubmit();
    expect(elevate).not.toHaveBeenCalled();
    expect(server.calls).toHaveLength(0);
  });

  it("does not open the form for a GUEST, who has nothing to mint", () => {
    // A registered account holding no mandate is not an elevation question:
    // there is already an account, so the mandate axis alone decides.
    const { source, elevate } = elevationFor();
    renderForm(mockServer({}), "guest", source);
    expect(screen.getByTestId("sign-in").textContent).toBe("true");
    expect(elevate).not.toHaveBeenCalled();
  });

  it("changes nothing with no elevation provider at all", () => {
    // Every host today, the classified storefront included. `covers` is false,
    // the wall stands,
    // and the visitor sees exactly the sign-in state above.
    const server = mockServer({});
    renderForm(server, "anonymous");
    expect(screen.getByTestId("sign-in").textContent).toBe("true");
    tryToSubmit();
    expect(server.calls).toHaveLength(0);
  });
});
