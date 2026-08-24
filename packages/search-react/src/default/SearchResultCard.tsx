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
 *
 * ── Two things this card used to get wrong ────────────────────────────────
 *
 * 1. **It declared `image_url` and drew nothing.** A text-only card in a
 *    classifieds search is not a card; the field was in `GENERIC_CARD_FIELDS`
 *    and in no render path. It is drawn now, through `@stapel/image`, so the
 *    aspect box lands before the network does and a dead URL renders a named
 *    placeholder instead of the browser's torn-page icon.
 * 2. **The marking's EXPLANATION was in a `Tooltip`.** Touch has no hover, so
 *    on the device most of this traffic arrives from, the sentence the law is
 *    actually about was unreachable — the tag said "Promoted" and nothing on
 *    screen said what that meant. It is ordinary text under the tag now
 *    (`stapel/no-tooltip-in-skin`), and the tag itself is a `--stapel-*` role
 *    rather than an antd preset, because the one legally-mandated marking in
 *    the pair has to look the same in every skin a deployment builds.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Card, Flex, Typography } from "antd";
import { Image } from "@stapel/image";
import type { StapelImage } from "@stapel/image";
import { useT } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
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

/**
 * The DSA Art. 26 marking, as a token role.
 *
 * `warning` is the §68 dictionary's "look at this, it is not an error" role —
 * the same one every skin in the fleet resolves from its own theme JSON. The
 * previous `<Tag color="gold">` was an antd PRESET: it survived a retheme
 * unchanged, so a deployment with its own palette had one component still
 * painted in Ant Design's gold, and the one marking that must be recognisable
 * everywhere was the one thing the design system did not own.
 */
const PROMOTED_TAG: CSSProperties = {
  alignSelf: "flex-start",
  background: cssVar("warning-bg"),
  color: cssVar("warning-on"),
  border: `1px solid ${cssVar("warning-border")}`,
  borderRadius: radii.sm,
  padding: `0 ${String(spacing[2])}px`,
  fontSize: fontSize.xs.fontSize,
  lineHeight: `${String(fontSize.md.lineHeight)}px`,
  whiteSpace: "nowrap",
};

/** The photo's box: a 4:3 well the image fills, drawn before it loads. */
const PHOTO: CSSProperties = {
  width: "100%",
  aspectRatio: "4 / 3",
  overflow: "hidden",
  borderRadius: radii.md,
  background: cssVar("surface-sunken"),
};

/**
 * A plain `image_url` as the descriptor `<Image>` consumes.
 *
 * A doc type that stores a bare URL has no variant ladder and no dimensions —
 * `source: "link"` is exactly that case, and `<Image>` degrades to the single
 * URL rather than pretending to shop a tier. A doc type that stores the whole
 * `StapelImage` snapshot (`card.image`) gets the ladder, blur-up and all.
 */
function cardImage(card: Readonly<Record<string, unknown>>): StapelImage | undefined {
  const rich = card["image"];
  if (rich !== null && typeof rich === "object" && "url" in rich) {
    return rich as StapelImage;
  }
  const url = text(card["image_url"]);
  if (url === undefined) return undefined;
  return {
    source: "link",
    url,
    mime: null,
    width: null,
    height: null,
    aspect: null,
    square: false,
    preview_b64: null,
    variants: [],
  };
}

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
  // Memoised on the two fields it reads: a fresh `meta` identity every render
  // is a load `<Image>` has to decide is or is not the same one.
  const image = useMemo(() => cardImage(card), [card]);

  return (
    <Card
      size="small"
      data-testid="search-result-card"
      data-promoted={props.item.promoted ? "true" : "false"}
      styles={{ body: { padding: spacing[3] } }}
    >
      <Flex vertical gap={spacing[2]}>
        {image !== undefined && (
          <div style={PHOTO} data-testid="search-result-photo">
            <Image
              meta={image}
              alt={t(SEARCH_I18N_KEYS.resultsImageAlt, { title })}
              fit="cover"
            />
          </div>
        )}
        <Flex vertical gap={spacing[1]}>
          <Typography.Text strong>{title}</Typography.Text>
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
          {props.item.promoted && (
            <Flex vertical gap={spacing[1]} data-testid="search-result-promotion">
              <span style={PROMOTED_TAG} data-testid="search-result-promoted">
                {t(SEARCH_I18N_KEYS.resultsPromoted)}
              </span>
              {/* The explanation the marking exists FOR. Visible, on every
                  device, because a legal disclosure that needs a mouse is a
                  disclosure a phone never receives. */}
              <Typography.Text
                type="secondary"
                style={{ fontSize: fontSize.xs.fontSize }}
                data-testid="search-result-promoted-hint"
              >
                {t(SEARCH_I18N_KEYS.resultsPromotedHint)}
              </Typography.Text>
            </Flex>
          )}
        </Flex>
      </Flex>
    </Card>
  );
}
