/**
 * `<ListingDetailPane>` — the listing page, and the page a marketplace makes
 * its money on.
 *
 * Five distinct absences, five distinct sentences, and the whole point of the
 * component is that none of them collapses into another:
 *
 *   loading            — we are asking
 *   failed             — we could not ask   (retry, never "nothing here")
 *   not found          — no listing ever had this id
 *   removed            — one did, and it is gone (the AllowAny status probe
 *                        is the only read that can still say so)
 *   withdrawn          — one did, and its owner took it off the shelf: the
 *                        detail 404s while the probe still answers "not
 *                        deleted". NO retry — nothing a retry could change.
 *
 * On top of that, a listing that IS returned may still not be on sale: the
 * detail endpoint has no `published()` filter, so a draft answers 200 to
 * anyone holding the id. The pane says which side of that it is on rather
 * than dressing a draft up as a shop page.
 *
 * ── The page has ONE primary action, and it depends on who is reading ──────
 *
 * For two releases the only control here was "Save to favourites" — the money
 * screen of a marketplace with no way to reach the seller, and the owner's own
 * copy of the page offering to favourite their own listing. So:
 *
 *   a buyer  → `contactSlot` (the container's `@stapel/chat-react`
 *              "message the seller" button), with favouriting beside it as
 *              the secondary it always was;
 *   the owner → Edit and Take down, and no contact button at all — you do not
 *              message yourself.
 *
 * `contactSlot` is a SLOT because conversations belong to another L2 pair and
 * L2 pairs do not import each other. Unfilled it renders `<SlotPlaceholder>`,
 * so an app wired without a chat is a named gap in a dev build rather than a
 * page whose only verb is "save".
 *
 * ── The page has a DESKTOP, when the host says so ──────────────────────────
 *
 * Measured on a live classified deployment at 1440×900: the whole listing
 * page was a ~930px single column hugging the start edge, the price a 22px
 * line UNDER the title and smaller than it, and the right half of the screen
 * empty — while the reference design for this page is two columns: gallery +
 * description + specs on the left, a sticky buy column on the right with the
 * price LARGE at its top, then the actions, then the seller block.
 *
 * `layout="split"` is that design. The HOST states the axis — the same rule
 * as CategoryPage's `subcategories`: a decision taken once by the component
 * that knows the viewport it granted, never a media query guessed in a leaf —
 * and the default `"column"` renders exactly what existing hosts already get.
 *
 * ── The reader's cluster can be in TWO places, and is ONE thing ────────────
 *
 * A phone reads this page over four screens. Past the first, the reference
 * classified draws a condensed bar — back, the title, and the two verbs — and
 * a container building one had to mount a `<ListingActions>` of its own,
 * because `actionsPlacement` took a single value and the pane exposed no
 * target for the cluster it builds. That second mount is a second
 * `useFavoriteToggle` on one page: two hearts that agree only after a refetch,
 * two `aria-pressed` controls, and a second set of test ids kept in step by
 * hand so the pane's own stayed single.
 *
 * `actionsPlacement={["header", "bar"]}` + `renderActionsBar` is the answer,
 * and the shape is deliberate: the render prop is handed a MOUNT POINT, not
 * the cluster. `<ListingActions>` is rendered once through a portal and the
 * portal's container is moved between the two slots as a DOM node, so the
 * component mounts once, holds one hook, and is literally the same element in
 * both places (`movableCluster.tsx` has the argument; the test holds the
 * favourite across the move and compares identity). A render prop handed the
 * cluster's ELEMENT would have read the same at a call site and mounted twice,
 * which is the defect with the pair's name on it.
 *
 * `onTitleVisible` is the other half: the same container watched the pane's
 * `<h1>` through its published test id and a `MutationObserver`, for a
 * boolean the pane already knows. It is an `IntersectionObserver` on the
 * title, never a scroll listener.
 */
import { isValidElement, useCallback, useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { Descriptions, Divider, Flex, Typography, theme as antdTheme } from "antd";
import { SkinButton as Button } from "@stapel/tokens-antd/skin";
import {
  ErrorAlert,
  EmptyState,
  GatedButton,
  GatedControl,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  SlotPlaceholder,
  matchLoad,
  useActionGate,
  useI18n,
  useT,
} from "@stapel/core";
import type { SignInCta } from "@stapel/core";
import { cssVar, spacing } from "@stapel/tokens";
import { isRedactedValue } from "@stapel/attributes-react";
import { useListingDetail } from "../headless/ListingDetail.js";
import { useListingActions } from "../headless/ListingActions.js";
import { asFeatureDaoList, featureValuesForDisplay } from "../model/features.js";
import { formatSpecValue } from "../model/featureText.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import type { ShareChannel, SharePreference } from "../headless/Share.js";
import { GateReasonPopover } from "./GateReasonPopover.js";
import { ListingActions } from "./ListingActions.js";
import type { ListingActionsConfig } from "./ListingActions.js";
import { LISTING_ACTION_CLASS } from "./actionRow.js";
import {
  LISTINGS_GALLERY_CLASS,
  LISTINGS_GALLERY_STYLE_HREF,
  detailGalleryCss,
} from "./detailGallery.js";
import type { ListingGalleryLayout } from "./detailGallery.js";
import { useMovableCluster } from "./movableCluster.js";
import { useNotice } from "./notice.js";
import { ListingSpecColumns, ListingSpecList } from "./ListingSpecList.js";
import { SignInLink } from "./SignInLink.js";
import { HeartIcon } from "./icons.js";
import { ListingPhoto } from "./ListingPhoto.js";
import { ListingPrice } from "./ListingPrice.js";
import { ListingStatusBlock } from "./StatusTags.js";
import type { CategoryFeaturesProp, ThemeModeProp } from "./types.js";

/** The reading measure of the page body. A detail page is prose plus a spec
 * table; past this it stops being one column and starts being a stripe across
 * a 2560px pane. */
export const DETAIL_MEASURE = "60rem";

/**
 * The split layout's measure. {@link DETAIL_MEASURE} is a ONE-COLUMN reading
 * measure; in the split the same prose shares the row with a fixed buy
 * column and a gap, so the pane must be wider for the reading half to keep
 * its line — 75rem puts the left column back at roughly the width the
 * one-column page reads at, with the buy column beside it instead of the
 * empty half-screen the 1440×900 walk measured.
 */
export const DETAIL_SPLIT_MEASURE = "75rem";

/**
 * The buy column's fixed track. A width, not a fraction: a price, a row of
 * buttons and a seller block do not improve with width, and every pixel they
 * took would come out of the reading column — so the reading column is the
 * `1fr` and this is not.
 */
export const DETAIL_SPLIT_ASIDE = "380px";

/** Re-exported: the tile floor is declared beside the track it feeds, in
 * `detailGallery.ts`. */
export { DETAIL_PHOTO_MIN } from "./detailGallery.js";

/**
 * THE GUTTER BETWEEN TWO PHOTOGRAPHS, and it is the page's own (D418).
 *
 * The gallery painted a flat `spacing[3]` — 12px on a 390px phone and 12px on
 * a 1280px desktop — while the page around it had already decided that its
 * edge is 4px on a phone and 24px on a desktop. Measured on the live listing:
 * `getComputedStyle(gallery).gap` answered `12px` at both widths, so neither
 * of the two declared numbers was ever on screen and the tiles sat closer
 * together than the page edge on a desktop and three times further apart than
 * it on a phone.
 *
 * `--stapel-page-gutter` is a RESPONSIVE token role (`@stapel/tokens`: 4px
 * phone, 8px tablet, 24px desktop, declared once with its own media arms), and
 * reading it as a VAR rather than computing a number is the load-bearing half:
 * a value picked in JS is applied at render, so a window resized between
 * renders keeps the gutter it was drawn with, where a var reflows. Written
 * through `cssVar` so a renamed role fails to compile instead of silently
 * resolving to nothing, with the flat value this grid used before as the
 * fallback for a host that loads no token stylesheet.
 */
export const DETAIL_GALLERY_GUTTER: string = `${cssVar("page-gutter").slice(0, -1)}, ${String(spacing[3])}px)`;

export interface ListingDetailPaneProps
  extends ThemeModeProp,
    CategoryFeaturesProp {
  readonly id: number;
  /** The reader's own uuid, when the host knows it. Enables the owner view —
   * the only place the moderation axis is shown, because it is the only
   * person it concerns. */
  readonly viewerId?: string;
  /**
   * Which desktop the page renders: the single reading column it has always
   * been (default `"column"`, byte-compatible for existing hosts), or the
   * reference design's two-column split — see this file's header for the
   * measurement that earned it. The host states the axis; the pane never
   * reads the viewport.
   */
  readonly layout?: "column" | "split";
  /**
   * WHO OWNS THE PAGE EDGE.
   *
   * `"own"` (default, byte-compatible) keeps the pane's own `spacing[4]`
   * gutter — right for a host that mounts the pane on a bare route with
   * nothing padding it.
   *
   * `"shell"` says a page frame already placed that edge, so the pane adds
   * none. `@stapel/shell-react` pads its content box with
   * `--stapel-page-gutter` — a RESPONSIVE role, 4px on a phone and 24px on a
   * desktop — and the pane then stacked a flat 16px inside it: a 40px left
   * edge on a desktop, and on a 360px phone a 20px edge on each side eating
   * a ninth of the screen the photos are read on. Two gutters is one gutter
   * too many, and only the host knows whether it has a frame; measured on a
   * live storefront, which worked around it by negatively margining the pane
   * back out to the frame's edge.
   */
  readonly gutter?: "own" | "shell";
  /**
   * The host's seller block (a profile card, ratings, "member since" — a
   * different pair's data, so it arrives as a node). In `"split"` it renders
   * inside the sticky buy column, under the actions, where the reference
   * design keeps it. In `"column"` it takes the position
   * {@link asidePlacement} names.
   */
  readonly aside?: ReactNode;
  /**
   * Where {@link aside} sits in the ONE-COLUMN arm (`layout="column"`);
   * ignored in `"split"`, where the buy column already puts it under the
   * actions.
   *
   *  - `"end"` (default, byte-compatible) — the end of the reading flow,
   *    directly above `footer`.
   *  - `"after-actions"` — directly under the actions, before the description
   *    and the spec table.
   *
   * The phone is the whole argument. `"column"` IS the phone rendering of
   * this page, and there the seller block sat below a description, a spec
   * table and a meta table: measured on a live storefront, "who am I buying
   * from" was two full screens of scrolling below "message the seller" — the
   * two halves of one decision, separated by everything else on the page.
   * The split layout already reads the other way round (price, actions,
   * seller), and this is that reading order for the column.
   */
  readonly asidePlacement?: "end" | "after-actions";
  /**
   * THE primary action for a buyer: "message the seller", filled by the
   * container from `@stapel/chat-react`. Rendered first, before favouriting,
   * and never shown to the owner.
   */
  readonly contactSlot?: ReactNode;
  /** Open the composer on this listing — the owner's primary. Absent is a real
   * answer: the button then states that this app has no editing screen. */
  readonly onEdit?: (id: number) => void;
  /**
   * TWO THINGS UNDER ONE NAME, and the type tells them apart.
   *
   *  - a NODE — extra chrome beside the primary (the seller's profile link, a
   *    control from another pair). What this prop has always been, unchanged,
   *    and still rendered at the end of the buy box. Cross-pair navigation is
   *    the container's job (spec §6.2 item 5), so this pair takes nodes
   *    rather than routes.
   *  - a CONFIG — `{ share: false }` / `{ favorite: false }`, switching off
   *    one of the page's own two reader actions.
   *
   * A union rather than a second prop, because they are the same question
   * ("what is in the action row") asked from two sides, and it is
   * unambiguous at runtime: a plain object that is not a React element was
   * never a legal `ReactNode` in the first place — React refuses to render
   * one — so `{ share: false }` cannot be a node that somebody meant.
   */
  readonly actions?: ReactNode | ListingActionsConfig;
  /**
   * The listing's CANONICAL address, for the share sheet — the route the
   * container built (`/l/7`, or an absolute URL), not the address bar.
   *
   * Absent, sharing falls back to `window.location.href`, which is honest for
   * a bare mount and wrong for a real app: the address a visitor is standing
   * on carries the SERP query they arrived from, the page anchor and whatever
   * tracking parameters came with them, and none of that belongs in a link
   * somebody sends to a friend. See `useShare`.
   */
  readonly shareUrl?: string;
  /**
   * Which arm the share control uses — handed to `<ShareAction prefer>`
   * through the cluster. Default `"auto"`: the platform sheet where the
   * primary pointer is coarse, this pair's menu on a mouse. See
   * `SharePreference` for the measurement that made the pointer part of the
   * question (§25).
   */
  readonly sharePrefer?: SharePreference;
  /** Analytics: which channel a completed share went through. */
  readonly onShared?: (channel: ShareChannel) => void;
  /**
   * How many people saved this listing, when the host was told by something
   * else. The listings wire carries `is_favorited` — a per-reader boolean —
   * and no aggregate at all, so this pair never invents the number and never
   * draws a zero in place of "nobody counted".
   */
  readonly favoriteCount?: number;
  /**
   * WHERE THE READER'S TWO ACTIONS SIT.
   *
   *  - `"header"` (default) — beside the title, at the trailing edge of the
   *    heading row, which is where the reference classified puts them and
   *    where a person looks for them on both a phone and a desktop;
   *  - `"gallery"` — pinned over the photographs' trailing top corner, for a
   *    phone-first host that wants them on the picture. The corner is chosen
   *    rather than free: the dots own the bottom centre of the strip and the
   *    photo counter owns the bottom trailing corner;
   *  - `"buy-box"` — inside `listings-detail-actions`, beside "message the
   *    seller", which is where the favourite alone used to live. The escape
   *    hatch for a host whose page was laid out around it;
   *  - `"bar"` — the condensed top bar the host draws through
   *    {@link renderActionsBar}. Only meaningful in a LIST beside one of the
   *    three above, and only with that render prop: it names a second place
   *    the one cluster may travel to, never a home of its own.
   *
   * A LIST is how a host says "both": `["header", "bar"]` keeps the cluster
   * beside the title and lends it to the bar for as long as the bar is on
   * screen. Exactly one home placement is honoured — the first non-`"bar"`
   * entry — because two homes would need two instances, which is the defect
   * this closes rather than the feature it adds.
   */
  readonly actionsPlacement?:
    | ListingActionsPlacement
    | readonly ListingActionsPlacement[];
  /**
   * THE SAME CLUSTER, IN A SECOND PLACE — a condensed bar, typically.
   *
   * Called with the bar's MOUNT POINT, not with a copy of the cluster: return
   * it wrapped in whatever chrome the bar is (`position: fixed`, a back arrow,
   * the title), and the pane moves its one `<ListingActions>` into it. Return
   * `null` while the bar is not on screen and the cluster goes back where it
   * came from — the same DOM node, the same hooks, an optimistic favourite
   * still in flight uninterrupted.
   *
   * Requires `"bar"` in {@link actionsPlacement}. Pair it with
   * {@link onTitleVisible} for the usual rule: the bar appears when the title
   * leaves the fold.
   *
   * ```tsx
   * <ListingDetailPane
   *   actionsPlacement={["header", "bar"]}
   *   onTitleVisible={(visible) => { setBarShown(!visible); }}
   *   renderActionsBar={(cluster) =>
   *     barShown ? <div className="topbar">{back}{title}{cluster}</div> : null
   *   }
   * />
   * ```
   *
   * A container that mounted its own second `<ListingActions>` for this can
   * delete it: two `useFavoriteToggle` instances on one page, two hearts that
   * agree only after a refetch, and a second set of test ids to keep the
   * pane's own single are all what this prop exists to end.
   */
  readonly renderActionsBar?: (cluster: ReactNode) => ReactNode;
  /**
   * IS THE TITLE STILL IN THE FOLD?
   *
   * An `IntersectionObserver` on the pane's own `<h1>` — never a `scroll`
   * listener, which asks the question on every frame of a page whose job is
   * scrolling photographs and answers it no better. Called on each crossing
   * and not on every scroll: `false` when the title leaves, `true` when it
   * comes back.
   *
   * It exists because the chrome a host hangs on this had no way to ask. A
   * container drawing a condensed bar found the title by the pane's published
   * `data-testid` and waited for it with a `MutationObserver`, because the
   * title lands with the listing and not with the first frame — a private
   * selector and a subscription, for a boolean the pane already knows.
   *
   * NOT called at all where the environment has no `IntersectionObserver`:
   * the honest answer there is "this page cannot tell", and a fabricated
   * `true` would leave a host's bar wedged open on the arm that has no
   * scrolling anyway.
   *
   * Pass a STABLE function (a `useState` setter, a `useCallback`). The
   * observer is created once for the title node and reads the latest callback
   * through a ref, so an inline arrow works and does not re-observe.
   */
  readonly onTitleVisible?: (visible: boolean) => void;
  /**
   * WHAT SHAPE THE PHOTOGRAPHS ARE IN.
   *
   *  - `"grid"` (default) — the element-width grid this pane has always drawn,
   *    `repeat(auto-fit, minmax(14rem, 1fr))`: three tiles across a desktop
   *    pane, one across a phone;
   *  - `"strip"` — a snap-scrolling horizontal strip, one photograph visible
   *    with the next peeking. On a 390px phone the grid resolves to one
   *    column, so a listing with three pictures pushes its own title and price
   *    nearly three screens down — the first thing a person sees after tapping
   *    a search result is a photograph with nothing beside it.
   *
   * The HOST names it, the same rule as {@link layout} and for the same
   * reason: the side that knows the viewport it granted decides, and no media
   * query is guessed in a leaf. A live storefront was carrying
   * `display: flex !important` against this pane's inline `display: grid` to
   * say exactly this; that declaration is a class now, so even a host wanting
   * a third shape needs a selector rather than an `!important`.
   */
  readonly galleryLayout?: ListingGalleryLayout;
  /**
   * The container's sign-in door, rendered beside the favourite's refusal —
   * the same `SignInCta` seam the three card skins already take. The pane was
   * the one heart in this pair whose "sign in to do this" had no door next to
   * it (measured on a live storefront: the sentence, and the nearest sign-in
   * a screen-corner away), which is exactly the gap `signIn` closed on the
   * cards. Absent: the reason stands alone, as before.
   */
  readonly signIn?: SignInCta;
  /**
   * How the favourite's blocked reason speaks: `"text"` (default) keeps the
   * standing sentence + door beside the heart; `"popover"` moves both into a
   * disclosure on the heart itself — the cards' third arm, same argument and
   * same accessibility floor (see `ListingCardBlockedReason`), for a host
   * whose chrome already carries a standing sign-in door.
   */
  readonly blockedReason?: "text" | "popover";
  /**
   * WHICH HEADING THE TITLE IS.
   *
   * The listing title is the page's subject, but the pane drew it at `h3`
   * unconditionally — right for a pane mounted inside a page that already has
   * its own `h1`, wrong for the storefront route where this pane IS the page
   * and the document then had no `h1` at all (measured on a live storefront,
   * which worked around it with an offscreen heading above the pane). The
   * host is the only side that knows which of the two it built, so it says.
   *
   * Default `3`, byte-compatible for every existing mount.
   */
  readonly headingLevel?: 1 | 2 | 3;
  /**
   * WHERE THE BUY COLUMN'S STICKY TOP EDGE IS — the offset of whatever chrome
   * is pinned above this page (`layout="split"` only; the one-column arm has
   * no sticky column).
   *
   * ```tsx
   * // the height <PublicShell> publishes, read rather than restated
   * <ListingDetailPane layout="split" buyTop="var(--stapel-header-height)" />
   * ```
   *
   * The column is `position: sticky; top: 16px` written INLINE, and an inline
   * declaration is beaten by nothing short of `!important` — so a host with a
   * pinned header had no way to say "start below it". Measured on the stand
   * (D456): the storefront's header is sticky and 64px tall, and at any scroll
   * depth the top of the buy column — the price's own first twenty pixels —
   * sat UNDER it. Same seam and same argument as `<SearchPage railTop>`, which
   * this prop is deliberately spelled after.
   *
   * A number is pixels; a string is taken as written (a `var()`, a `calc()`,
   * `"4rem"`). Default `spacing[4]` — 16px, exactly where the column has
   * always started — so an existing mount is byte-compatible.
   */
  readonly buyTop?: number | string;
  /**
   * HOW WIDE THE PANE MAY GET — the `max-width` it writes on its own root.
   *
   * Default is the constant for the arm on screen: {@link DETAIL_MEASURE}
   * (60rem) in `"column"`, {@link DETAIL_SPLIT_MEASURE} (75rem) in `"split"`,
   * so no existing mount changes shape. Anything CSS `max-width` takes is
   * accepted (`"80rem"`, `1280`, `"100%"`).
   *
   * `"none"` removes the cap, and it is the answer for a pane mounted inside
   * a page frame that already decided the measure. That case is not
   * hypothetical: measured on the stand at 1440 (D457), the listing page's
   * content ended at x=1224 with 216px of empty gutter beside it while every
   * other page of the same site ran to the frame's edge — a second, lower cap
   * inside a container that already had one. The cap is written INLINE, so
   * the container could not outrank it without `!important` and reached for
   * `min-inline-size: 100%` instead (a minimum beats a maximum by the sizing
   * rules); this prop is that workaround's replacement, and the same seam
   * `<CategoryPage measure>` already offers.
   */
  readonly measure?: number | string;
  readonly footer?: ReactNode;
}

/**
 * Where the reader's cluster may sit. Three homes and one loan — see
 * {@link ListingDetailPaneProps.actionsPlacement}.
 */
export type ListingActionsPlacement =
  | "header"
  | "gallery"
  | "buy-box"
  | "bar";

/** The cluster's HOME: the first entry that is not the borrowed bar. */
function homePlacement(
  placement: ListingDetailPaneProps["actionsPlacement"]
): Exclude<ListingActionsPlacement, "bar"> {
  if (placement === undefined) return "header";
  if (typeof placement === "string") {
    // `"bar"` alone names no home — the cluster still has to live somewhere
    // while the bar is off screen, and that somewhere is the default.
    return placement === "bar" ? "header" : placement;
  }
  for (const one of placement) {
    if (one !== "bar") return one;
  }
  return "header";
}

/** Did the host ask for the borrowed placement at all? */
function wantsBar(
  placement: ListingDetailPaneProps["actionsPlacement"]
): boolean {
  if (placement === undefined) return false;
  if (typeof placement === "string") return placement === "bar";
  return placement.includes("bar");
}

/** Priorities for the two mount points: the bar wins while it is on screen. */
const CLUSTER_HOME = 0;
const CLUSTER_BAR = 1;

/**
 * The pane's own title, watched — see
 * {@link ListingDetailPaneProps.onTitleVisible}.
 *
 * Returns a callback ref for the heading element. The observer is created once
 * per node and disconnected by React 19's ref cleanup; the host's callback is
 * read through a ref at call time, so an inline arrow does not re-observe on
 * every render of a page that re-renders on every query update.
 */
function useTitleVisibility(
  onTitleVisible: ((visible: boolean) => void) | undefined
): (node: HTMLElement | null) => (() => void) | undefined {
  const latest = useRef(onTitleVisible);
  useEffect(() => {
    latest.current = onTitleVisible;
  });
  const wanted = onTitleVisible !== undefined;
  return useCallback(
    (node: HTMLElement | null): (() => void) | undefined => {
      if (node === null || !wanted) return undefined;
      // No observer, no answer. A fabricated `true` would wedge a host's bar
      // open on an arm that has no scrolling to close it with.
      if (typeof IntersectionObserver === "undefined") return undefined;
      const observer = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (entry === undefined) return;
        latest.current?.(entry.isIntersecting);
      });
      observer.observe(node);
      return () => {
        observer.disconnect();
      };
    },
    [wanted]
  );
}

/**
 * Which arm of `actions` this is.
 *
 * A plain object that is not a React element and not an array was never a
 * legal `ReactNode` — React throws on rendering one — so there is no value a
 * caller could have meant as chrome that lands here. `null` and `undefined`
 * are nodes (the empty ones) and stay on the node side.
 */
function isActionsConfig(
  value: ReactNode | ListingActionsConfig
): value is ListingActionsConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !isValidElement(value)
  );
}

export function ListingDetailPane(props: ListingDetailPaneProps): ReactElement {
  const t = useT();
  const notice = useNotice();
  const { locale } = useI18n();
  const { token } = antdTheme.useToken();
  const bag = useListingDetail(props.id, {
    ...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {}),
    ...(props.categoryFeatures !== undefined
      ? { categoryFeatures: props.categoryFeatures }
      : {}),
  });
  const owner = bag.viewerIsOwner === true;
  const actions = useListingActions(props.id, bag.status?.lifecycle.status);
  const editGate = actions.editGate(props.onEdit !== undefined);
  // The gate VIEW (localized reason), for the popover arm — the "text" arm
  // leaves rendering the reason to `<GatedControl>`, which computes its own.
  const favoriteView = useActionGate(bag.favoriteGate);
  const split = props.layout === "split";
  const placement = homePlacement(props.actionsPlacement);
  /* THE SECOND PLACEMENT IS A LOAN, NOT A COPY. Both halves have to be asked
     for: `"bar"` in the placement list says the cluster may travel, and
     `renderActionsBar` is the only thing that can put it anywhere. With
     neither — every existing mount — nothing below changes: one cluster,
     rendered inline where it always was, no portal and no slot divs. */
  const galleryLayout: ListingGalleryLayout = props.galleryLayout ?? "grid";
  const renderBar = props.renderActionsBar;
  const barred = wantsBar(props.actionsPlacement) && renderBar !== undefined;
  const movable = useMovableCluster(barred);
  const moving = barred && movable.portable;
  const titleRef = useTitleVisibility(props.onTitleVisible);
  // The two arms of `actions` — see `isActionsConfig`.
  const actionsConfig: ListingActionsConfig | undefined = isActionsConfig(
    props.actions
  )
    ? props.actions
    : undefined;
  const actionsNode: ReactNode = isActionsConfig(props.actions)
    ? null
    : props.actions;

  const favoriteLabel = t(
    bag.isFavorited
      ? LISTINGS_I18N_KEYS.cardFavoriteRemove
      : LISTINGS_I18N_KEYS.cardFavoriteAdd
  );
  // Saved is a SOLID accent shape; not-saved (and `is_favorited: null`, which
  // is "nobody asked", not "no") is the outline. The bag flips it on the
  // gesture and rolls it back if the write fails — see `useListingDetail`.
  const heartIcon = (
    <HeartIcon
      filled={bag.isFavorited}
      {...(bag.isFavorited ? { color: token.colorPrimary } : {})}
    />
  );
  /**
   * The press, and the sentence it earns.
   *
   * The heart on this page is icon-only (§23: the reference draws a 44×44
   * glyph where this pane drew a 152px button with a word in it), so the
   * only thing a person reads back off the gesture is a fill changing colour
   * in the corner of a row. That is enough to SEE and not enough to be sure
   * of, which is what the toast is for — raised from the state the icon is
   * about to draw, so both arrive together. A write that then fails rolls the
   * icon back and says so through `listings-detail-favorite-error`.
   */
  const pressFavorite = (): void => {
    const next = !bag.isFavorited;
    bag.toggleFavorite();
    if (!bag.favoriteGate.available) return;
    notice(
      t(
        next
          ? LISTINGS_I18N_KEYS.favoriteAdded
          : LISTINGS_I18N_KEYS.favoriteRemoved
      )
    );
  };

  return (
    <SkinTheme
      surface="base"
      style={{
        maxWidth: props.measure ?? (split ? DETAIL_SPLIT_MEASURE : DETAIL_MEASURE),
        // See `gutter`: a frame that already placed the page edge does not get
        // a second one stacked inside it.
        padding: props.gutter === "shell" ? 0 : spacing[4],
      }}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={spacing[4]} data-testid="listings-detail">
        {bag.removed ? (
          <ErrorAlert
            testId="listings-detail-removed"
            message={t(LISTINGS_I18N_KEYS.detailRemoved)}
          />
        ) : null}

        {matchLoad(bag.state, {
          loading: () => (
            <div
              role="status"
              aria-busy="true"
              aria-label={t(LISTINGS_I18N_KEYS.detailLoading)}
              data-testid="listings-detail-loading"
              data-stapel-load-state="loading"
            />
          ),
          // The failed arm, most specific sentence first: removed (the banner
          // above already says it) → not found → withdrawn → the generic
          // retry. `withdrawn` carries no retry control on purpose — the row
          // is gone by its owner's choice, and a retry that can never help is
          // what this arm replaces.
          failed: (error) =>
            bag.removed ? null : bag.notFound ? (
              <EmptyState
                testId="listings-detail-error"
                title={t(LISTINGS_I18N_KEYS.detailNotFound)}
              />
            ) : bag.withdrawn ? (
              <EmptyState
                testId="listings-detail-withdrawn"
                title={t(LISTINGS_I18N_KEYS.detailWithdrawn)}
              />
            ) : (
              <ErrorAlert
                testId="listings-detail-error"
                thrown={error}
                message={t(LISTINGS_I18N_KEYS.detailLoadFailed)}
                onRetry={bag.refetch}
                retryLabel={t(LISTINGS_I18N_KEYS.detailRetry)}
              />
            ),
          ready: (listing) => {
            /* The moderation axis is the OWNER's business and nobody
               else's: a buyer has no use for "changes under review", and
               showing a stranger that a listing was refused would leak a
               verdict about someone else's content. Rendered above the
               split, full width — a verdict is about the PAGE, not about
               either of its columns. */
            const statusBlocks = (
              <>
                {owner && bag.status !== undefined ? (
                  <Flex vertical gap={spacing[2]} data-testid="listings-detail-owner-view">
                    <ListingStatusBlock status={bag.status} />
                    {!bag.publiclyVisible ? (
                      <Typography.Text type="secondary">
                        {t(LISTINGS_I18N_KEYS.detailOwnerOnlyView)}
                      </Typography.Text>
                    ) : null}
                  </Flex>
                ) : null}

                {!owner && !bag.publiclyVisible ? (
                  <ErrorAlert
                    testId="listings-detail-not-published"
                    message={t(LISTINGS_I18N_KEYS.detailNotPublished)}
                    variant="inline"
                  />
                ) : null}
              </>
            );

            /* THE READER'S TWO ACTIONS, as one cluster — see
               `<ListingActions>` and `actionsPlacement`.

               The heart is handed IN rather than mounted by the cluster:
               this page's favourite is driven by `useListingDetail`'s own
               optimistic bag (it holds the whole listing and flips the row it
               already has), not by `useFavoriteToggle` against a card row.
               One control, two hooks, one geometry.

               The OWNER gets the share button and no heart: favouriting your
               own listing is not a thing anyone does, and sending somebody
               your own listing is the first thing a seller does. */
            const favoriteControl =
              owner ? null : props.blockedReason === "popover" &&
                favoriteView.reason !== undefined ? (
                  /* The cards' third volume, verbatim: nothing standing, the
                     reason and the door disclosed on the heart. `aria-disabled`
                     rather than `disabled`, so the disclosure's hover, focus
                     and tap all arrive — and the click is a safe no-op, because
                     `toggleFavorite` refuses while the gate is blocked. */
                  <GateReasonPopover
                    reason={favoriteView.reason}
                    cta={props.signIn}
                    testId="listings-detail-favorite-reason"
                  signInTestId="listings-detail-sign-in"
                >
                  {(bind) => (
                    <Button
                      shape="circle"
                      aria-disabled
                      {...bind}
                      className={LISTING_ACTION_CLASS}
                      aria-label={favoriteLabel}
                      aria-pressed={bag.isFavorited}
                      icon={heartIcon}
                      data-testid="listings-detail-favorite"
                      data-favorited={String(bag.isFavorited)}
                      data-analytics="none"
                      data-analytics-reason="business action — host app wraps with its own tracked()"
                      onClick={pressFavorite}
                    />
                  )}
                </GateReasonPopover>
              ) : (
                <Flex vertical gap={spacing[1]}>
                  <GatedControl
                    gate={bag.favoriteGate}
                    testId="listings-detail-favorite-gate"
                  >
                    {(bind) => (
                      <Button
                        shape="circle"
                        // See `<ListingCard>`: the binding, spread whole.
                        {...bind}
                        className={LISTING_ACTION_CLASS}
                        aria-label={favoriteLabel}
                        aria-pressed={bag.isFavorited}
                        icon={heartIcon}
                        data-testid="listings-detail-favorite"
                        data-favorited={String(bag.isFavorited)}
                        data-analytics="none"
                        data-analytics-reason="business action — host app wraps with its own tracked()"
                        onClick={pressFavorite}
                      />
                    )}
                  </GatedControl>
                  {/* The door. `GatedControl` prints the reason; where a
                      visitor signs in is the container's, and arrives as
                      `signIn` — the cards' own pattern, verbatim. */}
                  {bag.favoriteGate.available ? null : (
                    <Typography.Text
                      type="secondary"
                      data-testid="listings-detail-favorite-blocked"
                    >
                      <SignInLink cta={props.signIn} testId="listings-detail-sign-in" />
                    </Typography.Text>
                  )}
                </Flex>
              );

            const readerActions = (
              <ListingActions
                listingId={props.id}
                favorite={favoriteControl}
                testId="listings-detail-reader-actions"
                placement={placement === "gallery" ? "overlay" : "inline"}
                actions={{
                  ...actionsConfig,
                  // The owner keeps the share button and loses the heart.
                  ...(owner ? { favorite: false } : {}),
                }}
                {...(props.favoriteCount !== undefined && !owner
                  ? { favoriteCount: props.favoriteCount }
                  : {})}
                {...(props.shareUrl !== undefined ? { shareUrl: props.shareUrl } : {})}
                {...(listing.title !== undefined && listing.title !== null
                  ? { shareTitle: listing.title }
                  : {})}
                {...(props.sharePrefer !== undefined
                  ? { sharePrefer: props.sharePrefer }
                  : {})}
                {...(props.onShared !== undefined ? { onShared: props.onShared } : {})}
              />
            );

            /* What the PAGE draws where the cluster lives. With the bar in
               play that is a slot and not the cluster itself: the cluster is
               rendered once into `clusterLayer` below and travels between the
               two slots as a DOM node, so it mounts once, holds one
               `useFavoriteToggle`, and keeps its element identity across the
               move. Without it, the cluster is drawn inline exactly as it has
               always been. */
            const homeActions = moving
              ? movable.slot(CLUSTER_HOME, placement)
              : readerActions;

            /* The one instance, plus the host's bar around the slot that may
               borrow it. Rendered at the end of the page's own flow: the
               portal has no position of its own (its content is wherever the
               winning slot is), and a bar is `position: fixed` chrome whose
               place in the document order is not its place on the screen. */
            const clusterLayer =
              !moving || renderBar === undefined ? null : (
                <>
                  {movable.render(readerActions)}
                  {/* NOT a slot with a silent absence: `renderBar` is the only
                      thing that makes `moving` true, so this arm is
                      unreachable without one and the host's own `null` (the
                      bar off screen) is the answer that sends the cluster
                      home. There is no hole to place a `<SlotPlaceholder>` in
                      — the cluster is at its primary placement instead. */}
                  {renderBar(movable.slot(CLUSTER_BAR, "bar"))}
                </>
              );

            /* Element-width tiles: the grid decides how many fit, the
               photos fill them. */
            const gallery = (
              <div
                data-testid="listings-detail-gallery"
                className={LISTINGS_GALLERY_CLASS}
                // The layout is a CLASS and an attribute, not an inline
                // `display`: a host with a shape neither arm offers can then
                // write CSS for it at its own breakpoints without `!important`
                // over a pair's own geometry. See `detailGallery.ts`.
                data-gallery-layout={galleryLayout}
                style={{
                  // The page's own edge, per breakpoint — see
                  // `DETAIL_GALLERY_GUTTER` (D418).
                  gap: DETAIL_GALLERY_GUTTER,
                  // The containing block the overlay arm is pinned to. A
                  // `relative` with no offsets moves no pixel of what is
                  // already in it — the same trick `cardGalleryCss` uses.
                  position: "relative",
                }}
              >
                <style href={LISTINGS_GALLERY_STYLE_HREF} precedence="default">
                  {detailGalleryCss()}
                </style>
                {bag.images.length === 0 ? (
                  <ListingPhoto
                    imageRef={undefined}
                    alt={listing.title ?? String(listing.id)}
                  />
                ) : (
                  bag.images.map((ref, index) => (
                    <ListingPhoto
                      key={ref}
                      imageRef={ref}
                      alt={t(LISTINGS_I18N_KEYS.detailPhotoAlt, {
                        index: index + 1,
                        total: bag.images.length,
                      })}
                    />
                  ))
                )}
                {placement === "gallery" ? homeActions : null}
              </div>
            );

            const heading = (
              <>
                {/* THE TITLE AND THE TWO ACTIONS SHARE A LINE (§23).
                    The reference classified puts save-and-share at the
                    trailing edge of the heading, on a phone and on a desktop
                    alike, and that is the only place on this page where a
                    person looks for them. `align-items:flex-start` so a
                    two-line title does not drag the glyphs down its second
                    line; `minWidth:0` so a long unbroken word wraps instead
                    of pushing them off the pane. */}
                <Flex align="flex-start" justify="space-between" gap={spacing[3]}>
                  <Typography.Title
                    level={props.headingLevel ?? 3}
                    ref={titleRef}
                    data-testid="listings-detail-title"
                    style={{ minWidth: 0, flex: "1 1 auto" }}
                  >
                    {listing.title ?? ""}
                  </Typography.Title>
                  {placement === "header" ? homeActions : null}
                </Flex>

                {/* The `show_at_title` projection, formatted from the stored
                    DAOs — no category read needed (see model/features.ts). */}
                {bag.titleFeatures.length > 0 ? (
                  <Typography.Text type="secondary" data-testid="listings-detail-title-features">
                    {bag.titleFeatures
                      // A hidden value is never part of a title: the server
                      // keeps one out of `features_title` entirely, and
                      // `formatFeatureValue` refuses a stub besides (it carries
                      // no value, so there is nothing to format). The filter is
                      // the third belt, and it is here rather than at the
                      // formatter's edge because THIS is the line where a
                      // leaked identifier would be read out loud.
                      .filter((view) => !isRedactedValue(view.value))
                      .map((view) =>
                        formatSpecValue(view.feature, view.value, { t, locale })
                      )
                      .filter((text): text is string => text !== undefined)
                      .join(" · ")}
                  </Typography.Text>
                ) : null}

                {/* How many people opened it — the listing's own meta line,
                    under the title, where a reader looks for how much company
                    they have. It spent one release as a row of the
                    `<Descriptions>` below (walker D106): wedged between the
                    colour attribute and the location row, two screens down,
                    read as a PROPERTY OF THE GOODS rather than a fact about
                    the page. A view count is not a characteristic of a phone.

                    `bag.viewCount` is `undefined` when the response carries
                    no such field, and then there is no line at all — never a
                    zero standing in for an absence. There is no favourite
                    count beside it because the wire has none: the schema
                    carries `is_favorited`, a per-reader boolean, and no
                    aggregate anywhere (asserted in test/engagementState). */}
                {bag.viewCount !== undefined ? (
                  <Typography.Text
                    type="secondary"
                    data-testid="listings-detail-meta"
                    style={{ display: "block" }}
                  >
                    {t(LISTINGS_I18N_KEYS.detailViews)}:{" "}
                    <span data-testid="listings-detail-views">
                      {bag.viewCount}
                    </span>
                  </Typography.Text>
                ) : null}
              </>
            );

            /* In the split the price leads the buy column at level 2 — the
               measured page had it at 22px UNDER the title, smaller than the
               thing it prices, which is backwards on the one line a buyer
               came to read. In the column it stays the level-4 line it has
               always been. */
            const price = (
              <Typography.Title
                level={split ? 2 : 4}
                data-testid="listings-detail-price"
              >
                <ListingPrice
                  amount={listing.price}
                  {...(listing.currency !== undefined
                    ? { currency: listing.currency }
                    : {})}
                />
              </Typography.Title>
            );

            /* The buy box. One primary, and which one depends on who is
               reading this page. */
            const buyBox = (
              <Flex
                wrap
                gap={spacing[3]}
                align="flex-start"
                data-testid="listings-detail-actions"
              >
                {owner ? (
                  <>
                    <GatedButton
                      gate={editGate}
                      type="primary"
                      testId="listings-detail-edit"
                      data-analytics="none"
                      data-analytics-reason="business action — host app wraps with its own tracked()"
                      onClick={() => {
                        props.onEdit?.(props.id);
                      }}
                    >
                      {t(LISTINGS_I18N_KEYS.detailEdit)}
                    </GatedButton>
                    <GatedButton
                      gate={actions.archive}
                      danger
                      testId="listings-detail-take-down"
                      data-analytics="none"
                      data-analytics-reason="business action — host app wraps with its own tracked()"
                      onClick={actions.doArchive}
                    >
                      {t(LISTINGS_I18N_KEYS.detailTakeDown)}
                    </GatedButton>
                  </>
                ) : (
                  <div data-testid="listings-detail-contact">
                    {props.contactSlot ?? <SlotPlaceholder name="contactSlot" />}
                  </div>
                )}

                {/* The reader's two actions live in the cluster now (see
                    `actionsPlacement`); the buy box keeps them only when a
                    host asks for the layout this page used to have. */}
                {placement === "buy-box" ? homeActions : null}

                {actionsNode}
              </Flex>
            );

            const actionError = (
              <>
                {actions.error !== undefined && actions.error !== null ? (
                  <ErrorAlert
                    testId="listings-detail-action-error"
                    thrown={actions.error}
                    variant="inline"
                  />
                ) : null}
                {/* A save that did not save. The heart has already rolled
                    back to the state the tap started from — that is the
                    honest picture and a silent one, so the sentence goes
                    beside it. `ErrorAlert` renders nothing for nothing. */}
                <ErrorAlert
                  testId="listings-detail-favorite-error"
                  thrown={bag.favoriteError}
                  variant="inline"
                />
              </>
            );

            const description = (
              <>
                <Typography.Title level={5}>
                  {t(LISTINGS_I18N_KEYS.detailDescription)}
                </Typography.Title>
                <Typography.Paragraph data-testid="listings-detail-description">
                  {listing.description ?? ""}
                </Typography.Paragraph>
              </>
            );

            /* The DISPLAY envelope, not the edit one: a redacted row keeps
               its place in the table and says the seller supplied the value.
               `featuresDtoFromDaoList` deliberately drops a stub, because it
               is what seeds a composer. */
            const specValues = featureValuesForDisplay(
              asFeatureDaoList(listing.features),
              props.categoryFeatures !== undefined
                ? { categoryFeatures: props.categoryFeatures }
                : {}
            );
            /* Two spec columns in the split — a grid of whole ROWS, cut by
               row count so the category's declaration order survives: the
               first (larger) half fills the left list and the page reads
               top-to-bottom, left column first, exactly as the one-column
               list reads. The label is never a column of its own; see
               `<ListingSpecList>` for the shape and why the table went. */
            const specFeatures = bag.features.map((view) => view.feature);
            const specs =
              bag.features.length === 0 ? (
                <Typography.Text type="secondary" data-testid="listings-detail-no-specs">
                  {t(LISTINGS_I18N_KEYS.detailNoSpecs)}
                </Typography.Text>
              ) : split ? (
                <ListingSpecColumns features={specFeatures} values={specValues} />
              ) : (
                <ListingSpecList features={specFeatures} values={specValues} />
              );

            const specsSection = (
              <>
                <Typography.Title level={5}>
                  {t(LISTINGS_I18N_KEYS.detailSpecs)}
                </Typography.Title>
                {specs}

                {/* Counted, not rounded to zero: a stored attribute this build
                    cannot key is a gap in what the buyer is being told. */}
                {bag.unreadableFeatures > 0 ? (
                  <Typography.Text
                    type="warning"
                    data-testid="listings-detail-unreadable"
                  >
                    {t(LISTINGS_I18N_KEYS.detailUnreadableFeatures, {
                      count: bag.unreadableFeatures,
                    })}
                  </Typography.Text>
                ) : null}
              </>
            );

            const hasStock = listing.stock_quantity != null;
            const hasPlace =
              listing.location_label !== undefined &&
              listing.location_label.length > 0;

            // Both rows absent draws an empty table, which the view count used
            // to hide by almost always being there. Nothing is nothing.
            const meta = !hasStock && !hasPlace ? null : (
              <Descriptions size="small" column={1}>
                {/* Label cell and value cell, which is what a `<Descriptions>`
                    row IS: the label key carries no `{count}` (it did, and the
                    page printed the placeholder), the quantity is the value. */}
                {hasStock ? (
                  <Descriptions.Item label={t(LISTINGS_I18N_KEYS.detailStock)}>
                    <span data-testid="listings-detail-stock">
                      {listing.stock_quantity}
                    </span>
                  </Descriptions.Item>
                ) : null}
                {hasPlace ? (
                  <Descriptions.Item
                    label={t(LISTINGS_I18N_KEYS.composeLocationLabel)}
                  >
                    {listing.location_label}
                  </Descriptions.Item>
                ) : null}
                {/* The view count used to be a third row here. It is a fact
                    about the PAGE, not a property of the goods, so it now
                    reads on the meta line under the title — see `heading`. */}
              </Descriptions>
            );

            const aside =
              props.aside !== undefined ? (
                <div data-testid="listings-detail-aside">{props.aside}</div>
              ) : null;

            if (!split) {
              // The single column. `"end"` is the order it has always read —
              // the host's aside joins where the footer's flow already is;
              // `"after-actions"` puts the seller beside the decision to
              // contact them, which is where the split layout already has it.
              const asideAfterActions =
                props.asidePlacement === "after-actions";
              return (
                <>
                  {statusBlocks}
                  {gallery}
                  {heading}
                  {price}
                  {buyBox}
                  {actionError}
                  {asideAfterActions ? aside : null}
                  <Divider />
                  {description}
                  {specsSection}
                  {meta}
                  {asideAfterActions ? null : aside}
                  {props.footer}
                  {clusterLayer}
                </>
              );
            }

            return (
              <>
                {statusBlocks}
                <div
                  data-testid="listings-detail-split"
                  style={{
                    display: "grid",
                    // The reading column takes what is left and may shrink
                    // (`minmax(0, …)`, or a long unbroken title widens the
                    // track past the pane); the buy column's track is fixed —
                    // see DETAIL_SPLIT_ASIDE for why it is not a fraction.
                    gridTemplateColumns: `minmax(0, 1fr) ${DETAIL_SPLIT_ASIDE}`,
                    gap: spacing[5],
                    alignItems: "start",
                  }}
                >
                  <Flex vertical gap={spacing[4]}>
                    {gallery}
                    {heading}
                    <Divider />
                    {description}
                    {specsSection}
                    {meta}
                    {props.footer}
                  </Flex>
                  {/* Sticky, so the actions ride along a page whose left
                      column is as tall as the seller's photo set. `alignSelf:
                      "start"` is load-bearing: a grid item stretches to the
                      row's height by default, and an element as tall as its
                      scroll container has nowhere to stick. */}
                  <Flex
                    vertical
                    gap={spacing[3]}
                    data-testid="listings-detail-buy-column"
                    style={{
                      position: "sticky",
                      top: props.buyTop ?? spacing[4],
                      alignSelf: "start",
                    }}
                  >
                    {price}
                    {buyBox}
                    {actionError}
                    {aside}
                  </Flex>
                </div>
                {clusterLayer}
              </>
            );
          },
        })}
      </Flex>
    </SkinTheme>
  );
}
