import { describe, expect, it } from "vitest";
import {
  LISTING_STATUSES,
  LISTING_TRANSITIONS,
  MODERATION_STATUSES,
  MY_LISTINGS_TABS,
  MY_LISTINGS_TAB_STATUSES,
  canDelete,
  canTransition,
  isPubliclyVisible,
  lifecycleCaption,
  listingStatusView,
  listingsI18nBundleEn,
  moderationNotice,
  tabOf,
} from "../src/index.js";
import type {
  ListingLifecycleStatus,
  ListingModerationStatus,
} from "../src/index.js";

/**
 * The 9 × 4 table the spec asks for (§8.2), asserted as a table rather than
 * as nine tests: what matters is that EVERY combination produces a caption
 * and that the combinations which look contradictory produce the right one.
 */
describe("the lifecycle axis", () => {
  it("covers all nine statuses with a key the bundle carries", () => {
    expect(LISTING_STATUSES).toHaveLength(9);
    for (const status of LISTING_STATUSES) {
      const caption = lifecycleCaption(status);
      expect(caption.status).toBe(status);
      expect(listingsI18nBundleEn[caption.labelKey]).toBeTruthy();
    }
  });

  it("makes PUBLISHED the ONLY publicly visible status", () => {
    // The server's predicate is `status=published` and nothing else
    // (`ListingQuerySet.published`, `INDEXED_STATUSES`). A client that added
    // a second condition would hide a listing strangers can read.
    const visible = LISTING_STATUSES.filter(isPubliclyVisible);
    expect(visible).toEqual(["published"]);
  });
});

describe("the moderation axis, given BOTH fields", () => {
  it("produces a caption for every one of the 36 combinations", () => {
    for (const status of LISTING_STATUSES) {
      for (const moderation of MODERATION_STATUSES) {
        const view = listingStatusView(status, moderation);
        expect(listingsI18nBundleEn[view.lifecycle.labelKey]).toBeTruthy();
        if (view.moderation !== undefined) {
          expect(listingsI18nBundleEn[view.moderation.messageKey]).toBeTruthy();
        }
      }
    }
  });

  it("says nothing extra when the verdict is approved", () => {
    for (const status of LISTING_STATUSES) {
      expect(moderationNotice(status, "approved")).toBeUndefined();
    }
  });

  it("distinguishes a FIRST submission from a live edit under review", () => {
    // The whole reason this module exists. Both rows carry
    // `moderation_status: pending`; only the lifecycle tells them apart, and
    // the sentences must not be the same one.
    const first = listingStatusView("pending", "pending");
    const liveEdit = listingStatusView("published", "pending");

    expect(first.liveUnderReview).toBe(false);
    expect(liveEdit.liveUnderReview).toBe(true);
    expect(first.moderation?.messageKey).not.toBe(
      liveEdit.moderation?.messageKey
    );
    // And the live one is still visible to everyone while it is reviewed.
    expect(liveEdit.lifecycle.publiclyVisible).toBe(true);
  });

  it("does not promise a review to a listing the lifecycle took offline", () => {
    const archived = listingStatusView("archived", "pending");
    expect(archived.liveUnderReview).toBe(false);
    expect(archived.moderation?.messageKey).toBe(
      "listings.moderation.pending_offline"
    );
  });

  it("separates a rejection that has landed from one that has not", () => {
    expect(listingStatusView("blocked", "rejected").moderation?.messageKey).toBe(
      "listings.moderation.rejected"
    );
    expect(
      listingStatusView("published", "rejected").moderation?.messageKey
    ).toBe("listings.moderation.rejected_still_live");
  });
});

describe("the transition mirror", () => {
  it("mirrors the server's whitelist for every source status", () => {
    // Copied from `stapel_listings.models.LISTING_TRANSITIONS`. A summary
    // would drift; a copy reddens when the table moves.
    expect(Object.keys(LISTING_TRANSITIONS).sort()).toEqual(
      [...LISTING_STATUSES].sort()
    );
    expect(LISTING_TRANSITIONS.draft).toEqual(["pending", "archived"]);
    expect(LISTING_TRANSITIONS.archived).toEqual(["draft"]);
  });

  it("treats a same-status move as allowed — the server returns early", () => {
    for (const status of LISTING_STATUSES) {
      expect(canTransition(status, status)).toBe(true);
    }
  });

  it("refuses the two moves a dashboard offers when they are not allowed", () => {
    expect(canTransition("draft", "sold")).toBe(false);
    expect(canTransition("published", "sold")).toBe(true);
    expect(canTransition("sold", "archived")).toBe(true);
    expect(canTransition("archived", "sold")).toBe(false);
  });

  it("mirrors the DELETE rule, which is not a transition", () => {
    expect(canDelete("published")).toBe(false);
    expect(canDelete("pending")).toBe(false);
    expect(canDelete("draft")).toBe(true);
    expect(canDelete("archived")).toBe(true);
  });
});

describe("the dashboard tabs are the SERVER's grouping", () => {
  it("folds PENDING into active and REJECTED into drafts", () => {
    // `views.my_counters` counts them that way, so a tab whose caption said
    // otherwise would sit above a number that disagreed with its own rows.
    expect(MY_LISTINGS_TAB_STATUSES.active).toContain("pending");
    expect(MY_LISTINGS_TAB_STATUSES.drafts).toContain("rejected");
  });

  it("leaves BLOCKED out of every tab, and says so by answering undefined", () => {
    // `my_counters` counts it nowhere either. A dashboard that quietly filed
    // it under "archived" would hide the listing whose owner most needs to
    // see it.
    expect(tabOf("blocked")).toBeUndefined();
    const counted: ListingLifecycleStatus[] = MY_LISTINGS_TABS.flatMap(
      (tab) => [...MY_LISTINGS_TAB_STATUSES[tab]]
    );
    expect(counted).not.toContain("blocked");
    expect(new Set(counted).size).toBe(counted.length);
  });

  it("assigns every other status to exactly one tab", () => {
    for (const status of LISTING_STATUSES) {
      if (status === "blocked") continue;
      const tabs = MY_LISTINGS_TABS.filter((tab) =>
        MY_LISTINGS_TAB_STATUSES[tab].includes(status)
      );
      expect(tabs).toHaveLength(1);
      expect(tabOf(status)).toBe(tabs[0]);
    }
  });
});

describe("the moderation vocabulary matches the backend enum", () => {
  it("carries exactly the five states", () => {
    const expected: readonly ListingModerationStatus[] = [
      // The DEFAULT since stapel-listings 0.20.0. Before it a draft was born
      // `pending` and every dashboard announced a decision no case existed
      // behind.
      "not_submitted",
      "pending",
      "approved",
      "rejected",
      "needs_review",
    ];
    expect([...MODERATION_STATUSES].sort()).toEqual([...expected].sort());
  });

  it("says nothing about a listing nobody has submitted", () => {
    // D166. `moderationNotice`'s last branch used to be an unlabelled
    // fallthrough onto "rejected", so the value 0.20.0 added — and made the
    // default — turned every freshly created draft in the cabinet into
    // "A moderator turned this listing down. Fix it and send it again." for a
    // person who had submitted nothing at all.
    expect(moderationNotice("draft", "not_submitted")).toBeUndefined();
    expect(
      listingStatusView("draft", "not_submitted").moderation
    ).toBeUndefined();
    // The lifecycle still speaks: the row reads "Draft", which is true.
    expect(listingStatusView("draft", "not_submitted").lifecycle.labelKey).toBe(
      "listings.status.draft"
    );
  });

  it("degrades an unknown verdict to silence, never to an accusation", () => {
    // A row from a server newer than this pair. Saying nothing costs a
    // sentence; guessing "rejected" costs the reader their listing's
    // reputation with them.
    const unknown = "some_future_verdict" as ListingModerationStatus;
    expect(moderationNotice("draft", unknown)).toBeUndefined();
    expect(moderationNotice("published", unknown)).toBeUndefined();
    // …and the one it must still say is still said.
    expect(moderationNotice("draft", "rejected")?.messageKey).toBe(
      "listings.moderation.rejected"
    );
  });
});
