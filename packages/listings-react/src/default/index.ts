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
 */
export { ListingCard } from "./ListingCard.js";
export type {
  ListingCardProps,
  ListingCardBaseProps,
  ListingCardOpenProps,
} from "./ListingCard.js";
export { ListingDetailPane } from "./ListingDetailPane.js";
export type { ListingDetailPaneProps } from "./ListingDetailPane.js";
export { ListingComposerPage } from "./ListingComposerPage.js";
export type {
  ListingComposerPageProps,
  ComposerCategorySlot,
} from "./ListingComposerPage.js";
export { MyListingsPane } from "./MyListingsPane.js";
export type { MyListingsPaneProps } from "./MyListingsPane.js";
export { FavoritesPane } from "./FavoritesPane.js";
export type {
  FavoritesPaneProps,
  FavoritesPaneOpenProps,
} from "./FavoritesPane.js";

export { LifecycleTag, ListingStatusBlock, ModerationNote } from "./StatusTags.js";
export type { ListingStatusProps } from "./StatusTags.js";
export { ListingPhoto } from "./ListingPhoto.js";
export type { ListingPhotoProps } from "./ListingPhoto.js";
export { ErrorAlert } from "./ErrorAlert.js";
export { SignInLink } from "./SignInLink.js";
export type { SignInLinkProps } from "./SignInLink.js";
export { ListingsSkinTheme } from "./theme.js";
export type { ListingsSkinThemeProps } from "./theme.js";
export type { ThemeModeProp } from "./types.js";
