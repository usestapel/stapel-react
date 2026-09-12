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
 * ── AND NOTHING IS CUT MID-WORD (0.8.2) ───────────────────────────────────
 *
 * Giving the count an ellipsis fixed the height and produced a new defect:
 * on a tile card the live storefront drew "4.3 out of 5 · 6 revi…", a word
 * broken in the middle. So the count no longer carries an ellipsis at all.
 * Instead the badge measures its own box and drops whole FACTS in a stated order —
 * the scale, then four of the five stars, then the count's long form, then
 * the count — each step a form somebody would write by hand. `ratingFit.ts`
 * holds that ladder and the reasoning behind it.
 *
 * Every fact the ladder takes off the screen stays in the accessibility tree
 * in a `visuallyHidden` span: the column got narrower, the rating did not
 * lose a number.
 *
 * The glyph size is stated here as well as in the skin: `@stapel/tokens-antd`
 * excludes a READ-ONLY `<Rate>` from the phone touch floor (a rating nobody
 * can tick is not a touch target), and this component pins the same icon step
 * inline so the badge is the right size under a host's own `ConfigProvider`
 * too — including one that never mounts the skin's phone sheet.
 */
import { useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Flex, Rate, Typography } from "antd";
import { useTPlural, useT } from "@stapel/core";
import {
  LoadBoundary,
  SkinTheme,
  useElementWidth,
  visuallyHidden,
} from "@stapel/tokens-antd/skin";
import { fontSize, spacing } from "@stapel/tokens";
import { pickRatingFit, ratingFitShape } from "./ratingFit.js";
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

/**
 * "4 reviews" — the fact the ladder gives up first, and the only one that
 * disappears entirely.
 *
 * It does NOT shrink and does NOT carry an ellipsis. Both were here in 0.8.1
 * and both were the defect: a flex item that may shrink below its content
 * with `text-overflow: ellipsis` is exactly the machinery that produced
 * a word cut in the middle. The fit is decided before the paint now, so by the
 * time this renders there is room for whichever form of the word was chosen.
 */
const COUNT: CSSProperties = { flex: "0 0 auto", whiteSpace: "nowrap" };

/** Between the score and the count, for the eye only. */
const DOT: CSSProperties = { flex: "0 0 auto" };

export type RatingBadgeProps = ThemeModeProp &
  Omit<ReviewAggregateProps, "children">;

export function RatingBadge(props: RatingBadgeProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { mode, surface, ...aggregateProps } = props;

  // The box the host actually granted this badge — never the viewport. In a
  // card's seller line that is a flex item, so the number read here is the
  // width AFTER the line shrank it, which is the width the ladder has to fit.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const { width } = useElementWidth(boxRef);

  return (
    <SkinTheme
      {...(mode !== undefined ? { mode } : {})}
      surface={surface ?? "raised"}
    >
      <ReviewAggregate {...aggregateProps}>
        {(bag) => (
          <Flex
            ref={boxRef}
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
                  (() => {
                    const score = t(REVIEWS_I18N_KEYS.ratingValue, {
                      avg: summary.rounded,
                      max: bag.max,
                    });
                    const scoreBare = t(REVIEWS_I18N_KEYS.ratingValueBare, {
                      avg: summary.rounded,
                    });
                    const count = tPlural(REVIEWS_I18N_PLURALS.ratingCount, {
                      count: summary.count,
                    });
                    const countShort = tPlural(
                      REVIEWS_I18N_PLURALS.ratingCountShort,
                      { count: summary.count }
                    );
                    const shape = ratingFitShape(
                      pickRatingFit(width, {
                        score,
                        scoreBare,
                        count,
                        countShort,
                        stars: bag.max,
                      })
                    );
                    return (
                      <div
                        style={BADGE_ROW}
                        data-testid="reviews-rating-line"
                        data-fit={shape.allStars ? "wide" : "compact"}
                      >
                        {/*
                          Everything visible is `aria-hidden`, and the whole
                          rating is spoken once from the span at the end. The
                          alternative — letting a reader assemble the visible
                          parts — would have it announce a different rating at
                          every rung of the ladder, and announce "1 star" from
                          the collapsed single glyph, which is a lie.
                        */}
                        <Rate
                          disabled
                          allowHalf
                          aria-hidden="true"
                          count={shape.allStars ? bag.max : 1}
                          value={shape.allStars ? summary.rounded : 1}
                          style={STARS}
                          data-testid="reviews-rating-stars"
                        />
                        <Typography.Text
                          strong
                          aria-hidden="true"
                          style={SCORE}
                          data-testid="reviews-rating-score"
                        >
                          {shape.withScale ? score : scoreBare}
                        </Typography.Text>
                        {shape.withCount ? (
                          <>
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
                              aria-hidden="true"
                              style={COUNT}
                              data-testid="reviews-rating-count"
                            >
                              {shape.shortCount ? countShort : count}
                            </Typography.Text>
                          </>
                        ) : null}
                        <span
                          style={visuallyHidden}
                          data-testid="reviews-rating-full"
                        >
                          {`${score}, ${count}`}
                        </span>
                      </div>
                    );
                  })()
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
