/**
 * Pure readers over a loaded list of reviews — no React, no queries, so a
 * card, a test and a server-rendered page can all use them.
 */
import type { InfiniteData } from "@tanstack/react-query";
import type { Review, ReviewPage, ReviewStatus } from "../api/types.js";

/**
 * Flatten the pages of the infinite list into one newest-first run.
 *
 * Deliberately takes `InfiniteData | undefined` and answers `undefined` for
 * "not loaded", never `[]`: an empty array here is a claim that the target
 * has no reviews, and the caller must get that claim from a READY load state
 * (`stapel/no-flattened-load-state` — the rule exists because a total outage
 * once rendered as "you have no workspaces").
 */
export function reviewsFromPages(
  data: InfiniteData<ReviewPage, string | undefined> | undefined
): readonly Review[] | undefined {
  if (data === undefined) return undefined;
  return data.pages.flatMap((page) => page.items);
}

/**
 * A review's visibility, narrowed — with a fourth arm for a state this build
 * does not know.
 *
 * `status` is a bare `string` on the wire. A build that met a new upstream
 * state and silently rendered it as published would be showing something the
 * server may have hidden; one that crashed on it would take the page down.
 * `"unknown"` is neither: the skin shows the row with an explicit "this
 * version does not know this state" badge, the same shape attributes-react
 * uses for an unsupported feature type.
 */
export function reviewVisibility(
  status: string
): ReviewStatus | "unknown" {
  return status === "published" || status === "pending" || status === "hidden"
    ? status
    : "unknown";
}

/** Is this row one a moderator sees only because they asked for `include=all`? */
export function isModeratedOut(review: Review): boolean {
  return reviewVisibility(review.status) !== "published";
}

/**
 * The viewer's own review of this target, if it is in the loaded rows.
 *
 * THIS IS AN OPTIMISTIC PRE-CHECK, AND IT HAS A KNOWN HOLE — recorded here
 * because the hole is in the contract, not in the code. The list a
 * non-moderator reads is published-only, so under `moderation: "pre"` the
 * author's own review is INVISIBLE TO ITS AUTHOR while it waits: this
 * function answers `undefined`, the form offers itself again, and the server
 * refuses the second attempt with `error.400.reviews_duplicate_review`.
 *
 * That is why the refusal is a first-class outcome of the form
 * (`headless/ReviewForm.tsx`) rather than something the pre-check was
 * supposed to prevent. The pre-check saves a pointless round trip in the
 * common (post-moderation) case; it is never the authority.
 *
 * `viewerId` must be the id the backend puts in `author_id` — the user id,
 * NOT a profile id. A host that passes the wrong one gets `undefined`, i.e.
 * the form offered where it need not have been, and the server still holds
 * the line.
 */
export function findOwnReview(
  reviews: readonly Review[] | undefined,
  viewerId: string | null | undefined
): Review | undefined {
  if (reviews === undefined || !viewerId) return undefined;
  return reviews.find((review) => review.author_id === viewerId);
}
