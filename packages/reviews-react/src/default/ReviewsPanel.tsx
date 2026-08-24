/**
 * `<ReviewsPanel>` — the composed block a listing detail page drops in: the
 * rating line, the list, the form for a reader who has not rated yet, and —
 * for whoever the host says moderates the item — the moderation queue.
 *
 * The pre-check is the interesting part, and its LIMIT is the reason it lives
 * here rather than inside the form. Given `viewerId`, the panel looks for the
 * viewer's own review among the loaded rows and, finding one, tells the form
 * not to offer itself. That list is published-only, so under pre-moderation
 * the viewer's pending review is invisible even to them: the form is offered,
 * the server refuses with `error.400.reviews_duplicate_review`, and the form
 * shows the same "you have already rated this" sentence. One fact, two
 * discoveries, one sentence — which is why the refusal is a first-class
 * outcome and the pre-check is only an optimisation.
 *
 * ── Why the queue is a second pane and not a mode of the first ─────────────
 *
 * A moderator of a listing is also a reader of it, and the two views answer
 * different questions: "what does the public see" and "what is there". They
 * are two different requests (`include=all` is a different cache key and a
 * different set of rows), so folding them into one pane with a switch would
 * make the public view unreachable for exactly the person who most needs to
 * check it.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex } from "antd";
import type { SignInCtaProp } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { Review, ReviewTarget } from "../api/types.js";
import { ReviewList } from "../headless/ReviewList.js";
import { findOwnReview } from "../model/list.js";
import { RatingBadge } from "./RatingBadge.js";
import { ReviewFormCard } from "./ReviewFormCard.js";
import { ReviewListPanel } from "./ReviewListPanel.js";
import { ReviewModerationPanel } from "./ReviewModerationPanel.js";
import type { ThemeModeProp } from "./types.js";

export interface ReviewsPanelProps extends ThemeModeProp, SignInCtaProp {
  readonly target: ReviewTarget;
  /**
   * The reader's user id — the value the backend puts in `author_id`, NOT a
   * profile id. Absent means no pre-check: the form is offered and the server
   * is the only judge.
   */
  readonly viewerId?: string | null;
  /** Hide the form entirely (a seller looking at their own listing). */
  readonly canReview?: boolean;
  /**
   * The host believes this viewer moderates this target: adds the moderation
   * queue below the public list. The server still decides — the queue's own
   * controls carry their refusal.
   */
  readonly canModerate?: boolean;
  /** The host believes this viewer owns the item: arms the reply composer
   * under every review that has none. */
  readonly canRespond?: boolean;
  readonly renderAuthor?: (review: Review) => ReactNode;
  readonly renderDate?: (review: Review) => ReactNode;
}

export function ReviewsPanel(props: ReviewsPanelProps): ReactElement {
  const {
    mode,
    surface,
    target,
    viewerId,
    canReview = true,
    canModerate = false,
    signIn,
    ...rows
  } = props;
  const pinned = mode !== undefined ? { mode } : {};
  return (
    <SkinTheme {...pinned} surface={surface ?? "base"}>
      <Flex vertical gap={spacing[4]} data-testid="reviews-panel">
        <RatingBadge target={target} {...pinned} surface="bare" />
        <ReviewListPanel
          target={target}
          {...pinned}
          surface="bare"
          {...(signIn !== undefined ? { signIn } : {})}
          {...rows}
        />
        {canReview ? (
          // The list is read a second time here, from the SAME query key, so
          // this is a cache hit rather than a second request — the own-review
          // pre-check needs the rows and the panel needs them rendered.
          <ReviewList target={target}>
            {(bag) => (
              <ReviewFormCard
                target={target}
                {...pinned}
                surface="bare"
                {...(signIn !== undefined ? { signIn } : {})}
                alreadyReviewed={
                  findOwnReview(
                    bag.state.status === "ready" ? bag.state.data : undefined,
                    viewerId
                  ) !== undefined
                }
              />
            )}
          </ReviewList>
        ) : null}
        {canModerate ? (
          <ReviewModerationPanel
            target={target}
            canModerate
            {...pinned}
            surface="bare"
            {...(rows.renderAuthor !== undefined
              ? { renderAuthor: rows.renderAuthor }
              : {})}
            {...(rows.renderDate !== undefined
              ? { renderDate: rows.renderDate }
              : {})}
          />
        ) : null}
      </Flex>
    </SkinTheme>
  );
}
