/**
 * `<ListingActions>` — save it, or send it to somebody. The two verbs a
 * classified puts beside a listing's title, in one cluster.
 *
 * ── Why they are one component and not two buttons in a row ───────────────
 *
 * Because everything that makes them usable is a property of the PAIR, not of
 * either control: they share a hit-target tier, they share the corner of the
 * photograph they are pinned to on a phone, and the reason they are icon-only
 * on the listing page is that there are two of them and a price on one line.
 * Measured against the reference (§23): our listing page drew a 152px
 * "Save to favourites" button with a word in it at every width, where the
 * reference draws a 44×44 glyph on a desktop and 36×36 on a phone and puts
 * the share glyph beside it. Two components could not have been given that
 * ruling once.
 *
 * ── The NAME of `<ListingActions>` and of `useListingActions` ─────────────
 *
 * They are different things and the collision is worth stating rather than
 * renaming around. `useListingActions` (the headless entry) is the SELLER's
 * lifecycle moves — archive, mark sold, delete — the owner's half of the
 * state machine. This is the READER's two actions, and it lives in
 * `/default` because it is a layout. Neither is exported from the other's
 * barrel.
 *
 * ── The heart arrives as a node when the surface already has one ──────────
 *
 * The listing page's heart is driven by `useListingDetail`'s own optimistic
 * bag (it holds the whole listing, so it flips the row it already has),
 * while a card's is driven by `useFavoriteToggle` against a card row. Two
 * hooks, one control — so the cluster takes {@link ListingActionsProps.favorite}
 * as a node for a surface that already built one, and mounts the shared
 * `<FavoriteHeart>` for everyone else. What it never does is let the two
 * surfaces disagree about SIZE, PLACEMENT or ORDER, which is the whole job.
 *
 * ── There is no favourite count on the wire, and this does not invent one ─
 *
 * `ListingCard`/`ListingDetail` carry `is_favorited` — a per-reader boolean —
 * and no aggregate anywhere (asserted in `test/engagementState`). So
 * {@link ListingActionsProps.favoriteCount} is a number the HOST was given by
 * something else, rendered when it is there and absent when it is not. Never
 * a zero standing in for "nobody counted".
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import type { SignInCta } from "@stapel/core";
import { useT } from "@stapel/core";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import type { ShareChannel, SharePreference } from "../headless/Share.js";
import { FavoriteHeart } from "./favorite.js";
import { ShareAction } from "./ShareAction.js";
import {
  LISTING_ACTIONS_CLASS,
  LISTING_ACTIONS_OVERLAY_CLASS,
  LISTING_ACTIONS_STYLE_HREF,
  LISTING_ACTION_CLASS,
  actionRowCss,
} from "./actionRow.js";

/**
 * Which of the two the host wants drawn.
 *
 * Both default to `true`: a pair whose share button had to be switched ON
 * would have shipped a storefront with no share button, which is the exact
 * defect this wave answers. `{ share: false }` is for a deployment that has
 * decided against it — a private marketplace, an internal catalogue — and
 * `{ favorite: false }` for a surface where saving makes no sense (the
 * owner's own listing).
 */
export interface ListingActionsConfig {
  readonly favorite?: boolean;
  readonly share?: boolean;
}

export interface ListingActionsProps {
  readonly listingId: number;
  /** `is_favorited` off the row — ignored when {@link favorite} is given. */
  readonly favorited?: boolean | null | undefined;
  /**
   * The surface's own heart, when it has one. See the file header: the
   * listing page's heart is driven by a different hook from a card's, and
   * this cluster's job is the geometry, not the hook.
   */
  readonly favorite?: ReactNode;
  /** How many people saved it, when the host knows. Absent draws nothing —
   * the wire carries no such aggregate. */
  readonly favoriteCount?: number;
  /** The listing's canonical address — a path or an absolute URL. Given, it
   * is what is shared and `window.location` is never read. */
  readonly shareUrl?: string;
  /** The listing's title: the share sheet's heading. */
  readonly shareTitle?: string;
  /** A line under it in the sheet — the price, typically. */
  readonly shareText?: string;
  /**
   * Which arm the share control uses — handed straight to
   * `<ShareAction prefer>`, which is where the reading and its measurement
   * are written down. Default `"auto"`: the platform sheet on a thumb, this
   * pair's menu on a mouse.
   */
  readonly sharePrefer?: SharePreference;
  readonly onShared?: (channel: ShareChannel) => void;
  /** The container's sign-in door for the heart. */
  readonly signIn?: SignInCta;
  /** How loudly a blocked heart speaks — only consulted when this cluster
   * mounts the heart itself. */
  readonly blockedReason?: "text" | "popover";
  /** A short toast on each successful favourite press. */
  readonly announce?: boolean;
  /** See {@link ListingActionsConfig}. */
  readonly actions?: ListingActionsConfig;
  /**
   * `"inline"` (default) is a row wherever the surface put it.
   *
   * `"overlay"` pins the cluster to the TRAILING TOP corner of the media it
   * is drawn over — the one corner of a card gallery that is free, because
   * the dots own the bottom centre and the "3 of 16" counter owns the bottom
   * trailing corner. The element it is pinned inside must be a containing
   * block; every media well in this package already is.
   */
  readonly placement?: "inline" | "overlay";
  /** This cluster's test id. Default `listings-actions`. */
  readonly testId?: string;
  /** The heart's test id, when this cluster mounts it. */
  readonly favoriteTestId?: string;
  readonly style?: CSSProperties;
}

export function ListingActions(props: ListingActionsProps): ReactElement | null {
  const t = useT();
  const testId = props.testId ?? "listings-actions";
  const showFavorite = props.actions?.favorite !== false;
  const showShare = props.actions?.share !== false;
  const overlay = props.placement === "overlay";

  // Nothing asked for is nothing drawn — not an empty box with a gap in it.
  if (!showFavorite && !showShare) return null;

  const heart = !showFavorite ? null : (
    props.favorite ?? (
      <FavoriteHeart
        listingId={props.listingId}
        favorited={props.favorited}
        testId={props.favoriteTestId ?? `${testId}-favorite`}
        className={LISTING_ACTION_CLASS}
        {...(props.announce === true ? { announce: true } : {})}
        {...(props.blockedReason !== undefined
          ? { blockedReason: props.blockedReason }
          : {})}
        {...(props.signIn !== undefined ? { signIn: props.signIn } : {})}
      />
    )
  );

  return (
    <>
      <style href={LISTING_ACTIONS_STYLE_HREF} precedence="default">
        {actionRowCss()}
      </style>
      <Flex
        align="flex-end"
        className={
          overlay
            ? `${LISTING_ACTIONS_CLASS} ${LISTING_ACTIONS_OVERLAY_CLASS}`
            : LISTING_ACTIONS_CLASS
        }
        data-testid={testId}
        data-placement={overlay ? "overlay" : "inline"}
        {...(props.style !== undefined ? { style: props.style } : {})}
      >
        {heart}

        {/* The count, when a host was given one. Beside the heart and not
            inside it: the number is a fact about the listing, and a button
            whose accessible name changed with a counter would be announced
            differently to every reader. */}
        {showFavorite && props.favoriteCount !== undefined ? (
          <Typography.Text
            type="secondary"
            data-testid={`${testId}-favorite-count`}
          >
            {t(LISTINGS_I18N_KEYS.favoriteCount, { count: props.favoriteCount })}
          </Typography.Text>
        ) : null}

        {showShare ? (
          <ShareAction
            testId={`${testId}-share`}
            // Icon-only in the cluster, at both placements: two glyphs and a
            // price share one line on a phone, and the reference draws the
            // page's actions as glyphs on a desktop too (§23). The verb is
            // still the control's accessible name in every arm.
            shape="circle"
            {...(props.shareUrl !== undefined ? { url: props.shareUrl } : {})}
            {...(props.shareTitle !== undefined ? { title: props.shareTitle } : {})}
            {...(props.shareText !== undefined ? { text: props.shareText } : {})}
            {...(props.sharePrefer !== undefined ? { prefer: props.sharePrefer } : {})}
            {...(props.onShared !== undefined ? { onShared: props.onShared } : {})}
          />
        ) : null}
      </Flex>
    </>
  );
}
