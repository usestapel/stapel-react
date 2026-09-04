/**
 * `@stapel/listings-react/default` — the antd skin: the cards another pair
 * renders, the listing page, the composer and the seller's dashboard.
 *
 * ── Three cards, because a classified has three shelves ────────────────────
 *
 * `ListingCard` is the grid card (a bordered surface, photo-led, twenty-four
 * to a desktop catalogue). `ListingSerpCard` is the phone result row (one per
 * line, a swipeable photo strip, PRICE first, a vertical action rail).
 * `ListingFeedCard` + `FeedGrid` are the home feed (borderless, two across,
 * the photo carried on the page's own ground). They are three components and
 * not one with a `variant`, because they differ in READING ORDER and in what
 * may live inside the card's anchor — not merely in size.
 *
 * A separate entry point (the convention every pair's `/default` follows) so
 * a host rendering its own visuals over the bags never pulls `antd` into its
 * bundle.
 *
 * ```tsx
 * import { ListingsProvider, createListingsRuntime } from "@stapel/listings-react";
 * import { ListingCard, ListingDetailPane } from "@stapel/listings-react/default";
 *
 * // the search pair's card slot — the container is the seam, not an import
 * <SearchPage renderCard={(item) => <ListingCard listing={item.card} href={`/l/${item.id}`} />} />
 * ```
 *
 * ── What this barrel no longer exports, and where it went ──────────────────
 *
 * `ListingsSkinTheme` and `ErrorAlert` were this pair's copies of two
 * components nine pairs each carried a copy of. They live in
 * `@stapel/tokens-antd/skin` now, as `SkinTheme` and `ErrorAlert`: one place
 * for the reactive-theme fix, one place for the message/detail split. A host
 * that wrapped its own composition in `<ListingsSkinTheme>` imports
 * `<SkinTheme>` from the substrate instead — same props, plus a `surface`.
 */
export {
  ListingCard,
  // The card's row arm, for a container that wants to lay out against the same
  // threshold (and for a test that measures it). See `<ListingCard>`'s header.
  LISTING_CARD_ROW_MIN,
  LISTING_CARD_ROW_MEDIA,
  // The already-seen mark, for a container that wants to dim its own chrome
  // on the same rule (and for a test that reads it). All three cards take it.
  CARD_VIEWED_CLASS,
  LISTING_VIEWED_OPACITY,
} from "./ListingCard.js";
export type {
  ListingCardProps,
  ListingCardBaseProps,
  ListingCardOpenProps,
  ListingCardBlockedReason,
} from "./ListingCard.js";
export { ListingSerpCard } from "./ListingSerpCard.js";
export type {
  ListingSerpCardProps,
  ListingSerpCardBaseProps,
  ListingPriceTrend,
} from "./ListingSerpCard.js";
export { ListingFeedCard } from "./ListingFeedCard.js";
export type {
  ListingFeedCardProps,
  ListingFeedCardBaseProps,
} from "./ListingFeedCard.js";
export { FeedGrid, FEED_GRID_COLUMNS } from "./FeedGrid.js";
export type { FeedGridProps } from "./FeedGrid.js";
export {
  ListingDetailPane,
  DETAIL_MEASURE,
  // The split layout's two geometry constants, for a container laying out
  // against the same tracks (and for a test that measures them).
  DETAIL_SPLIT_MEASURE,
  DETAIL_SPLIT_ASIDE,
  DETAIL_PHOTO_MIN,
} from "./ListingDetailPane.js";
export type { ListingDetailPaneProps } from "./ListingDetailPane.js";
export {
  ListingComposerPage,
  COMPOSER_DETAILS_PLACEMENT,
  COMPOSER_MEASURE,
  composerFieldId,
} from "./ListingComposerPage.js";
export type {
  ListingComposerPageProps,
  ComposerCategorySlot,
  ComposerCurrencySlot,
  ComposerLocationSlot,
  ComposerLocationValue,
  ComposerLocationPickerProps,
} from "./ListingComposerPage.js";
export { MyListingsPane } from "./MyListingsPane.js";
export type { MyListingsPaneProps, MyListingHrefRow } from "./MyListingsPane.js";
export { FavoritesPane, FAVORITES_CARD_MIN } from "./FavoritesPane.js";
export type {
  FavoritesPaneProps,
  FavoritesPaneOpenProps,
  FavoritesHrefRow,
} from "./FavoritesPane.js";

export { LifecycleTag, ListingStatusBlock, ModerationNote } from "./StatusTags.js";
export type { ListingStatusProps } from "./StatusTags.js";
export {
  ListingPhoto,
  ListingPhotoStrip,
  LISTING_PHOTO_ASPECT,
} from "./ListingPhoto.js";
export type { ListingPhotoProps } from "./ListingPhoto.js";
export { SignInLink } from "./SignInLink.js";
export type { SignInLinkProps } from "./SignInLink.js";
export type { CategoryFeaturesProp, ThemeModeProp } from "./types.js";
