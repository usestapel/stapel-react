/**
 * `<ReviewListPanel>` — the antd rendering of the review list.
 *
 * Four things it says out loud that a naive list would swallow:
 *
 * 1. A row that is not `published` carries a badge naming its state. It is on
 *    screen only because a moderator asked for `include=all`, and a pending
 *    or hidden review that looked like an ordinary one would misrepresent
 *    what the public can see.
 * 2. `include=all` is narrowed SILENTLY for a non-moderator, so when the pane
 *    asked for every review and nothing on screen proves it got them, it says
 *    so (`ScopeNotice`) instead of showing a short list as if it were whole.
 * 3. The author is a SLOT. The wire carries `author_id` and nothing else — no
 *    name, no avatar — so the skin renders a neutral label unless the host
 *    passes `renderAuthor`. Printing a raw user id would be both useless to a
 *    reader and a gratuitous disclosure.
 * 4. The DATE is not a slot any more. It used to be, and the result was a
 *    review list with no dates in it anywhere the host had not written a
 *    formatter — so the pair ships a short absolute date in the reader's
 *    locale (`model/dates.ts`) and the slot survives on top for a host that
 *    wants relative time.
 *
 * The seller's reply is `<ReviewResponseComposer>`, which both shows the
 * existing reply and — for a viewer the host declares the owner — writes the
 * one that does not exist yet.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex, List, Rate, Typography } from "antd";
import { useT } from "@stapel/core";
import type { SignInCta, SignInCtaProp } from "@stapel/core";
import { EmptyState, LoadList, SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { Review, ReviewTarget } from "../api/types.js";
import { ReviewList } from "../headless/ReviewList.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { useReviewsRuntime } from "../model/context.js";
import { useReviewDateFormat } from "../model/dates.js";
import { MoreButton, ScopeNotice, VisibilityTag } from "./listParts.js";
import { ReviewResponseComposer } from "./ReviewResponseComposer.js";
import type { ThemeModeProp } from "./types.js";

export interface ReviewListPanelProps extends ThemeModeProp, SignInCtaProp {
  readonly target: ReviewTarget;
  /**
   * Ask for pending/hidden rows. Granted only to a moderator of the target and
   * narrowed to published-only for anyone else WITHOUT an error — which is why
   * passing it also arms the narrowing notice (see {@link canModerate}).
   */
  readonly include?: "all";
  /**
   * Does the host believe this viewer moderates this target? Read here only to
   * suppress the narrowing notice for a moderator whose target simply has no
   * hidden rows. The verdict CONTROLS live in `<ReviewModerationPanel>`.
   */
  readonly canModerate?: boolean;
  /** Does the host believe this viewer owns the reviewed item? Arms the reply
   * composer under every review that has no reply yet. */
  readonly canRespond?: boolean;
  readonly limit?: number;
  /** Turn `author_id` into something a reader recognises. See the header. */
  readonly renderAuthor?: (review: Review) => ReactNode;
  /** Override the pair's short absolute date (e.g. with relative time). */
  readonly renderDate?: (review: Review) => ReactNode;
  /**
   * THE EMPTY ARM IS A SLOT.
   *
   * Absent (default) keeps the pair's own "no reviews yet" `<EmptyState>`,
   * `reviews-list-empty`, byte-compatible for existing hosts. A node replaces
   * it. **`null` renders nothing at all** — the arm a host needs when the
   * panel sits inside a card that already says, in its own words, that this
   * seller has no reviews: two empty states stacked is the pane arguing with
   * its own container (measured on a live storefront, which hid ours with a
   * CSS rule on the test id).
   *
   * `null` is a real answer here rather than "not passed", so the three cases
   * are distinguished by `undefined` vs `null` vs node — not by truthiness.
   */
  readonly emptyState?: ReactNode | null;
}

function ReviewRow(props: {
  review: Review;
  target: ReviewTarget;
  max: number;
  canRespond: boolean | undefined;
  signIn: SignInCta | undefined;
  renderAuthor: ReviewListPanelProps["renderAuthor"];
  // Not a slot: the panel has already resolved the host slot against the
  // pair's own default, so this always renders something or an explicit null.
  dateOf: (review: Review) => ReactNode;
}): ReactElement {
  const t = useT();
  const { review } = props;
  return (
    <List.Item data-testid="reviews-row" data-review-id={review.id}>
      <Flex vertical gap={spacing[1]} style={{ width: "100%" }}>
        <Flex align="center" gap={spacing[2]} wrap>
          <Rate disabled count={props.max} value={review.rating} />
          {/* min-width 0 so a long author name can never split the badge
              beside it across a line (C-ROWOVERFLOW). */}
          <Typography.Text strong style={{ minWidth: 0 }}>
            {props.renderAuthor?.(review) ?? t(REVIEWS_I18N_KEYS.authorFallback)}
          </Typography.Text>
          {props.dateOf(review)}
          <VisibilityTag status={review.status} />
        </Flex>
        {review.body.length > 0 ? (
          <Typography.Paragraph style={{ margin: 0 }}>
            {review.body}
          </Typography.Paragraph>
        ) : null}
        <ReviewResponseComposer
          target={props.target}
          review={review}
          quiet
          {...(props.canRespond !== undefined
            ? { canRespond: props.canRespond }
            : {})}
          {...(props.signIn !== undefined ? { signIn: props.signIn } : {})}
        />
      </Flex>
    </List.Item>
  );
}

export function ReviewListPanel(props: ReviewListPanelProps): ReactElement {
  const t = useT();
  const runtime = useReviewsRuntime();
  const formatDate = useReviewDateFormat();
  const {
    mode,
    surface,
    target,
    signIn,
    renderAuthor,
    renderDate,
    canRespond,
    emptyState,
    ...listOptions
  } = props;

  const dateOf = (review: Review): ReactNode => {
    const shown = renderDate?.(review) ?? formatDate(review.created_at) ?? null;
    return shown === null ? null : (
      <Typography.Text type="secondary">{shown}</Typography.Text>
    );
  };

  // Absent → the pair's own state; anything else (a node, or an explicit
  // `null`) → exactly what the host said. `<LoadList>` folds a nullish `empty`
  // back to the substrate's default, so "nothing" has to reach it as a node
  // that renders nothing.
  const empty: ReactNode =
    emptyState === undefined ? (
      <EmptyState
        title={t(REVIEWS_I18N_KEYS.listEmpty)}
        hint={t(REVIEWS_I18N_KEYS.listEmptyHint)}
        testId="reviews-list-empty"
      />
    ) : (
      (emptyState ?? <></>)
    );

  return (
    <SkinTheme
      {...(mode !== undefined ? { mode } : {})}
      surface={surface ?? "raised"}
    >
      <ReviewList target={target} {...listOptions}>
        {(bag) => (
          <Flex vertical gap={spacing[2]} data-testid="reviews-list">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t(REVIEWS_I18N_KEYS.listHeading)}
            </Typography.Title>

            <ScopeNotice scope={bag.scope} testId="reviews-list-narrowed" />

            <LoadList
              state={bag.state}
              onRetry={bag.refresh}
              testId="reviews-list"
              empty={empty}
            >
              {(reviews) => (
                <>
                  <List
                    dataSource={[...reviews]}
                    data-testid="reviews-list-rows"
                    renderItem={(review: Review) => (
                      <ReviewRow
                        review={review}
                        target={target}
                        max={runtime.ratingBounds.max}
                        canRespond={canRespond}
                        signIn={signIn}
                        renderAuthor={renderAuthor}
                        dateOf={dateOf}
                      />
                    )}
                  />
                  <MoreButton bag={bag} />
                </>
              )}
            </LoadList>
          </Flex>
        )}
      </ReviewList>
    </SkinTheme>
  );
}
