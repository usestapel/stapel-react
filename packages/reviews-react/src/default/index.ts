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
 *
 * ── What used to be here and is not any more ──────────────────────────────
 *
 * `ReviewsSkinTheme` and this pair's own `ErrorAlert` are gone. Both were
 * per-pair copies of a fleet decision: the theme wrapper is `<SkinTheme>` and
 * the error surface is `<ErrorAlert>`, both from `@stapel/tokens-antd/skin`,
 * where the reactive-mode fix and the message/detail split live once instead
 * of nine and fifteen times. A host that wrapped its own composition in
 * `ReviewsSkinTheme` imports `SkinTheme` from that package directly.
 */
export { ReviewsPanel } from "./ReviewsPanel.js";
export type { ReviewsPanelProps } from "./ReviewsPanel.js";
export { ReviewListPanel } from "./ReviewListPanel.js";
export type { ReviewListPanelProps } from "./ReviewListPanel.js";
export { ReviewFormCard } from "./ReviewFormCard.js";
export type { ReviewFormCardProps } from "./ReviewFormCard.js";
export { RatingBadge } from "./RatingBadge.js";
export type { RatingBadgeProps } from "./RatingBadge.js";
export { ReviewModerationPanel } from "./ReviewModerationPanel.js";
export type {
  ModerationFilter,
  ReviewModerationPanelProps,
} from "./ReviewModerationPanel.js";
export { ReviewResponseComposer } from "./ReviewResponseComposer.js";
export type { ReviewResponseComposerProps } from "./ReviewResponseComposer.js";
export { SignInLink } from "./SignInLink.js";
export type { SignInLinkProps } from "./SignInLink.js";
export type { ThemeModeProp } from "./types.js";
