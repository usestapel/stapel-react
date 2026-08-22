/**
 * Writing a review: the request body, the duplicate refusal read by code, and
 * the created row whose `status` decides what the author is told.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { ReviewForm } from "../src/index.js";
import type { ReviewFormBag } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  ALREADY_RESPONDED_409,
  DUPLICATE_400,
  TARGET,
  UNAUTHENTICATED_401,
  review,
} from "./fixtures.js";

function Probe(props: { bag: ReviewFormBag }): ReactElement {
  const { bag } = props;
  return (
    <div>
      <span data-testid="gate">
        {bag.canSubmit.available ? "available" : bag.canSubmit.block.code}
      </span>
      <span data-testid="duplicate">{String(bag.alreadyReviewed)}</span>
      <span data-testid="visibility">{bag.submittedVisibility ?? "none"}</span>
      <span data-testid="error">{bag.error?.code ?? "none"}</span>
      <span data-testid="sign-in">{String(bag.signInRequired)}</span>
      <span data-testid="max">{bag.bounds.max}</span>
      <button type="button" data-testid="rate" onClick={() => bag.setRating(5)}>
        rate
      </button>
      <button type="button" data-testid="write" onClick={() => bag.setBody("hi")}>
        write
      </button>
      <button type="button" data-testid="submit" onClick={bag.submit}>
        submit
      </button>
    </div>
  );
}

function renderForm(
  server: MockServer,
  extra: { alreadyReviewed?: boolean; max?: number } = {}
): void {
  render(
    <TestProviders
      server={server}
      {...(extra.max !== undefined ? { ratingBounds: { max: extra.max } } : {})}
    >
      <ReviewForm
        target={TARGET}
        {...(extra.alreadyReviewed !== undefined
          ? { alreadyReviewed: extra.alreadyReviewed }
          : {})}
      >
        {(bag) => <Probe bag={bag} />}
      </ReviewForm>
    </TestProviders>
  );
}

describe("the gate names its reason", () => {
  it("blocks with 'choose a rating' before anything is chosen", () => {
    renderForm(mockServer({}));
    expect(screen.getByTestId("gate").textContent).toBe(
      "reviews.submit.blocked.no_rating"
    );
  });

  it("opens once a rating is chosen", () => {
    renderForm(mockServer({}));
    fireEvent.click(screen.getByTestId("rate"));
    expect(screen.getByTestId("gate").textContent).toBe("available");
  });

  it("blocks up front when the host already knows the author reviewed this", () => {
    renderForm(mockServer({}), { alreadyReviewed: true });
    expect(screen.getByTestId("gate").textContent).toBe(
      "reviews.submit.blocked.duplicate"
    );
  });
});

describe("the request", () => {
  it("sends the target pair in the BODY (the create endpoint takes no query)", async () => {
    const server = mockServer({ "POST /reviews": { status: 201, body: review() } });
    renderForm(server);
    fireEvent.click(screen.getByTestId("rate"));
    fireEvent.click(screen.getByTestId("write"));
    fireEvent.click(screen.getByTestId("submit"));
    await waitFor(() => {
      expect(screen.getByTestId("visibility").textContent).toBe("published");
    });
    expect(server.calls[0]?.body).toEqual({
      target_type: "listing",
      target_key: "42",
      rating: 5,
      body: "hi",
    });
  });

  it("omits an empty body rather than sending two spellings of 'no text'", async () => {
    const server = mockServer({ "POST /reviews": { status: 201, body: review() } });
    renderForm(server);
    fireEvent.click(screen.getByTestId("rate"));
    fireEvent.click(screen.getByTestId("submit"));
    await waitFor(() => {
      expect(server.calls.length).toBeGreaterThan(0);
    });
    expect(server.calls[0]?.body).not.toHaveProperty("body");
  });
});

describe("the duplicate refusal", () => {
  it("is recognised at status 400 and becomes the 'already rated' state", async () => {
    renderForm(mockServer({ "POST /reviews": DUPLICATE_400 }));
    fireEvent.click(screen.getByTestId("rate"));
    fireEvent.click(screen.getByTestId("submit"));
    await waitFor(() => {
      expect(screen.getByTestId("duplicate").textContent).toBe("true");
    });
    // And it is NOT left in `error`: the form has a sentence for it, so the
    // generic error surface stays empty.
    expect(screen.getByTestId("error").textContent).toBe("none");
    expect(screen.getByTestId("gate").textContent).toBe(
      "reviews.submit.blocked.duplicate"
    );
  });

  it("does not fire on the module's 409, which is about the owner's reply", async () => {
    renderForm(mockServer({ "POST /reviews": ALREADY_RESPONDED_409 }));
    fireEvent.click(screen.getByTestId("rate"));
    fireEvent.click(screen.getByTestId("submit"));
    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe(
        "error.409.reviews_already_responded"
      );
    });
    expect(screen.getByTestId("duplicate").textContent).toBe("false");
  });
});

describe("the write is the last place a 401 can happen", () => {
  it("names it, and does not leave it in the generic error surface", async () => {
    // Both reads are anonymous since 0.3.0; the POST still needs an identity
    // because there has to be an author to attribute the review to.
    renderForm(mockServer({ "POST /reviews": UNAUTHENTICATED_401 }));
    fireEvent.click(screen.getByTestId("rate"));
    fireEvent.click(screen.getByTestId("submit"));
    await waitFor(() => {
      expect(screen.getByTestId("sign-in").textContent).toBe("true");
    });
    expect(screen.getByTestId("error").textContent).toBe("none");
    expect(screen.getByTestId("duplicate").textContent).toBe("false");
  });
});

describe("a submitted review is not necessarily a visible one", () => {
  it("reports `pending` when the deployment pre-moderates", async () => {
    renderForm(
      mockServer({
        "POST /reviews": { status: 201, body: review({ status: "pending" }) },
      })
    );
    fireEvent.click(screen.getByTestId("rate"));
    fireEvent.click(screen.getByTestId("submit"));
    await waitFor(() => {
      expect(screen.getByTestId("visibility").textContent).toBe("pending");
    });
  });

  it("names a status this build does not know instead of assuming published", async () => {
    renderForm(
      mockServer({
        "POST /reviews": { status: 201, body: review({ status: "quarantined" }) },
      })
    );
    fireEvent.click(screen.getByTestId("rate"));
    fireEvent.click(screen.getByTestId("submit"));
    await waitFor(() => {
      expect(screen.getByTestId("visibility").textContent).toBe("unknown");
    });
  });
});

describe("the rating ceiling is the deployment's", () => {
  it("follows the runtime's bounds rather than a hardcoded five", () => {
    renderForm(mockServer({}), { max: 10 });
    expect(screen.getByTestId("max").textContent).toBe("10");
  });
});
