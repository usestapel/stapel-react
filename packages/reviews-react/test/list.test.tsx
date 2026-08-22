/**
 * The list: the envelope the schema does not declare, the cursor that comes
 * out of it, and the 401 that must never be rendered as "no reviews yet".
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { ReviewList, reviewsQueryKeys } from "../src/index.js";
import type { ReviewListBag } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { FIRST_PAGE, SECOND_PAGE, TARGET, page, review } from "./fixtures.js";

function Probe(props: { bag: ReviewListBag }): ReactElement {
  const { bag } = props;
  return (
    <div>
      <span data-testid="status">{bag.state.status}</span>
      <span data-testid="more">
        {bag.more.available ? "available" : bag.more.block.code}
      </span>
      <span data-testid="ids">
        {bag.state.status === "ready"
          ? bag.state.data.map((r) => r.id).join(",")
          : ""}
      </span>
      <button type="button" onClick={bag.loadMore} data-testid="more-button">
        more
      </button>
    </div>
  );
}

function renderList(server: MockServer, include?: "all"): void {
  render(
    <TestProviders server={server}>
      <ReviewList target={TARGET} {...(include ? { include } : {})}>
        {(bag) => <Probe bag={bag} />}
      </ReviewList>
    </TestProviders>
  );
}

describe("the 200 body is the pagination envelope, not the declared array", () => {
  it("reads `items` out of the envelope", async () => {
    renderList(mockServer({ "/reviews": { body: FIRST_PAGE } }));
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("ids").textContent).toBe("r1,r2");
  });

  it("pages on `next_anchor`, and stops when has_next says so", async () => {
    let call = 0;
    const server = mockServer({
      "/reviews": () => {
        call += 1;
        return { body: call === 1 ? FIRST_PAGE : SECOND_PAGE };
      },
    });
    renderList(server);
    await waitFor(() => {
      expect(screen.getByTestId("more").textContent).toBe("available");
    });
    screen.getByTestId("more-button").click();
    await waitFor(() => {
      expect(screen.getByTestId("ids").textContent).toBe("r1,r2,r3");
    });
    // The cursor is the previous page's next_anchor — a created_at stamp.
    expect(server.calls[1]?.url).toContain("anchor=2026-08-19T10%3A00%3A00Z");
    // And a page whose has_next is false ends the run, with a reason.
    expect(screen.getByTestId("more").textContent).toBe(
      "reviews.list.more.blocked.end"
    );
  });

  it("never asks for a page beyond a null next_anchor", async () => {
    const server = mockServer({
      // has_next true with a null anchor would loop forever on a cursor
      // rebuilt from the last row; the pair reads has_next AND the anchor.
      "/reviews": { body: page([review()], { has_next: false, next_anchor: null }) },
    });
    renderList(server);
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    screen.getByTestId("more-button").click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(server.calls).toHaveLength(1);
  });
});

describe("the read is anonymous (stapel-reviews 0.3.0)", () => {
  it("fires and renders rows with no session manager mounted at all", async () => {
    // The harness registers none, which IS the storefront guest case:
    // `useActiveSessionReady()` answers true when nobody tracks sessions, so
    // a purely public page waits for nothing and the list loads.
    const server = mockServer({ "/reviews": { body: FIRST_PAGE } });
    renderList(server);
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("ids").textContent).toBe("r1,r2");
    expect(server.calls).toHaveLength(1);
  });

  it("an empty page is a REACHABLE ready state, not a disguised refusal", async () => {
    // Before 0.3.0 a guest could only ever get 401 here, so "ready and empty"
    // was unreachable for them and the empty state was reserved for members.
    // Now it means what it says to everyone: nobody has reviewed this target.
    renderList(mockServer({ "/reviews": { body: page([]) } }));
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("ids").textContent).toBe("");
  });

  it("an outage is still a failure, and the bag has no sign-in escape hatch", async () => {
    renderList(
      mockServer({ "/reviews": { status: 503, body: { localizable_error: "x" } } })
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("failed");
    });
    expect(screen.queryByTestId("sign-in")).toBeNull();
  });
});

describe("the request the pair sends", () => {
  it("carries the target pair the view reads by hand", async () => {
    const server = mockServer({ "/reviews": { body: FIRST_PAGE } });
    renderList(server);
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    const url = server.calls[0]?.url ?? "";
    expect(url).toContain("target_type=listing");
    expect(url).toContain("target_key=42");
    expect(url).toContain("direction=next");
  });

  it("sends include=all only when asked, and keys it separately", async () => {
    const server = mockServer({ "/reviews": { body: FIRST_PAGE } });
    renderList(server, "all");
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(server.calls[0]?.url).toContain("include=all");
    // Two scopes, two cache entries: the moderator's window must not
    // overwrite what everyone else reads.
    expect(reviewsQueryKeys.list(TARGET, "all")).not.toEqual(
      reviewsQueryKeys.list(TARGET)
    );
  });
});
