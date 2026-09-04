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

export function CardBadges(props: CardBadgesProps): ReactElement | null {
  const { locale } = useI18n();
  const rows = props.rows as readonly CardBadgeRow[];

  if (rows.length === 0) return null;

  if (hasCardBadgeContract(rows)) {
    const printed = cardBadgeTexts(rows, locale);
    if (printed.length === 0) return null;
    if (props.variant === "line") {
      return (
        <span data-testid={props.testId ?? "listings-card-badges"}>
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
    <Typography.Text type="secondary" ellipsis data-testid={props.testId}>
      <CardBadges rows={props.rows} copy={props.copy} variant="line" testId={`${props.testId}-text`} />
    </Typography.Text>
  );
}
