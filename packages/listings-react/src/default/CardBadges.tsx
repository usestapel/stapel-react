/**
 * A card's badge line, drawn against the CARD BADGE CONTRACT when the server
 * speaks it and exactly as it draws today when it does not.
 *
 * The contract itself — the five keys, the four presentations, and the
 * measured "Brick · 3 · 9" that earned it — is `model/cardBadges.ts`.
 * This file is only the two arms:
 *
 *  - **the contract arm.** Each element already carries everything a reader
 *    needs (its name, its unit, its resolved copy, and the server's decision
 *    about which of them to print), so the text comes from `cardBadgeText`
 *    and nothing here reaches for a category, a formatter or an option table;
 *  - **the fallback arm.** No element declares a `presentation`, which means
 *    a backend older than stapel-listings 0.21.3 — so the row goes through
 *    `@stapel/attributes-react`'s `<FeatureBadges>` off the stored DAO's own
 *    config, byte-identical to the release before this one.
 *
 * One component, called by all three card surfaces, for the same reason
 * `CardTarget` is one function: three cards each deciding what a badge says
 * is three places for the bare numbers to come back.
 */
import type { ReactElement } from "react";
import { Flex, Tag, Typography } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { useI18n } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { FeatureBadges } from "@stapel/attributes-react/default";
import type { ListingFeatureDao } from "../api/types.js";
import type { CardBadgeRow } from "../model/cardBadges.js";
import { cardBadgeTexts, hasCardBadgeContract } from "../model/cardBadges.js";
import { featuresDtoFromDaoList, featuresFromDaoList } from "../model/features.js";
import {
  CARD_CLAMP_STYLE_HREF,
  LOCATION_CLAMP_CLASS,
  cardClampCss,
} from "./titleClamp.js";
import type { FeatureCopySource } from "../model/features.js";

export interface CardBadgesProps {
  /** The stored projection — `features_badges` or `features_title`. */
  readonly rows: readonly ListingFeatureDao[];
  /** The category's option table, where the surface has one. Used by the
   * FALLBACK arm only: a contract element carries its own resolved copy. */
  readonly copy: FeatureCopySource;
  /**
   * `"badges"` draws tags (the card's badge strip); `"line"` draws one
   * dot-separated run of secondary text (the seller's own spec line under
   * the title, which is already a line on every surface).
   */
  readonly variant: "badges" | "line";
  readonly testId?: string;
}

/** The separator of a spec line — the one every classified uses. */
const LINE_SEPARATOR = " · ";

/** The class the spec line's own box carries. */
export const CARD_SPEC_LINE_CLASS = "stapel-listing-spec-line";
/** The class the spec line's TEXT carries — see {@link cardSpecLineCss}. */
export const CARD_SPEC_TEXT_CLASS = "stapel-listing-spec-line-text";
/** The `href` the hoisted spec-line stylesheet is deduplicated by. */
export const CARD_SPEC_STYLE_HREF = "stapel-listings-card-spec-line";

/**
 * THE SPEC LINE TRUNCATES, AND THE THING THAT TRUNCATES IS THE THING THAT
 * HOLDS THE TEXT.
 *
 * `<Typography.Text ellipsis>` writes `overflow:hidden`, `white-space:nowrap`
 * and `text-overflow:ellipsis` on ITSELF, and the text inside it is a separate
 * `<span>` — the badge row's own element. An inline span lays out at its
 * natural width regardless of what its parent clips, so the line was drawn
 * correctly (the overflow is hidden) over a box that is wrong: the stand's
 * tidiness probe measured `listings-card-specs-text` 57px wider than the
 * element it sits in. A box that reports a width nothing on screen has is a
 * defect whether or not a pixel of it is visible — it is what a container
 * measuring the card, a sticky-header calculation or the next layout rule
 * reads.
 *
 * So the truncation moved ONTO the span, and the box became a flex container
 * so the span could shrink below its content (`min-inline-size: 0`, which is
 * the declaration without which every other rule here is decoration).
 *
 * ── AND IT NEVER ACTED. The second round, and the reason ──────────────────
 *
 * Two reviewers re-measured the card at 390 on the live stand a release later
 * and the same span still ran past its column — 7px on one category page and
 * 47px on another. The class was on the element, the sheet was in the
 * document, every declaration was in it. What was missing is that antd writes
 *
 *     a.ant-typography-ellipsis, span.ant-typography-ellipsis
 *       { display: inline-block; max-width: 100% }
 *
 * (`antd/es/typography/style/mixins.js`, `getEllipsisStyles`), which scores
 * (0,1,1) against a single class's (0,1,0). It wins on SPECIFICITY, so no
 * hoisting and no load order could have saved the rule: the box was never a
 * flex container, the span was therefore never a flex child, and
 * `min-inline-size: 0` on an element that is not a flex item does nothing.
 * `.ant-typography-ellipsis-single-line` then set `white-space: nowrap`,
 * which INHERITS, so the span could not break either.
 *
 * Measured in headless Chromium on the DOM this component actually renders,
 * with antd's own two rules, in a 180px column: the box computed
 * `display: block`, the span `display: inline` and 454.77px wide — 274.77px
 * past its column. With the fix below: box `display: flex`, span 180px, zero
 * past the column.
 *
 * ── The fix, and why it is not a third rule ───────────────────────────────
 *
 * `ellipsis` goes, because the prop IS what puts those classes on the box.
 * The cut is then `titleClamp.ts` at {@link LOCATION_CLAMP_LINES} — the same
 * module, the same class and the same hoisted sheet that already cut the
 * title, the place and the description on this card, ONE line, with the
 * ellipsis after a whole word instead of inside one. What stays here is the
 * BOX: `display: flex` and `min-inline-size: 0`, written with the class
 * doubled so the declaration outranks any single class or element-plus-class
 * selector whatever the load order — which is the ladder `titleClamp.ts`
 * argues for its own rule, for the same reason, against the same antd sheet.
 *
 * A sheet rather than inline styles because the span is rendered by
 * `<CardBadges>` and the box by antd, and an inline style cannot reach a
 * child.
 */
export function cardSpecLineCss(): string {
  const self = `.${CARD_SPEC_LINE_CLASS}.${CARD_SPEC_LINE_CLASS}`;
  return [
    `${self}{display:flex;min-inline-size:0}`,
    `.${CARD_SPEC_TEXT_CLASS}{flex:1 1 auto;min-inline-size:0}`,
  ].join("");
}

export function CardBadges(props: CardBadgesProps): ReactElement | null {
  const { locale } = useI18n();
  const rows = props.rows as readonly CardBadgeRow[];

  if (rows.length === 0) return null;

  if (hasCardBadgeContract(rows)) {
    // The variant is not only a layout: it decides how a caption is joined to
    // its answer, because a chip has a border and a line has a dot (D421).
    const printed = cardBadgeTexts(rows, locale, props.variant === "line" ? "line" : "badge");
    if (printed.length === 0) return null;
    if (props.variant === "line") {
      return (
        <span
          // The pair's own box rule, and the CUT, which is the card's one
          // answer to "how do I cut text" (`titleClamp.ts`) rather than a
          // second one written here.
          className={`${CARD_SPEC_TEXT_CLASS} ${LOCATION_CLAMP_CLASS}`}
          data-testid={props.testId ?? "listings-card-badges"}
        >
          {printed.map((one) => one.text).join(LINE_SEPARATOR)}
        </span>
      );
    }
    return (
      <SkinTheme surface="bare">
        <Flex gap={spacing[1]} wrap data-testid={props.testId ?? "listings-card-badges"}>
          {printed.map((one) => (
            <Tag key={one.slug} data-testid={`listings-card-badge-${one.slug}`}>
              {one.text}
            </Tag>
          ))}
        </Flex>
      </SkinTheme>
    );
  }

  // The older backend. Exactly what shipped before the contract existed.
  const views = featuresFromDaoList(rows, props.copy);
  if (views.length === 0) return null;
  return (
    <FeatureBadges
      features={views.map((view) => view.feature)}
      values={featuresDtoFromDaoList(rows)}
    />
  );
}

/** The spec line under a card's title, wrapped in the secondary, truncating
 * text every surface already draws it in. */
export function CardSpecLine(props: {
  readonly rows: readonly ListingFeatureDao[];
  readonly copy: FeatureCopySource;
  readonly testId: string;
}): ReactElement | null {
  if (props.rows.length === 0) return null;
  return (
    <>
      <style href={CARD_SPEC_STYLE_HREF} precedence="default">
        {cardSpecLineCss()}
      </style>
      {/* The CUT's own sheet. Every card surface already mounts it for its
          title and its place, and React 19 deduplicates on the `href`, so
          this costs nothing on a card and makes the component whole for a
          host that draws a spec line on its own. */}
      <style href={CARD_CLAMP_STYLE_HREF} precedence="default">
        {cardClampCss()}
      </style>
      {/* NO `ellipsis`. The prop is what puts `ant-typography-ellipsis` on
          this box, and antd's `span.ant-typography-ellipsis{display:
          inline-block}` outranks the pair's own `display:flex` on
          specificity — see the note on `cardSpecLineCss`. */}
      <Typography.Text
        type="secondary"
        className={CARD_SPEC_LINE_CLASS}
        data-testid={props.testId}
      >
        <CardBadges
          rows={props.rows}
          copy={props.copy}
          variant="line"
          testId={`${props.testId}-text`}
        />
      </Typography.Text>
    </>
  );
}
