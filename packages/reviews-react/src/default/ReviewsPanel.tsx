/**
 * `<ReviewsPanel>` — the composed block a listing detail page drops in: the
 * rating line, the list, and (for a signed-in reader who has not rated yet)
 * the form.
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
 */
import type { ReactElement, ReactNode } from "react";
import { Flex } from "antd";
import type { Review, ReviewTarget } from "../api/types.js";
import { ReviewList } from "../headless/ReviewList.js";
import { findOwnReview } from "../model/list.js";
import { RatingBadge } from "./RatingBadge.js";
import { ReviewFormCard } from "./ReviewFormCard.js";
import { ReviewListPanel } from "./ReviewListPanel.js";
import { ReviewsSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface ReviewsPanelProps extends ThemeModeProp {
  readonly target: ReviewTarget;
  /**
   * The reader's user id — the value the backend puts in `author_id`, NOT a
   * profile id. Absent means no pre-check: the form is offered and the server
   * is the only judge.
   */
  readonly viewerId?: string | null;
  /** Hide the form entirely (a seller looking at their own listing). */
  readonly canReview?: boolean;
  readonly renderAuthor?: (review: Review) => ReactNode;
  readonly renderDate?: (review: Review) => ReactNode;
}

export function ReviewsPanel(props: ReviewsPanelProps): ReactElement {
  const { mode, target, viewerId, canReview = true, ...rows } = props;
  return (
    <ReviewsSkinTheme {...(mode !== undefined ? { mode } : {})}>
      <Flex vertical gap={16} data-testid="reviews-panel">
        <RatingBadge target={target} {...(mode !== undefined ? { mode } : {})} />
        <ReviewListPanel
          target={target}
          {...(mode !== undefined ? { mode } : {})}
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
                {...(mode !== undefined ? { mode } : {})}
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
      </Flex>
    </ReviewsSkinTheme>
  );
}
