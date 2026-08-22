/**
 * The GENERIC card — the fallback behind `renderCard`, and the default the
 * spec (§3.7) says the pair must ship.
 *
 * `SearchItem.card` is a free-form object: "stored row fields, so a result
 * page costs one query". Which fields it holds is the DOC TYPE's business,
 * not search's, so this card reads a small, documented set of conventional
 * names and shows what it finds. A storefront replaces the whole thing by
 * passing `renderCard` and rendering `<ListingCard>` from
 * `@stapel/listings-react/default` — that is the slot seam, and the reason
 * these two L2 pairs never import each other.
 *
 * The ONE thing a replacement card may not drop is the `promoted` marking:
 * DSA Art. 26 makes it mandatory, the serializer puts it on every item under
 * every sort, and a storefront where some lists show it and some do not is
 * legally worse than one that never showed it. `renderCard` receives the whole
 * item so the marking is always reachable, and this default renders it.
 */
import type { ReactElement, ReactNode } from "react";
import { Card, Flex, Tag, Tooltip, Typography } from "antd";
import { useT } from "@stapel/core";
import type { SearchItem } from "../api/types.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/** What the card slot is handed. */
export interface SearchCardProps {
  readonly item: SearchItem;
}

/** A card renderer a host supplies for `renderCard`. */
export type SearchCardRenderer = (item: SearchItem) => ReactNode;

function text(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/**
 * The conventional field names this default reads off `card`. Documented
 * rather than guessed at each site, and deliberately short: anything richer
 * belongs in the owning pair's own card.
 */
export const GENERIC_CARD_FIELDS: readonly string[] = [
  "title",
  "price",
  "currency",
  "location",
  "image_url",
];

export function SearchResultCard(props: SearchCardProps): ReactElement {
  const t = useT();
  const card = props.item.card;
  const title = text(card["title"]) ?? t(SEARCH_I18N_KEYS.resultsUntitled);
  const price = text(card["price"]);
  const currency = text(card["currency"]);
  const location = text(card["location"]);
  const distance =
    props.item.distance_km !== null
      ? t(SEARCH_I18N_KEYS.resultsDistanceKm, {
          km: props.item.distance_km.toFixed(1),
        })
      : undefined;

  return (
    <Card
      size="small"
      data-testid="search-result-card"
      data-promoted={props.item.promoted ? "true" : "false"}
    >
      <Flex vertical gap={4}>
        <Flex justify="space-between" align="start" gap={8}>
          <Typography.Text strong>{title}</Typography.Text>
          {props.item.promoted && (
            <Tooltip title={t(SEARCH_I18N_KEYS.resultsPromotedHint)}>
              <Tag color="gold" data-testid="search-result-promoted">
                {t(SEARCH_I18N_KEYS.resultsPromoted)}
              </Tag>
            </Tooltip>
          )}
        </Flex>
        {price !== undefined && (
          <Typography.Text>
            {currency !== undefined ? `${price} ${currency}` : price}
          </Typography.Text>
        )}
        {(location !== undefined || distance !== undefined) && (
          <Typography.Text type="secondary">
            {[location, distance].filter((v) => v !== undefined).join(" · ")}
          </Typography.Text>
        )}
      </Flex>
    </Card>
  );
}
