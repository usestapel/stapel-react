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
 *
 * ── ONE LINE, and what gives way when there is not room for it ────────────
 *
 * The badge used to be a `wrap`ping flex row of three equal children, which
 * is a layout with no opinion: whatever ran out of room first broke, and on
 * the live storefront that was the stars. Measured on a phone at 390px
 * (2026-09-13): the phone skin's touch floor drew a 32px glyph on a 44px
 * pitch, so the five-star row wanted 220px inside a feed card's 105px text
 * column. It wrapped into three rows of stars, the score and the count each
 * took a line of their own, and one rating stood **196px tall** — taller than
 * everything else on the card put together. At 320px the column is 44px, the
 * stars stacked into a vertical column of five, and the block was 356px.
 *
 * So the row states its own priority instead of leaving it to whatever
 * measured widest:
 *
 *  - the STARS never shrink and never wrap (`flex: 0 0 auto`,
 *    `white-space: nowrap`). They are the badge; a broken star row is not a
 *    smaller rating, it is a broken card.
 *  - the SCORE ("4 of 5") does not shrink either — it is five characters and
 *    it is the number a person actually reads.
 *  - the COUNT ("4 reviews") is the one that gives way: `flex: 0 1 auto`,
 *    `min-inline-size: 0` and an ellipsis. It is the least of the three facts
 *    and the only one that can be cut without lying.
 *
 * The separator is a middot rather than a gap, so the three facts read as one
 * sentence when they are on one line — and it is `aria-hidden`, because a
 * screen reader reads the three texts in order and a dot between them is
 * noise.
 *
 * The glyph size is stated here as well as in the skin: `@stapel/tokens-antd`
 * excludes a READ-ONLY `<Rate>` from the phone touch floor (a rating nobody
 * can tick is not a touch target), and this component pins the same icon step
 * inline so the badge is the right size under a host's own `ConfigProvider`
 * too — including one that never mounts the skin's phone sheet.
 */
import type { CSSProperties, ReactElement } from "react";
import { Flex, Rate, Typography } from "antd";
import { useTPlural, useT } from "@stapel/core";
import { LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { fontSize, spacing } from "@stapel/tokens";
import { ReviewAggregate } from "../headless/ReviewAggregate.js";
import type { ReviewAggregateProps } from "../headless/ReviewAggregate.js";
import { REVIEWS_I18N_KEYS, REVIEWS_I18N_PLURALS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

/**
 * The row: one line, and it is the CONTAINER that may be narrow, never the
 * stars. `min-inline-size: 0` on the row itself is what lets the count's own
 * ellipsis fire — a flex item's default `min-width: auto` refuses to shrink
 * below its content and pushes the overflow out of the card instead.
 */
const BADGE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1],
  flexWrap: "nowrap",
  minInlineSize: 0,
  maxInlineSize: "100%",
};

/**
 * The stars: the one thing in this badge that is never cut.
 *
 * `fontSize.md` is the dictionary's icon step — the same number
 * `@stapel/tokens-antd` uses for a read-only `<Rate>` under its phone sheet,
 * read from the same token package rather than imported across the seam, so
 * this pair's peer floor does not move for one integer.
 */
const STARS: CSSProperties = {
  fontSize: fontSize.md.fontSize,
  lineHeight: 1,
  flex: "0 0 auto",
  whiteSpace: "nowrap",
};

/** "4 of 5" — five characters, and the number a person reads. */
const SCORE: CSSProperties = { flex: "0 0 auto", whiteSpace: "nowrap" };

/** "4 reviews" — the fact that gives way first, and the only one that can. */
const COUNT: CSSProperties = {
  flex: "0 1 auto",
  minInlineSize: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/** Between the score and the count, for the eye only. */
const DOT: CSSProperties = { flex: "0 0 auto" };

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
          <Flex
            align="center"
            gap={spacing[2]}
            // The badge is only ever as wide as the column it was given: a
            // flex item's default `min-width: auto` is what pushed the old
            // row out of a 105px card column instead of letting it shrink.
            style={{ minInlineSize: 0, maxInlineSize: "100%" }}
            data-testid="reviews-rating"
          >
            <LoadBoundary
              state={bag.state}
              testId="reviews-rating"
              skeletonRows={1}
            >
              {(summary) =>
                summary.rated ? (
                  <div style={BADGE_ROW} data-testid="reviews-rating-line">
                    <Rate
                      disabled
                      allowHalf
                      count={bag.max}
                      value={summary.rounded}
                      style={STARS}
                      data-testid="reviews-rating-stars"
                    />
                    <Typography.Text
                      strong
                      style={SCORE}
                      data-testid="reviews-rating-score"
                    >
                      {t(REVIEWS_I18N_KEYS.ratingValue, {
                        avg: summary.rounded,
                        max: bag.max,
                      })}
                    </Typography.Text>
                    <Typography.Text
                      type="secondary"
                      aria-hidden="true"
                      style={DOT}
                      data-testid="reviews-rating-dot"
                    >
                      ·
                    </Typography.Text>
                    <Typography.Text
                      type="secondary"
                      style={COUNT}
                      data-testid="reviews-rating-count"
                    >
                      {tPlural(REVIEWS_I18N_PLURALS.ratingCount, {
                        count: summary.count,
                      })}
                    </Typography.Text>
                  </div>
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
