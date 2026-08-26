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
 * 3. **The tag was white on cream.** `warning-on` is the text colour for the
 *    SOLID warning fill; over `warning-bg` the readable role is `warning`
 *    itself. The visual pass measured the one legally-mandated string in the
 *    package at roughly 1.2:1 — a disclosure nobody can read is the same as
 *    no disclosure, in both themes.
 * 4. **The price was a raw amount and an ISO code.** "3200 RUB" is a wire
 *    value printed as prose: no grouping, no symbol, and the code in the
 *    reader's face. It goes through core's `useFormat().number` with
 *    `style: "currency"`, which is the same `Intl` path `@stapel/currencies-
 *    react`'s `formatMoney` takes — this pair does not depend on that package
 *    (a search index is not a price book) but it must not invent a second
 *    way to write money either.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Card, Flex, Typography } from "antd";
import { Image } from "@stapel/image";
import type { StapelImage } from "@stapel/image";
import { useFormat, useT } from "@stapel/core";
import type { Format } from "@stapel/core";
import { cssVar, fontSize, fontWeight, radii, spacing } from "@stapel/tokens";
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
  "url",
];

/**
 * The card's price, written the way money is written.
 *
 * `card.price` arrives as a string because the index stores it as one, and
 * `card.currency` as an ISO 4217 code because that is what a document carries.
 * Rendered verbatim they read "3200 RUB": no grouping, the code where the
 * symbol belongs, and the reader doing the arithmetic of where the thousands
 * are. `Intl` knows all of that per locale, so the code goes in and the
 * locale's own rendering comes out.
 *
 * Two ways this refuses to guess. A `price` that is not a finite number is
 * passed through UNCHANGED — a doc type may store "on request", and turning
 * that into `NaN` or into nothing loses what the seller wrote. A `currency`
 * that is not a three-letter code (or one this runtime rejects) falls back to
 * the plain grouped number plus the code, which is still better than the raw
 * pair and never throws inside a render.
 */
export function formatCardPrice(
  format: Format,
  price: string | undefined,
  currency: string | undefined
): string | undefined {
  if (price === undefined) return undefined;
  const amount = Number(price);
  if (!Number.isFinite(amount)) return price;
  if (currency !== undefined && /^[A-Za-z]{3}$/.test(currency)) {
    try {
      const money = format.number(amount, {
        style: "currency",
        currency: currency.toUpperCase(),
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      });
      if (money !== null) return money;
    } catch {
      // An unsupported currency code: fall through to the grouped number.
    }
  }
  const grouped = format.number(amount);
  if (grouped === null) return price;
  return currency === undefined ? grouped : `${grouped} ${currency}`;
}

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
  // `warning`, not `warning-on`: the latter is the text colour for the SOLID
  // warning fill (white on light), and over `warning-bg` it is cream on cream.
  color: cssVar("warning"),
  fontWeight: fontWeight.medium,
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

/**
 * The whole card as ONE tap target.
 *
 * A catalogue row is a link — the person taps the picture, the title or the
 * price and expects the same thing to happen. The card used to have no
 * clickable anything at all: the entire result page of a storefront that had
 * not passed `renderCard` was a wall of text with the tap target missing
 * (class C-NOPRIMARY). `card.url` is the conventional field a doc type stores
 * it in; without one the card stays exactly what it was, because inventing a
 * destination is worse than not having one.
 */
const CARD_LINK: CSSProperties = {
  color: "inherit",
  display: "block",
  textDecoration: "none",
};

export function SearchResultCard(props: SearchCardProps): ReactElement {
  const t = useT();
  const format = useFormat();
  const card = props.item.card;
  const title = text(card["title"]) ?? t(SEARCH_I18N_KEYS.resultsUntitled);
  const price = formatCardPrice(format, text(card["price"]), text(card["currency"]));
  const href = text(card["url"]);
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

  const body = (
    <Flex vertical gap={spacing[2]}>
      {image !== undefined && (
        <div style={PHOTO} data-testid="search-result-photo">
          {/* The WELL owns the shape (4:3, drawn before the network answers),
              so the image is told to fill it. Without an explicit box the
              image's own container reserves height only from the snapshot's
              `aspect` — which a doc type storing a bare `image_url` does not
              have — and a `cover` image inside a zero-height parent is a
              photo that loaded and was never seen. */}
          <Image
            meta={image}
            alt={t(SEARCH_I18N_KEYS.resultsImageAlt, { title })}
            fit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
      <Flex vertical gap={spacing[1]}>
        <Typography.Text strong>{title}</Typography.Text>
        {/* The price is the strongest line on a catalogue card: it is what
            the eye scans a grid for. It used to share a type step with the
            location and sit under a disclosure three times its size. */}
        {price !== undefined && (
          <Typography.Text
            strong
            style={{ fontSize: fontSize.lg.fontSize }}
            data-testid="search-result-price"
          >
            {price}
          </Typography.Text>
        )}
        {(location !== undefined || distance !== undefined) && (
          <Typography.Text type="secondary">
            {[location, distance].filter((v) => v !== undefined).join(" · ")}
          </Typography.Text>
        )}
      </Flex>
    </Flex>
  );

  return (
    <Card
      size="small"
      data-testid="search-result-card"
      data-promoted={props.item.promoted ? "true" : "false"}
      {...(href !== undefined ? { hoverable: true } : {})}
      styles={{ body: { padding: spacing[3] } }}
    >
      <Flex vertical gap={spacing[2]}>
        {href === undefined ? (
          body
        ) : (
          <a href={href} style={CARD_LINK} data-testid="search-result-link">
            {body}
          </a>
        )}
        {props.item.promoted && (
          <Flex vertical gap={spacing[1]} data-testid="search-result-promotion">
            <span style={PROMOTED_TAG} data-testid="search-result-promoted">
              {t(SEARCH_I18N_KEYS.resultsPromoted)}
            </span>
            {/* The explanation the marking exists FOR. Visible, on every
                device, because a legal disclosure that needs a mouse is a
                disclosure a phone never receives — as a caption, so it marks
                the card rather than outweighing what is for sale on it. */}
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
    </Card>
  );
}
