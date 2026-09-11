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
 * So the truncation moves ONTO the span. The line becomes a flex container
 * and the span a flex child with `min-inline-size: 0`, which is the
 * declaration that lets a flex child shrink below its content at all — without
 * it `min-width:auto` keeps the box at the text's natural width and every
 * other rule here is decoration.
 *
 * A sheet rather than inline styles because the span is rendered by
 * `<CardBadges>` and the box by antd, and an inline style cannot reach a
 * child.
 */
export function cardSpecLineCss(): string {
  return [
    `.${CARD_SPEC_LINE_CLASS}{display:flex;min-inline-size:0}`,
    `.${CARD_SPEC_TEXT_CLASS}{flex:1 1 auto;min-inline-size:0;` +
      `overflow:hidden;white-space:nowrap;text-overflow:ellipsis}`,
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
          className={CARD_SPEC_TEXT_CLASS}
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
      {/* `ellipsis` stays: it is what antd's own secondary text looks like
          when it truncates, and the sheet above moves the clipping onto the
          span that actually holds the words. */}
      <Typography.Text
        type="secondary"
        ellipsis
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
