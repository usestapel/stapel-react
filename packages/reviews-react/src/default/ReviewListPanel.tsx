/**
 * `<ReviewListPanel>` — the antd rendering of the review list.
 *
 * Two things it says out loud that a naive list would swallow:
 *
 * 1. A row that is not `published` carries a badge naming its state. It is on
 *    screen only because a moderator asked for `include=all`, and a pending
 *    or hidden review that looked like an ordinary one would misrepresent
 *    what the public can see.
 * 2. The author is a SLOT. The wire carries `author_id` and nothing else — no
 *    name, no avatar — so the skin renders a neutral label unless the host
 *    passes `renderAuthor`. Printing a raw user id would be both useless to a
 *    reader and a gratuitous disclosure.
 */
import type { ReactElement, ReactNode } from "react";
import { Button, Card, Empty, Flex, List, Rate, Skeleton, Tag, Typography } from "antd";
import {
  matchLoad,
  toFlowError,
  useActionGate,
  useDescribeFlowError,
  useT,
} from "@stapel/core";
import type { Review, ReviewTarget } from "../api/types.js";
import { ReviewList } from "../headless/ReviewList.js";
import type { ReviewListBag } from "../headless/ReviewList.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { reviewVisibility } from "../model/list.js";
import { useReviewsRuntime } from "../model/context.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { ReviewsSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface ReviewListPanelProps extends ThemeModeProp {
  readonly target: ReviewTarget;
  /** Ask for pending/hidden rows (granted only to a moderator of the target). */
  readonly include?: "all";
  readonly limit?: number;
  /** Turn `author_id` into something a reader recognises. See the header. */
  readonly renderAuthor?: (review: Review) => ReactNode;
  /** Format `created_at`. Absent means the raw ISO string is NOT shown. */
  readonly renderDate?: (review: Review) => ReactNode;
}

/** The badge a non-published row carries. `null` for an ordinary review. */
function VisibilityTag(props: { status: string }): ReactElement | null {
  const t = useT();
  const visibility = reviewVisibility(props.status);
  if (visibility === "published") return null;
  if (visibility === "pending") {
    return (
      <Tag color="warning" data-testid="reviews-row-pending">
        {t(REVIEWS_I18N_KEYS.statusPending)}
      </Tag>
    );
  }
  if (visibility === "hidden") {
    return (
      <Tag color="error" data-testid="reviews-row-hidden">
        {t(REVIEWS_I18N_KEYS.statusHidden)}
      </Tag>
    );
  }
  // A state this build does not know. Naming it beats rendering it as an
  // ordinary review (it may be one the server hides) and beats crashing.
  return (
    <Tag data-testid="reviews-row-unknown">
      {t(REVIEWS_I18N_KEYS.statusUnknown, { status: props.status })}
    </Tag>
  );
}

function ReviewRow(props: {
  review: Review;
  max: number;
  renderAuthor: ReviewListPanelProps["renderAuthor"];
  renderDate: ReviewListPanelProps["renderDate"];
}): ReactElement {
  const t = useT();
  const { review } = props;
  return (
    <List.Item data-testid="reviews-row" data-review-id={review.id}>
      <Flex vertical gap={4} style={{ width: "100%" }}>
        <Flex align="center" gap={8} wrap>
          <Rate disabled count={props.max} value={review.rating} />
          <Typography.Text strong>
            {props.renderAuthor?.(review) ?? t(REVIEWS_I18N_KEYS.authorFallback)}
          </Typography.Text>
          {props.renderDate ? (
            <Typography.Text type="secondary">
              {props.renderDate(review)}
            </Typography.Text>
          ) : null}
          <VisibilityTag status={review.status} />
        </Flex>
        {review.body.length > 0 ? (
          <Typography.Paragraph style={{ margin: 0 }}>
            {review.body}
          </Typography.Paragraph>
        ) : null}
        {review.response ? (
          <Card size="small" data-testid="reviews-row-response">
            <Typography.Text type="secondary">
              {t(REVIEWS_I18N_KEYS.responseHeading)}
            </Typography.Text>
            <Typography.Paragraph style={{ margin: 0 }}>
              {review.response.body}
            </Typography.Paragraph>
          </Card>
        ) : null}
      </Flex>
    </List.Item>
  );
}

function MoreButton(props: { bag: ReviewListBag }): ReactElement {
  const t = useT();
  const gate = useActionGate(props.bag.more);
  return (
    <Flex vertical align="center" gap={4}>
      <Button
        onClick={props.bag.loadMore}
        disabled={gate.disabled}
        loading={props.bag.loadingMore}
        data-testid="reviews-load-more"
        data-analytics="none"
        data-analytics-reason="paging further into a read — the host app wraps this with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      >
        {t(REVIEWS_I18N_KEYS.listLoadMore)}
      </Button>
      {gate.reason ? (
        <Typography.Text type="secondary" data-testid="reviews-load-more-reason">
          {gate.reason}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}

export function ReviewListPanel(props: ReviewListPanelProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const runtime = useReviewsRuntime();
  const { mode, target, renderAuthor, renderDate, ...listOptions } = props;

  return (
    <ReviewsSkinTheme {...(mode !== undefined ? { mode } : {})}>
      <ReviewList target={target} {...listOptions}>
        {(bag) => (
          <Flex vertical gap={8} data-testid="reviews-list">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t(REVIEWS_I18N_KEYS.listHeading)}
            </Typography.Title>

            {matchLoad(bag.state, {
              loading: () => (
                <Skeleton active data-testid="reviews-list-loading" />
              ),
              failed: (error) => (
                <ErrorAlert
                  testId="reviews-list-failed"
                  error={describe(toFlowError(error))}
                  action={
                    <Button
                      size="small"
                      onClick={bag.refresh}
                      data-analytics="none"
                      data-analytics-reason="recovery affordance for a failed read — host app wraps with its own tracked()"
                    >
                      {t(REVIEWS_I18N_KEYS.listRefresh)}
                    </Button>
                  }
                />
              ),
              ready: (reviews) =>
                reviews.length === 0 ? (
                  <Empty
                    data-testid="reviews-list-empty"
                    description={t(REVIEWS_I18N_KEYS.listEmpty)}
                  />
                ) : (
                  <>
                    <List
                      dataSource={[...reviews]}
                      data-testid="reviews-list-rows"
                      renderItem={(review: Review) => (
                        <ReviewRow
                          review={review}
                          max={runtime.ratingBounds.max}
                          renderAuthor={renderAuthor}
                          renderDate={renderDate}
                        />
                      )}
                    />
                    <MoreButton bag={bag} />
                  </>
                ),
            })}
          </Flex>
        )}
      </ReviewList>
    </ReviewsSkinTheme>
  );
}
