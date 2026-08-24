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
 *
 * The count is a PLURAL, through core's `tPlural`: "1 reviews" was what the
 * flat key produced in English, and Russian sidestepped the whole question by
 * putting the numeral last rather than agreeing with it.
 */
import type { ReactElement } from "react";
import { Flex, Rate, Typography } from "antd";
import { useTPlural, useT } from "@stapel/core";
import { LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { ReviewAggregate } from "../headless/ReviewAggregate.js";
import type { ReviewAggregateProps } from "../headless/ReviewAggregate.js";
import { REVIEWS_I18N_KEYS, REVIEWS_I18N_PLURALS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

export type RatingBadgeProps = ThemeModeProp &
  Omit<ReviewAggregateProps, "children">;

export function RatingBadge(props: RatingBadgeProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { mode, surface, ...aggregateProps } = props;

  return (
    <SkinTheme
      {...(mode !== undefined ? { mode } : {})}
      surface={surface ?? "raised"}
    >
      <ReviewAggregate {...aggregateProps}>
        {(bag) => (
          <Flex align="center" gap={spacing[2]} wrap data-testid="reviews-rating">
            <LoadBoundary
              state={bag.state}
              testId="reviews-rating"
              skeletonRows={1}
            >
              {(summary) =>
                summary.rated ? (
                  <Flex align="center" gap={spacing[2]} wrap>
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
                      {tPlural(REVIEWS_I18N_PLURALS.ratingCount, {
                        count: summary.count,
                      })}
                    </Typography.Text>
                  </Flex>
                ) : (
                  <Typography.Text
                    type="secondary"
                    data-testid="reviews-rating-none"
                  >
                    {t(REVIEWS_I18N_KEYS.ratingNone)}
                  </Typography.Text>
                )
              }
            </LoadBoundary>
          </Flex>
        )}
      </ReviewAggregate>
    </SkinTheme>
  );
}
