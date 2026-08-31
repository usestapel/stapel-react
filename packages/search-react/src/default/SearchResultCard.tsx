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
 * 1. **It read a photo shape nothing in this fleet emits.** `card.image` was
 *    read as an object with a `url` key and `card.image_url` as the fallback;
 *    what the fleet actually stores is a `<type>/<hash>` CDN reference, and
 *    where it does store an object that object carries `ref` + `variants[]`
 *    and no top-level `url`. So every consumer that did not pass its own
 *    `renderCard` got a card with no photo at all. `cardPhotos.ts` reads the
 *    real shapes, through the runtime's `resolveImage` seam, and the whole
 *    `images[]` gallery rather than one photo.
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
import { SkinCarousel } from "@stapel/tokens-antd/skin";
import { useFormat, useT } from "@stapel/core";
import type { Format } from "@stapel/core";
import { cssVar, fontSize, fontWeight, radii, spacing } from "@stapel/tokens";
import type { SearchItem } from "../api/types.js";
import { useSearchRuntime } from "../model/context.js";
import { readCardPhotos } from "./cardPhotos.js";
import type { CardPhotos } from "./cardPhotos.js";
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
  // The gallery, and the singular first photo the projection keeps beside it
  // (`images[0]`). Both hold CDN references; see `cardPhotos.ts`. The old
  // `image_url` is gone — no backend in this fleet ever wrote it.
  "images",
  "image",
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

/**
 * The shape of one photo well, everywhere on this card. Declared once so the
 * placeholder and the loaded photo cannot drift into two different crops, and
 * so the well is on screen before the network answers.
 */
const CARD_PHOTO_ASPECT = "4 / 3";

/** The placeholder well: the box the photo would have occupied. */
const PHOTO_ABSENT: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[1],
  width: "100%",
  aspectRatio: CARD_PHOTO_ASPECT,
  overflow: "hidden",
  borderRadius: radii.md,
  background: cssVar("surface-sunken"),
  color: cssVar("text-muted"),
};

/** The slide's own fill — the strip's well owns the shape. */
const PHOTO_FILL: CSSProperties = { width: "100%", height: "100%" };

/** A camera outline in `currentColor` — no icon dependency, and it inherits
 * the theme rather than carrying a colour. `aria-hidden` because the sentence
 * beside it is the label. */
function CameraGlyph(): ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.2-2h6.2l1.2 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

/**
 * The card's photos — the whole gallery, as a swipeable strip.
 *
 * ── Why the strip is OUTSIDE the card's anchor ────────────────────────────
 *
 * `<SkinCarousel>` is a scroll container with its own tab stop, and a
 * horizontal swipe that ends inside an `<a>` is a swipe the browser may
 * deliver as a click. Inside the anchor, every attempt to look at photo two
 * would navigate to the result — the defect that makes phone galleries
 * unusable. So it sits above the anchor as a sibling, exactly as
 * `<ListingSerpCard>` does it, and the anchor still covers everything a
 * person reads.
 *
 * Three states, and they are three different facts. No photo FIELD at all —
 * a doc type that indexes text — draws nothing, because reserving a 4:3 well
 * for a corpus that has no photos is a hole in every row. A field with
 * nothing behind it draws the well and says the photo is unavailable: that is
 * usually an unwired `resolveImage`, and a sentence gets it fixed where an
 * empty grey box does not. Anything else is the strip.
 */
function CardPhotoStrip(props: {
  photos: CardPhotos;
  title: string;
}): ReactElement | null {
  const t = useT();
  const { photos, title } = props;
  if (photos.stored === 0) return null;

  if (photos.images.length === 0) {
    const caption = t(SEARCH_I18N_KEYS.resultsPhotoUnavailable);
    return (
      <div
        role="img"
        aria-label={caption}
        data-testid="search-result-photo-absent"
        style={PHOTO_ABSENT}
      >
        <CameraGlyph />
        <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
          {caption}
        </Typography.Text>
      </div>
    );
  }

  const total = photos.images.length;
  // A one-photo strip gets neither a peek nor dots: the sliver of a next
  // slide is an affordance for something that is there.
  const many = total > 1;
  return (
    <SkinCarousel
      label={t(SEARCH_I18N_KEYS.resultsPhotos)}
      aspectRatio={CARD_PHOTO_ASPECT}
      peek={many}
      dots={many}
      data-testid="search-result-photos"
    >
      {photos.images.map((image, index) => (
        <Image
          key={`${String(index)}:${image.url}`}
          meta={image}
          alt={
            many
              ? t(SEARCH_I18N_KEYS.resultsPhotoAlt, {
                  index: index + 1,
                  total,
                  title,
                })
              : t(SEARCH_I18N_KEYS.resultsImageAlt, { title })
          }
          fit="cover"
          data-testid="search-result-photo"
          style={PHOTO_FILL}
        />
      ))}
    </SkinCarousel>
  );
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
  const resolve = useSearchRuntime().resolveImage;
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
  // Memoised on the card and the resolver: a host resolver is a plain
  // function returning a fresh object, so resolving inline hands `<Image>` a
  // new `meta` identity on every render — a load it then has to decide is or
  // is not the same one.
  const photos = useMemo(() => readCardPhotos(card, resolve), [card, resolve]);

  const body = (
    <Flex vertical gap={spacing[1]}>
      <Typography.Text strong>{title}</Typography.Text>
      {/* The price is the strongest line on a catalogue card: it is what the
          eye scans a grid for. It used to share a type step with the location
          and sit under a disclosure three times its size. */}
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
        {/* A SIBLING of the anchor, never a child — see `CardPhotoStrip`. */}
        <CardPhotoStrip photos={photos} title={title} />
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
