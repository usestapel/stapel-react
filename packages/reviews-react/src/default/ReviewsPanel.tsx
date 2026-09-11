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
import type { Review, ReviewOwner, ReviewTarget } from "../api/types.js";
import { ReviewList } from "../headless/ReviewList.js";
import { findOwnReview } from "../model/list.js";
import { RatingBadge } from "./RatingBadge.js";
import { ReviewFormCard } from "./ReviewFormCard.js";
import { ReviewListPanel } from "./ReviewListPanel.js";
import type { ReviewListPanelAddress } from "./ReviewListPanel.js";
import { ReviewModerationPanel } from "./ReviewModerationPanel.js";
import type { ThemeModeProp } from "./types.js";

interface ReviewsPanelBaseProps extends ThemeModeProp, SignInCtaProp {
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
  /**
   * THE LIST'S EMPTY ARM, declared here and handed straight to
   * `<ReviewListPanel emptyState>` — see that prop for the three cases
   * (`undefined` keeps the pair's own "no reviews yet" state, a node replaces
   * it, `null` renders nothing at all).
   *
   * It is repeated on this composed panel because this is the component a
   * listing page actually mounts, and a prop that exists only on the part
   * nobody mounts is a prop nobody has: a storefront that wanted the silent
   * arm hid `reviews-list-empty` with a CSS rule instead, which is the pair's
   * own defect the slot was added to end — the panel rendered something the
   * host could not decline.
   */
  readonly emptyState?: ReactNode | null;
}

/**
 * Exactly one addressing, the same union `<ReviewListPanel>` takes and for the
 * same reason — see {@link ReviewListPanelAddress}.
 */
export type ReviewsPanelProps = ReviewsPanelBaseProps & ReviewListPanelAddress;

/**
 * The owner axis: the list, and only the list.
 *
 * Kept as its own component rather than as a branch inside one, because the
 * union's two arms can only tell each other apart while `props` is still one
 * object — destructure first and `target` is `ReviewTarget | undefined` on a
 * path where the type already guaranteed it.
 */
function OwnerReviewsPanel(
  props: ReviewsPanelBaseProps & { readonly owner: ReviewOwner }
): ReactElement {
  // `viewerId`, `canReview` and `canModerate` are peeled off and dropped on
  // purpose: they steer the form, the pre-check and the queue, none of which
  // this axis draws (see the header). Letting them ride in `rows` would hand
  // `<ReviewListPanel>` props it does not take.
  const {
    mode,
    surface,
    owner,
    signIn,
    viewerId: _viewerId,
    canReview: _canReview,
    canModerate: _canModerate,
    ...rows
  } = props;
  const pinned = mode !== undefined ? { mode } : {};
  return (
    <SkinTheme {...pinned} surface={surface ?? "base"}>
      <Flex vertical gap={spacing[4]} data-testid="reviews-panel">
        <ReviewListPanel
          owner={owner}
          {...pinned}
          surface="bare"
          {...(signIn !== undefined ? { signIn } : {})}
          {...rows}
        />
      </Flex>
    </SkinTheme>
  );
}

function TargetReviewsPanel(
  props: ReviewsPanelBaseProps & { readonly target: ReviewTarget }
): ReactElement {
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
        {/* `rows` carries `emptyState` through untouched, and the
            distinction that matters survives the trip: a prop the host never
            passed is absent from the rest object entirely, so `undefined`
            (the pair's own state) is told apart from an explicit `null` (draw
            nothing) by presence rather than by truthiness. */}
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

export function ReviewsPanel(props: ReviewsPanelProps): ReactElement {
  return props.owner !== undefined ? (
    <OwnerReviewsPanel {...props} />
  ) : (
    <TargetReviewsPanel {...props} />
  );
}
