/**
 * `<ReviewModerationPanel>` — the moderation queue, at last on a screen.
 *
 * stapel-reviews has shipped `POST {id}/moderate` since 0.1: a hide/publish
 * verdict, an emitted fact carrying the moderator's reason, an aggregate that
 * recomputes. No product in the fleet could reach it. This pane is that
 * capability, and it is built around the three facts that make a review queue
 * different from a list:
 *
 * 1. **The scope is granted by the server, not requested by the client.**
 *    `include=all` is honoured only for a moderator of the target and narrowed
 *    to published-only for everyone else, silently. So the pane says what it
 *    asked for, shows what arrived, and — when nothing proves the grant —
 *    prints the narrowing sentence instead of pretending the queue is empty.
 * 2. **Every verdict is state-gated, and off is a sentence.** Re-applying the
 *    state a row is already in is an upstream no-op that answers 200, so the
 *    control is blocked here with "Already hidden" rather than sent. Not being
 *    a moderator blocks it with a different sentence. Both are visible text
 *    beside the button, never a tooltip on a control that cannot be hovered.
 * 3. **Hiding is destructive enough to confirm.** It takes the review off
 *    every page AND out of the rating. One `SkinConfirm` per pane, keyed by
 *    the row awaiting the answer — a bottom sheet on a phone, a small modal
 *    above it.
 *
 * The filter is honest about its own reach: it selects among the rows that
 * have LOADED, because anchor pagination has no server-side status filter.
 * The empty arm says so rather than claiming there is nothing pending.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Card, Flex, Input, Rate, Segmented, Typography } from "antd";
import { useT } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinConfirm,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { Review, ReviewTarget } from "../api/types.js";
import { ReviewList } from "../headless/ReviewList.js";
import type { ReviewListBag } from "../headless/ReviewList.js";
import { ReviewModeration } from "../headless/ReviewModeration.js";
import type { ReviewModerationBag } from "../headless/ReviewModeration.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { useReviewsRuntime } from "../model/context.js";
import { useReviewDateFormat } from "../model/dates.js";
import { reviewVisibility } from "../model/list.js";
import { MoreButton, ScopeNotice, VisibilityTag } from "./listParts.js";
import type { ThemeModeProp } from "./types.js";

/** Which loaded rows the queue is showing. */
export type ModerationFilter = "all" | "pending" | "hidden";

const FILTERS: readonly ModerationFilter[] = ["all", "pending", "hidden"];

const FILTER_LABELS: Readonly<Record<ModerationFilter, string>> = {
  all: REVIEWS_I18N_KEYS.moderationFilterAll,
  pending: REVIEWS_I18N_KEYS.moderationFilterPending,
  hidden: REVIEWS_I18N_KEYS.moderationFilterHidden,
};

export interface ReviewModerationPanelProps extends ThemeModeProp {
  readonly target: ReviewTarget;
  /**
   * Does the host believe this viewer moderates this target? The pane renders
   * either way — the verdicts are switched off with their reason when it is
   * absent, because a moderator whose `can_moderate` callback is mis-wired
   * needs to see the control refused, not a pane with no buttons on it.
   */
  readonly canModerate?: boolean;
  readonly limit?: number;
  /** Turn `author_id` into something a moderator recognises. */
  readonly renderAuthor?: (review: Review) => ReactNode;
  /** Override the pair's short absolute date. */
  readonly renderDate?: (review: Review) => ReactNode;
}

function keep(review: Review, filter: ModerationFilter): boolean {
  if (filter === "all") return true;
  return reviewVisibility(review.status) === filter;
}

/** The sentence a landed verdict leaves behind, named by the resulting state. */
function settledKey(bag: ReviewModerationBag): string | null {
  if (bag.settled === null) return null;
  if (bag.visibility === "hidden") return REVIEWS_I18N_KEYS.moderationDoneHidden;
  if (bag.visibility === "published") {
    return REVIEWS_I18N_KEYS.moderationDonePublished;
  }
  return REVIEWS_I18N_KEYS.moderationDoneUnknown;
}

function ModerationRow(props: {
  bag: ReviewModerationBag;
  max: number;
  renderAuthor: ReviewModerationPanelProps["renderAuthor"];
  // Not a slot — see ReviewListPanel: the host slot is already resolved.
  dateOf: (review: Review) => ReactNode;
  onAskHide: () => void;
}): ReactElement {
  const t = useT();
  const { bag } = props;
  const { review } = bag;
  const settled = settledKey(bag);
  return (
    <Card
      size="small"
      data-testid="reviews-moderation-row"
      data-review-id={review.id}
      data-review-status={bag.visibility}
    >
      <Flex vertical gap={spacing[2]}>
        <Flex align="center" gap={spacing[2]} wrap>
          <Rate disabled count={props.max} value={review.rating} />
          <Typography.Text strong style={{ minWidth: 0 }}>
            {props.renderAuthor?.(review) ??
              t(REVIEWS_I18N_KEYS.authorFallback)}
          </Typography.Text>
          {props.dateOf(review)}
          <VisibilityTag status={review.status} alwaysShow />
          {settled !== null ? (
            <Typography.Text
              type="success"
              data-testid="reviews-moderation-settled"
            >
              {t(settled)}
            </Typography.Text>
          ) : null}
        </Flex>

        {review.body.length > 0 ? (
          <Typography.Paragraph style={{ margin: 0 }}>
            {review.body}
          </Typography.Paragraph>
        ) : null}

        <Flex vertical gap={spacing[1]}>
          <Typography.Text type="secondary">
            {t(REVIEWS_I18N_KEYS.moderationReasonLabel)}
          </Typography.Text>
          <Input
            value={bag.reason}
            onChange={(event) => bag.setReason(event.target.value)}
            placeholder={t(REVIEWS_I18N_KEYS.moderationReasonPlaceholder)}
            aria-label={t(REVIEWS_I18N_KEYS.moderationReasonLabel)}
            data-testid="reviews-moderation-reason"
          />
          <Typography.Text type="secondary">
            {t(REVIEWS_I18N_KEYS.moderationReasonHint)}
          </Typography.Text>
        </Flex>

        <ErrorAlert thrown={bag.error} testId="reviews-moderation-failed" />

        <Flex gap={spacing[3]} wrap align="flex-start">
          <GatedButton
            gate={bag.canHide}
            danger
            onClick={props.onAskHide}
            testId="reviews-moderation-hide"
            data-analytics="none"
            data-analytics-reason="opens the hide confirmation — the verdict itself is the tracked act, one level up"
          >
            {t(REVIEWS_I18N_KEYS.moderationHide)}
          </GatedButton>
          <GatedButton
            gate={bag.canPublish}
            type="primary"
            onClick={bag.publish}
            loading={bag.moderating}
            testId="reviews-moderation-publish"
            data-analytics="none"
            data-analytics-reason="business action — the host app wraps this with its own tracked(); the pair ships no analytics runtime"
          >
            {t(REVIEWS_I18N_KEYS.moderationPublish)}
          </GatedButton>
        </Flex>
      </Flex>
    </Card>
  );
}

/**
 * One row's moderation state, hoisted so the pane's single `SkinConfirm` can
 * drive the hide verdict of whichever row asked for it (the recipe: one
 * confirm per list keyed by the pending id, never one per row).
 */
function Rows(props: {
  bag: ReviewListBag;
  target: ReviewTarget;
  canModerate: boolean;
  filter: ModerationFilter;
  max: number;
  renderAuthor: ReviewModerationPanelProps["renderAuthor"];
  dateOf: (review: Review) => ReactNode;
}): ReactElement {
  const t = useT();
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <LoadList
      state={props.bag.state}
      onRetry={props.bag.refresh}
      testId="reviews-moderation"
      empty={
        <EmptyState
          title={t(REVIEWS_I18N_KEYS.moderationEmpty)}
          hint={t(REVIEWS_I18N_KEYS.moderationEmptyHint)}
          testId="reviews-moderation-empty"
        />
      }
    >
      {(reviews) => {
        const shown = reviews.filter((review) => keep(review, props.filter));
        if (shown.length === 0) {
          return (
            <EmptyState
              title={t(REVIEWS_I18N_KEYS.moderationEmptyFiltered)}
              compact
              testId="reviews-moderation-empty-filtered"
            />
          );
        }
        return (
          <Flex vertical gap={spacing[3]} data-testid="reviews-moderation-rows">
            {shown.map((review) => (
              <ReviewModeration
                key={review.id}
                target={props.target}
                review={review}
                canModerate={props.canModerate}
              >
                {(moderation) => (
                  <>
                    <ModerationRow
                      bag={moderation}
                      max={props.max}
                      renderAuthor={props.renderAuthor}
                      dateOf={props.dateOf}
                      onAskHide={() => setConfirming(review.id)}
                    />
                    <SkinConfirm
                      open={confirming === review.id}
                      danger
                      title={t(REVIEWS_I18N_KEYS.moderationConfirmHide)}
                      body={t(REVIEWS_I18N_KEYS.moderationConfirmHideBody)}
                      confirmLabel={t(REVIEWS_I18N_KEYS.moderationHide)}
                      confirming={moderation.moderating}
                      onConfirm={() => {
                        moderation.hide();
                        setConfirming(null);
                      }}
                      onCancel={() => setConfirming(null)}
                      data-testid="reviews-moderation-confirm"
                    />
                  </>
                )}
              </ReviewModeration>
            ))}
          </Flex>
        );
      }}
    </LoadList>
  );
}

export function ReviewModerationPanel(
  props: ReviewModerationPanelProps
): ReactElement {
  const t = useT();
  const runtime = useReviewsRuntime();
  const formatDate = useReviewDateFormat();
  const {
    mode,
    surface,
    target,
    canModerate = false,
    limit,
    renderAuthor,
    renderDate,
  } = props;
  const [filter, setFilter] = useState<ModerationFilter>("all");

  const dateOf = (review: Review): ReactNode => {
    const shown = renderDate?.(review) ?? formatDate(review.created_at) ?? null;
    return shown === null ? null : (
      <Typography.Text type="secondary">{shown}</Typography.Text>
    );
  };

  return (
    <SkinTheme
      {...(mode !== undefined ? { mode } : {})}
      surface={surface ?? "raised"}
    >
      <ReviewList
        target={target}
        include="all"
        canModerate={canModerate}
        {...(limit !== undefined ? { limit } : {})}
      >
        {(bag) => (
          <Flex vertical gap={spacing[3]} data-testid="reviews-moderation-panel">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t(REVIEWS_I18N_KEYS.moderationHeading)}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t(REVIEWS_I18N_KEYS.moderationHint)}
            </Typography.Text>

            <ScopeNotice scope={bag.scope} testId="reviews-moderation-narrowed" />

            <Segmented<ModerationFilter>
              value={filter}
              onChange={setFilter}
              aria-label={t(REVIEWS_I18N_KEYS.moderationFilterLabel)}
              data-testid="reviews-moderation-filter"
              options={FILTERS.map((id) => ({
                value: id,
                label: t(FILTER_LABELS[id]),
              }))}
            />

            <Rows
              bag={bag}
              target={target}
              canModerate={canModerate}
              filter={filter}
              max={runtime.ratingBounds.max}
              renderAuthor={renderAuthor}
              dateOf={dateOf}
            />

            <MoreButton bag={bag} />
          </Flex>
        )}
      </ReviewList>
    </SkinTheme>
  );
}
