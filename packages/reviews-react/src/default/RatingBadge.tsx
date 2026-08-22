/**
 * `<RatingBadge>` — the stars-and-count line, over either source of the two
 * numbers.
 *
 * The whole component is built around one refusal: when `count` is `0` there
 * is no star row at all, only the "no reviews yet" sentence. antd's `<Rate>`
 * given `value={0}` draws five empty stars, which is a perfectly good
 * rendering of the worst possible score and a completely wrong rendering of
 * "nobody has rated this". `ratingSummary()` makes the distinction, and this
 * skin honours it by not reaching `<Rate>` at all in that arm.
 */
import type { ReactElement } from "react";
import { Flex, Rate, Skeleton, Typography } from "antd";
import { matchLoad, toFlowError, useDescribeFlowError, useT } from "@stapel/core";
import { ReviewAggregate } from "../headless/ReviewAggregate.js";
import type { ReviewAggregateProps } from "../headless/ReviewAggregate.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { ReviewsSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export type RatingBadgeProps = ThemeModeProp &
  Omit<ReviewAggregateProps, "children">;

export function RatingBadge(props: RatingBadgeProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const { mode, ...aggregateProps } = props;

  return (
    <ReviewsSkinTheme {...(mode !== undefined ? { mode } : {})}>
      <ReviewAggregate {...aggregateProps}>
        {(bag) => (
          <Flex align="center" gap={8} data-testid="reviews-rating">
            {matchLoad(bag.state, {
              loading: () => (
                <Skeleton.Button active data-testid="reviews-rating-loading" />
              ),
              failed: (error) => (
                <ErrorAlert
                  testId="reviews-rating-failed"
                  error={describe(toFlowError(error))}
                />
              ),
              ready: (summary) =>
                summary.rated ? (
                  <>
                    <Rate
                      disabled
                      allowHalf
                      count={bag.max}
                      value={summary.rounded}
                      data-testid="reviews-rating-stars"
                    />
                    <Typography.Text strong>
                      {t(REVIEWS_I18N_KEYS.ratingValue, {
                        avg: summary.rounded,
                        max: bag.max,
                      })}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {t(REVIEWS_I18N_KEYS.ratingCount, {
                        count: summary.count,
                      })}
                    </Typography.Text>
                  </>
                ) : (
                  <Typography.Text
                    type="secondary"
                    data-testid="reviews-rating-none"
                  >
                    {t(REVIEWS_I18N_KEYS.ratingNone)}
                  </Typography.Text>
                ),
            })}
          </Flex>
        )}
      </ReviewAggregate>
    </ReviewsSkinTheme>
  );
}
