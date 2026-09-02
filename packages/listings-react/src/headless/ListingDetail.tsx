import { useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  errorStatus,
  firstBlock,
  loadFailed,
  loadLoading,
  loadReady,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type {
  FeatureDef,
  ListingDetail as ListingDetailData,
  ListingFeatureView,
  ListingStatusInfo,
} from "../api/types.js";
import { useListing, useListingStatus } from "../model/queries.js";
import { useFavoriteListing } from "../model/mutations.js";
import { asFeatureDaoList, featuresFromDaoList, unreadableFeatureCount } from "../model/features.js";
import { isListingViewed, listingViewCount } from "../model/engagement.js";
import type { FeatureCopySource } from "../model/features.js";
import { listingStatusView } from "../model/status.js";
import type { ListingStatusView } from "../model/status.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import {
  LISTINGS_ELEVATION_ACTIONS,
  useElevatableMandateGate,
} from "./useMandateGate.js";

/**
 * `images` is `string[] | NULL` on the wire, and the null is the SERVER
 * saying "this listing has no photos" — not this pair saying "we do not
 * know". Whether the read landed at all is carried by `state`, one field
 * over, so collapsing the null here loses nothing: a named constant makes
 * that argument visible where a bare `?? []` would look like the flattening
 * `no-flattened-load-state` bans.
 */
const NO_IMAGES: readonly string[] = [];

/**
 * Everything a listing page renders, with the two absences it must be able to
 * tell apart.
 *
 * ── Why a second read runs beside the detail ───────────────────────────────
 *
 * `GET /listings/{pk}/` reads `Listing.objects`, which excludes soft-deleted
 * rows: a removed listing answers 404, and a 404 is also what a made-up id
 * answers. `GET /listings/{pk}/status/` reads `Listing.all_objects` and is
 * `AllowAny`, so it still answers for the removed one. Running both is what
 * turns "there is no listing at this address" and "this listing was removed"
 * into two different sentences — and the second is the one a person following
 * a stale link actually needs.
 *
 * The probe is not a fallback fired after a failure: it runs in parallel, so
 * the page resolves in one round trip rather than two sequential ones.
 *
 * ── Visibility is reported, not assumed ────────────────────────────────────
 *
 * The detail endpoint has NO `published()` filter on its queryset, so a draft
 * and a taken-down listing both answer 200 to anyone holding the id. The bag
 * therefore carries `publiclyVisible` (computed from `status`, the one field
 * that decides it) and `viewerIsOwner`, and a skin says which of the two
 * situations it is in. Rendering a draft as a live shop page would be the
 * pair repeating the server's omission instead of covering it.
 */
export interface ListingDetailBag {
  readonly id: number;
  readonly state: LoadState<ListingDetailData>;
  /** The status probe, which answers for rows the detail cannot see. */
  readonly statusState: LoadState<ListingStatusInfo>;
  /** True when the detail 404s AND the probe says the row is soft-deleted —
   * i.e. it existed and is gone, rather than never having existed. */
  readonly removed: boolean;
  /** The detail 404s and the probe finds nothing either. */
  readonly notFound: boolean;
  /**
   * The detail 404s, the probe ANSWERED, and the row is NOT soft-deleted:
   * a listing taken down on purpose (archived), not deleted and not a typo.
   *
   * Measured on a live stand: the probe's whole body for such a row was
   * `{"is_deleted": false}` — hence the `!== true` below rather than a read
   * of fields the body may not carry. Without this flag the pane fell into
   * the generic "could not load / retry" arm: a retry that can never help,
   * on a row that is gone by its owner's choice.
   */
  readonly withdrawn: boolean;
  /** Both axes plus the sentence that comes out of the pair of them. */
  readonly status: ListingStatusView | undefined;
  readonly publiclyVisible: boolean;
  /** Whether the person reading this is the owner, when both the probe and
   * the viewer's id are known. `undefined` means "we did not ask" — a public
   * page has no reason to. */
  readonly viewerIsOwner: boolean | undefined;
  /** The ordered specs table. */
  readonly features: readonly ListingFeatureView[];
  /** The `show_at_title` subset — what a heading appends. */
  readonly titleFeatures: readonly ListingFeatureView[];
  /** The `show_as_badge` subset — what a card shows. */
  readonly badgeFeatures: readonly ListingFeatureView[];
  /** Stored rows this build could not key. Reported, never rounded to zero. */
  readonly unreadableFeatures: number;
  /** Ordered CDN references. Resolving one to an image is the runtime's job
   * (`resolveImage`), because no contract in this fleet resolves a
   * stranger's reference — see `model/runtime.ts`. */
  readonly images: readonly string[];
  /**
   * What the heart must DRAW — the prediction while a toggle is in flight,
   * the row's own answer otherwise, and never `null`. See
   * {@link ListingDetailBag.favoriteKnown} for the fact `null` carried.
   */
  readonly isFavorited: boolean;
  /**
   * Whether the row is AUTHORITATIVE about the reader's saved state.
   * `is_favorited: null` is an anonymous read's "nobody asked", not a
   * `false`; both draw the outline heart, and only this tells them apart.
   */
  readonly favoriteKnown: boolean;
  /** Saving a favourite needs a mandate; the block says which of the four
   * reasons applies. */
  readonly favoriteGate: ActionAvailability;
  toggleFavorite(): void;
  readonly favoriteInFlight: boolean;
  /** The last favourite write's failure, for the surface to state. The heart
   * has already rolled back by the time this is set. */
  readonly favoriteError: unknown;
  /** Has this reader already opened this listing? See `model/engagement.ts`
   * — absent on every response today, and `false` when it is. */
  readonly isViewed: boolean;
  /** How many times it has been opened, or `undefined` where the server sent
   * no number. Never a zero standing in for an absence. */
  readonly viewCount: number | undefined;
  refetch(): void;
}

export interface UseListingDetailOptions {
  /** The reader's own id, when the host knows it — enables `viewerIsOwner`.
   * A uuid string, matching `ListingDetail.owner` / `ListingStatus.owner_id`. */
  readonly viewerId?: string;
  /**
   * The listing's category features, when the container has them — the same
   * `readonly FeatureDef[]` the composer takes, from
   * `@stapel/categories-react`'s `useCategoryFeatures`.
   *
   * A stored `select` carries its chosen VALUES and no option table, so a row
   * written before labels were snapshotted prints its storage slug (`b-u`)
   * where the category holds the copy. Handing the category's defs in repairs
   * that; handing nothing in leaves every rendered value exactly as it is
   * today. Which definition wins over which is `model/features.ts`' business —
   * this is only the wire it travels on.
   */
  readonly categoryFeatures?: readonly FeatureDef[];
}

export function useListingDetail(
  id: number,
  options: UseListingDetailOptions = {}
): ListingDetailBag {
  const detail = useListing(id);
  const probe = useListingStatus(id);
  const favorite = useFavoriteListing();
  const { gate: mandate, elevation } = useElevatableMandateGate(
    LISTINGS_ELEVATION_ACTIONS.favorite
  );

  const state: LoadState<ListingDetailData> =
    detail.status === "error"
      ? loadFailed(detail.error)
      : detail.data !== undefined
        ? loadReady(detail.data)
        : loadLoading();

  const statusState: LoadState<ListingStatusInfo> =
    probe.status === "error"
      ? loadFailed(probe.error)
      : probe.data !== undefined
        ? loadReady(probe.data)
        : loadLoading();

  const detailIs404 =
    detail.status === "error" && errorStatus(detail.error) === 404;
  const removed = detailIs404 && probe.data?.is_deleted === true;
  const notFound = detailIs404 && !removed && probe.status === "error";
  // The probe ANSWERED and did not say "deleted": the row exists and its
  // owner took it off the shelf. `!== true` and not `=== false`, because the
  // live probe body can carry `is_deleted` alone — a body missing the field
  // must still read as "not deleted", not fall through to the generic arm.
  const withdrawn =
    detailIs404 && !removed && probe.data !== undefined &&
    probe.data.is_deleted !== true;

  const status: ListingStatusView | undefined = useMemo(() => {
    if (detail.data !== undefined) {
      return listingStatusView(
        detail.data.status ?? "draft",
        detail.data.moderation_status ?? "pending"
      );
    }
    // The probe still knows both axes for a row the detail cannot return —
    // `moderation_status` arrives as a bare string there, so it is narrowed
    // by the same table rather than trusted.
    if (probe.data !== undefined) {
      const moderation = probe.data.moderation_status;
      return listingStatusView(
        probe.data.status,
        moderation === "approved" ||
          moderation === "rejected" ||
          moderation === "needs_review"
          ? moderation
          : "pending"
      );
    }
    return undefined;
  }, [detail.data, probe.data]);

  const owner = detail.data?.owner ?? probe.data?.owner_id;
  const viewerIsOwner =
    options.viewerId === undefined || owner === undefined
      ? undefined
      : owner === options.viewerId;

  // One object, rebuilt only when the defs themselves change, so the three
  // projections below keep their memo across renders that touched neither.
  const categoryFeatures = options.categoryFeatures;
  const copy: FeatureCopySource = useMemo(
    () => (categoryFeatures !== undefined ? { categoryFeatures } : {}),
    [categoryFeatures]
  );

  const features = useMemo(
    () => featuresFromDaoList(asFeatureDaoList(detail.data?.features), copy),
    [detail.data, copy]
  );
  const titleFeatures = useMemo(
    () => featuresFromDaoList(asFeatureDaoList(detail.data?.features_title), copy),
    [detail.data, copy]
  );
  const badgeFeatures = useMemo(
    () => featuresFromDaoList(asFeatureDaoList(detail.data?.features_badges), copy),
    [detail.data, copy]
  );

  // The row's own answer, and the third state it is allowed to be in: `null`
  // means the read was anonymous and nobody asked on this person's behalf.
  const rowFavorited = detail.data?.is_favorited ?? undefined;
  const [predicted, setPredicted] = useState<boolean | undefined>(undefined);

  const mintError = elevation.error;
  useEffect(() => {
    // A failed mint never reached the write, so no `onError` is coming to
    // retire the prediction — see `useFavoriteToggle` for the whole argument.
    if (mintError !== undefined && mintError !== null) setPredicted(undefined);
  }, [mintError]);

  const isFavorited = predicted ?? rowFavorited === true;
  // The detail refetch caught up; the prediction is now an opinion about the
  // past and must stop shadowing a row that may have changed for some other
  // reason.
  if (predicted !== undefined && rowFavorited === predicted) {
    setPredicted(undefined);
  }

  const favoriteGate = firstBlock(
    mandate,
    favorite.isPending || elevation.pending
      ? actionBlocked(LISTINGS_I18N_KEYS.blockedInFlight)
      : actionAvailable(),
    detail.data === undefined
      ? actionBlocked(LISTINGS_I18N_KEYS.detailLoading)
      : actionAvailable()
  );

  return {
    id,
    state,
    statusState,
    removed,
    notFound,
    withdrawn,
    status,
    publiclyVisible: status?.lifecycle.publiclyVisible ?? false,
    viewerIsOwner,
    features,
    titleFeatures,
    badgeFeatures,
    unreadableFeatures: unreadableFeatureCount(
      asFeatureDaoList(detail.data?.features)
    ),
    images: detail.data?.images ?? NO_IMAGES,
    isFavorited,
    favoriteKnown: rowFavorited === true || rowFavorited === false,
    favoriteGate,
    toggleFavorite: () => {
      if (!favoriteGate.available) return;
      const next = !isFavorited;
      const before = isFavorited;
      // The icon flips on the gesture; the invalidation below is what makes
      // it true, and the two callbacks are what make it honest if it is not.
      setPredicted(next);
      // Mints the anonymous account first where the host permits it for this
      // action; a direct call everywhere else.
      elevation.run(() => {
        favorite.mutate(
          { id, favorited: next },
          {
            onSuccess: (data) => {
              setPredicted(data.favorited ?? next);
            },
            onError: () => {
              setPredicted(before);
            },
          }
        );
      });
    },
    favoriteInFlight: favorite.isPending || elevation.pending,
    favoriteError: favorite.error ?? elevation.error,
    isViewed: isListingViewed(detail.data),
    viewCount: listingViewCount(detail.data),
    refetch: () => {
      void detail.refetch();
      void probe.refetch();
    },
  };
}

/** Renderless: the bag, handed to a render prop. Bring your own visuals, or
 * import `<ListingDetailPane>` from `./default`. */
export function ListingDetail(props: {
  id: number;
  viewerId?: string;
  /** See {@link UseListingDetailOptions.categoryFeatures}. */
  categoryFeatures?: readonly FeatureDef[];
  children: (bag: ListingDetailBag) => ReactNode;
}): ReactElement {
  const bag = useListingDetail(props.id, {
    ...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {}),
    ...(props.categoryFeatures !== undefined
      ? { categoryFeatures: props.categoryFeatures }
      : {}),
  });
  return <>{props.children(bag)}</>;
}
