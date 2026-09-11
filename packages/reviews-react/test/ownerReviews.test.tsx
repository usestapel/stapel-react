/**
 * The OWNER addressing of `GET /reviews` (stapel-reviews 0.7.0): every review
 * of everything one owner owns, in one anchor-paginated list.
 *
 * What this suite is actually guarding is the SHAPE OF THE REQUEST. The view
 * takes one addressing per call and refuses two with
 * `error.400.reviews_ambiguous_addressing`, so a hook that leaked the target
 * pair into an owner request would not return a narrower list — it would
 * return a 400, and only on the deployments that happen to have set a target
 * up. Hence the assertions below are on the query string the wire saw, not
 * only on the rows that came back.
 *
 * The exclusivity is additionally proven at the TYPE level (the
 * `@ts-expect-error` block at the bottom), because the strongest form of "a
 * caller cannot name both axes" is one the compiler enforces and no test has
 * to catch at runtime.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { ReviewOwnerList, reviewsQueryKeys } from "../src/index.js";
import type {
  ReviewListParams,
  ReviewOwnerListBag,
  ReviewOwnerListParams,
} from "../src/index.js";
import { ReviewListPanel, ReviewsPanel } from "../src/default/index.js";
import type { ReviewListPanelProps } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { FIRST_PAGE, SECOND_PAGE, TARGET, page, review } from "./fixtures.js";

const OWNER = { ownerKey: "seller-88" } as const;

/** Rows about three DIFFERENT targets — what the owner axis actually answers. */
const OWNER_PAGE = page(
  [
    review({ id: "r1", target_key: "42" }),
    review({ id: "r2", target_key: "77", rating: 4 }),
    review({ id: "r3", target_key: "103", rating: 2 }),
  ],
  { has_next: true, next_anchor: "2026-08-19T10:00:00Z" }
);

function Probe(props: { bag: ReviewOwnerListBag }): ReactElement {
  const { bag } = props;
  return (
    <div>
      <span data-testid="status">{bag.state.status}</span>
      <span data-testid="ids">
        {bag.state.status === "ready"
          ? bag.state.data.map((r) => r.id).join(",")
          : ""}
      </span>
      <span data-testid="more">
        {bag.more.available ? "available" : bag.more.block.code}
      </span>
      <button type="button" onClick={bag.loadMore} data-testid="more-button">
        more
      </button>
    </div>
  );
}

function renderOwnerList(
  server: MockServer,
  owner: { ownerKey: string; targetType?: string } = OWNER
): void {
  render(
    <TestProviders server={server}>
      <ReviewOwnerList owner={owner}>{(bag) => <Probe bag={bag} />}</ReviewOwnerList>
    </TestProviders>
  );
}

describe("the request the owner hook sends", () => {
  it("carries owner_key and NEVER the target pair", async () => {
    const server = mockServer({ "/reviews": { body: OWNER_PAGE } });
    renderOwnerList(server);
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    const url = server.calls[0]?.url ?? "";
    expect(url).toContain("owner_key=seller-88");
    // Both axes in one request is error.400.reviews_ambiguous_addressing —
    // the refusal this pair must never be able to earn.
    expect(url).not.toContain("target_key=");
    expect(url).not.toContain("target_type=");
    expect(url).toContain("direction=next");
  });

  it("target_type beside the owner key NARROWS — it does not become an address", async () => {
    const server = mockServer({ "/reviews": { body: OWNER_PAGE } });
    renderOwnerList(server, { ownerKey: "seller-88", targetType: "listing" });
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    const url = server.calls[0]?.url ?? "";
    expect(url).toContain("owner_key=seller-88");
    expect(url).toContain("target_type=listing");
    // A target KEY is what would make it ambiguous, and there is none.
    expect(url).not.toContain("target_key=");
  });

  it("an empty owner key makes no request at all", async () => {
    const server = mockServer({ "/reviews": { body: OWNER_PAGE } });
    renderOwnerList(server, { ownerKey: "" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(server.calls).toHaveLength(0);
    expect(screen.getByTestId("status").textContent).toBe("loading");
  });
});

describe("the owner list pages the way the target list does", () => {
  it("reads `items` out of the envelope and pages on next_anchor", async () => {
    let call = 0;
    const server = mockServer({
      "/reviews": () => {
        call += 1;
        return { body: call === 1 ? OWNER_PAGE : SECOND_PAGE };
      },
    });
    renderOwnerList(server);
    await waitFor(() => {
      expect(screen.getByTestId("ids").textContent).toBe("r1,r2,r3");
    });
    expect(screen.getByTestId("more").textContent).toBe("available");

    screen.getByTestId("more-button").click();
    await waitFor(() => {
      expect(screen.getByTestId("ids").textContent).toBe("r1,r2,r3,r3");
    });
    expect(server.calls[1]?.url).toContain("anchor=2026-08-19T10%3A00%3A00Z");
    expect(server.calls[1]?.url).toContain("owner_key=seller-88");
    expect(screen.getByTestId("more").textContent).toBe(
      "reviews.list.more.blocked.end"
    );
  });

  it("keys separately from the target list, and from the same owner under a narrowing", () => {
    // An owner's reviews are not a target's, and neither invalidates the
    // other: a host that invalidated one target must not blank the seller tab.
    expect(reviewsQueryKeys.ownerList(OWNER)).not.toEqual(
      reviewsQueryKeys.list(TARGET)
    );
    expect(
      reviewsQueryKeys.ownerList({ ownerKey: "seller-88", targetType: "listing" })
    ).not.toEqual(reviewsQueryKeys.ownerList(OWNER));
    expect(reviewsQueryKeys.ownerList(OWNER, "all")).not.toEqual(
      reviewsQueryKeys.ownerList(OWNER)
    );
  });
});

describe("the panel, addressed by owner", () => {
  it("lists the owner's rows with the same row renderer", async () => {
    const server = mockServer({ "/reviews": { body: OWNER_PAGE } });
    render(
      <TestProviders server={server}>
        <ReviewListPanel owner={OWNER} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("reviews-row")).toHaveLength(3);
    });
    expect(server.calls[0]?.url).toContain("owner_key=seller-88");
    // The rows are about three different targets, and the panel drew all
    // three without being told what any of them was.
    const ids = screen
      .getAllByTestId("reviews-row")
      .map((row) => row.getAttribute("data-review-id"));
    expect(ids).toEqual(["r1", "r2", "r3"]);
  });

  it("an owner with no reviews gets the owner sentence, not the target one", async () => {
    const server = mockServer({ "/reviews": { body: page([]) } });
    render(
      <TestProviders server={server}>
        <ReviewListPanel owner={OWNER} />
      </TestProviders>
    );
    const empty = await screen.findByTestId("reviews-list-empty");
    expect(empty.textContent).toContain("Nothing here has been reviewed yet");
    // "Be the first to say how it went" is an invitation nobody can accept on
    // this axis: a review is written about a target, and this address names
    // none.
    expect(empty.textContent).not.toContain("Be the first");
  });

  it("the host's own empty arm still wins, and `null` still draws nothing", async () => {
    const server = mockServer({ "/reviews": { body: page([]) } });
    render(
      <TestProviders server={server}>
        <ReviewListPanel owner={OWNER} emptyState={null} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list")).toBeTruthy();
    });
    expect(screen.queryByTestId("reviews-list-empty")).toBeNull();
  });

  it("<ReviewsPanel owner> is the list and nothing else", async () => {
    const server = mockServer({ "/reviews": { body: OWNER_PAGE } });
    render(
      <TestProviders server={server}>
        <ReviewsPanel owner={OWNER} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("reviews-row")).toHaveLength(3);
    });
    // No rating line (that endpoint takes ONE target), no form (a review is
    // written about a target), no moderation queue (can_moderate answers
    // about one target) — and therefore no aggregate request either.
    expect(screen.queryByTestId("reviews-form")).toBeNull();
    for (const call of server.calls) {
      expect(call.url).not.toContain("/reviews/aggregate");
    }
  });
});

describe("exactly one addressing, enforced by the compiler", () => {
  it("refuses both axes on the panel", () => {
    // The wire refuses this with error.400.reviews_ambiguous_addressing. A
    // refusal a host can earn by writing one extra prop is a refusal the
    // types should forbid, so the union types the unused arm `never` and this
    // does not compile. `@ts-expect-error` is the assertion: it goes red if
    // the two props ever stop excluding each other.
    // @ts-expect-error `owner` and `target` are mutually exclusive.
    const bothAxes: ReviewListPanelProps = { owner: OWNER, target: TARGET };
    void bothAxes;
    // And each arm on its own still compiles — an exclusivity that refused
    // everything would satisfy the line above and be useless.
    const byOwner: ReviewListPanelProps = { owner: OWNER };
    const byTarget: ReviewListPanelProps = { target: TARGET };
    expect(byOwner.owner?.ownerKey).toBe("seller-88");
    expect(byTarget.target?.targetKey).toBe("42");
  });

  it("refuses both axes one layer down, in the request params", () => {
    // @ts-expect-error a target address may not carry an owner key.
    const bad: ReviewListParams = { ...TARGET, ownerKey: "seller-88" };
    void bad;
    const alsoBad: ReviewOwnerListParams = {
      ownerKey: "seller-88",
      // @ts-expect-error an owner address may not carry a target KEY.
      targetKey: "42",
    };
    void alsoBad;
    // A target TYPE beside an owner key is legal — it narrows, it does not
    // address, and the view says so.
    const narrowed: ReviewOwnerListParams = {
      ownerKey: "seller-88",
      targetType: "listing",
    };
    expect(narrowed.targetType).toBe("listing");
    expect(FIRST_PAGE.items.length).toBeGreaterThan(0);
  });
});
