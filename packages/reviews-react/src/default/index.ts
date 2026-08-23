/**
 * `@stapel/reviews-react/default` — the antd skin over the headless pair.
 *
 * A separate entry point (the convention every pair's `/default` follows) so a
 * host rendering its own review block never pulls `antd` into its bundle. The
 * main entry has no visual opinion at all and no import path from it reaches
 * this directory — size-limit and the bundle-purity test are the teeth on
 * that.
 *
 * ```tsx
 * import { createReviewsRuntime, ReviewsProvider } from "@stapel/reviews-react";
 * import { ReviewsPanel } from "@stapel/reviews-react/default";
 * ```
 *
 * `<RatingBadge aggregate={…}>` is the seller-rating half: it renders two
 * numbers the composite's projection produced, because stapel-reviews cannot
 * roll a seller's listings up itself (main entry header).
 */
export { ReviewsPanel } from "./ReviewsPanel.js";
export type { ReviewsPanelProps } from "./ReviewsPanel.js";
export { ReviewListPanel } from "./ReviewListPanel.js";
export type { ReviewListPanelProps } from "./ReviewListPanel.js";
export { ReviewFormCard } from "./ReviewFormCard.js";
export type { ReviewFormCardProps } from "./ReviewFormCard.js";
export { RatingBadge } from "./RatingBadge.js";
export type { RatingBadgeProps } from "./RatingBadge.js";
export { ReviewsSkinTheme } from "./theme.js";
export type { ReviewsSkinThemeProps } from "./theme.js";
export { ErrorAlert } from "./ErrorAlert.js";
export type { ThemeModeProp } from "./types.js";
export { SignInLink } from "./SignInLink.js";
export type { SignInLinkProps } from "./SignInLink.js";
