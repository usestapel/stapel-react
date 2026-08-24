/**
 * `@stapel/listings-react/default` — the antd skin: the card another pair
 * renders, the listing page, the composer and the seller's dashboard.
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
export { ListingCard } from "./ListingCard.js";
export type {
  ListingCardProps,
  ListingCardBaseProps,
  ListingCardOpenProps,
  ListingCardBlockedReason,
} from "./ListingCard.js";
export { ListingDetailPane, DETAIL_MEASURE, DETAIL_PHOTO_MIN } from "./ListingDetailPane.js";
export type { ListingDetailPaneProps } from "./ListingDetailPane.js";
export { ListingComposerPage, COMPOSER_MEASURE } from "./ListingComposerPage.js";
export type {
  ListingComposerPageProps,
  ComposerCategorySlot,
  ComposerCurrencySlot,
  ComposerLocationSlot,
  ComposerLocationValue,
  ComposerLocationPickerProps,
} from "./ListingComposerPage.js";
export { MyListingsPane } from "./MyListingsPane.js";
export type { MyListingsPaneProps } from "./MyListingsPane.js";
export { FavoritesPane, FAVORITES_CARD_MIN } from "./FavoritesPane.js";
export type {
  FavoritesPaneProps,
  FavoritesPaneOpenProps,
} from "./FavoritesPane.js";

export { LifecycleTag, ListingStatusBlock, ModerationNote } from "./StatusTags.js";
export type { ListingStatusProps } from "./StatusTags.js";
export { ListingPhoto, LISTING_PHOTO_ASPECT } from "./ListingPhoto.js";
export type { ListingPhotoProps } from "./ListingPhoto.js";
export { SignInLink } from "./SignInLink.js";
export type { SignInLinkProps } from "./SignInLink.js";
export type { ThemeModeProp } from "./types.js";
