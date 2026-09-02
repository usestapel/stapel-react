/**
 * The ENGAGEMENT OVERLAY as a scope: one request for a page of cards, read by
 * every card in it without a single extra prop.
 *
 * ── The problem this shape exists to solve ────────────────────────────────
 *
 * `viewed`, `view_count` and `is_favorited` are on stapel-listings' own card
 * and detail serializers, so a listing PAGE and this module's own card list
 * carry them and need nothing here. The two surfaces a buyer actually
 * scrolls do not: a storefront's home feed and its SERP are drawn by
 * `@stapel/search-react` from the search index, whose stored document can
 * hold neither a flag that differs per reader nor a counter that moves faster
 * than a re-index. Those rows reach `<ListingCard>` with no engagement fields
 * at all — so without this, every card on the two screens the feature was
 * built for renders undimmed with an outline heart no matter what the person
 * has done, and nothing anywhere reports a fault.
 *
 * ── Why a SCOPE and not a prop ────────────────────────────────────────────
 *
 * Because the cost is per PAGE and the reader is per CARD, and a design that
 * puts those in the same place gets one of them wrong. A `engagement` prop on
 * the card would make each card responsible for its own answer, and the
 * shortest way to satisfy that is one request per card — forty requests for a
 * decoration, which is the exact N+1 the batch endpoint exists to prevent.
 * The container knows the page; the card knows its id. So the container opens
 * a scope with the ids it just rendered, ONE query runs, and each card looks
 * itself up. It is the arrangement `GateReasonScopeContext` / `<PaneGate>`
 * already use in this fleet for the same shape of problem.
 *
 * ```tsx
 * <ListingEngagementScope ids={items.map((item) => item.id)}>
 *   <FeedGrid>
 *     {items.map((item) => <ListingFeedCard key={item.id} listing={item.card} … />)}
 *   </FeedGrid>
 * </ListingEngagementScope>
 * ```
 *
 * ── No scope is a first-class answer ──────────────────────────────────────
 *
 * A card outside a scope fires NOTHING and draws from its row exactly as it
 * did before this module existed — which is right for this module's own card
 * list and for the listing page, whose rows already carry the fields. Absent,
 * empty, in-flight and FAILED are all the same silent no-op: no dimming, no
 * count, no banner over a grid that is otherwise working. A grid that renders
 * is worth more than a flag.
 */
import { createContext, useContext, useMemo } from "react";
import type { Context, ReactElement, ReactNode } from "react";
import { loadFailed, loadLoading, loadReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type {
  ListingCard,
  ListingEngagement,
  ListingEngagementBatch,
} from "../api/types.js";
import { engagementIds } from "../api/types.js";
import { useListingEngagement } from "../model/queries.js";
import { engagementFor, withEngagement } from "../model/engagement.js";

/** What the scope publishes: the batch, however it is doing. */
export interface ListingEngagementBag {
  /** This listing's entry, or `undefined` for an id the answer did not carry
   * — which includes "the read has not landed" and "the read failed". */
  overlayFor(id: number): ListingEngagement | undefined;
  /** The read's own state, for a host that wants to know. NOTHING in this
   * pair renders the failed arm: see the file header. */
  readonly state: LoadState<ListingEngagementBatch>;
  /** The normalized ids actually asked for — after the sort, the de-dupe and
   * the server's own cap. A caller can compare it with what it handed in to
   * see that a hundred-and-forty-card page was truncated. */
  readonly ids: readonly number[];
}

const NO_OVERLAY: ListingEngagementBag = {
  overlayFor: () => undefined,
  state: loadLoading(),
  ids: [],
};

/**
 * The scope. `null` outside a provider — and `null` is not an error, it is a
 * container that never opted in.
 */
export const ListingEngagementContext: Context<ListingEngagementBag | null> =
  createContext<ListingEngagementBag | null>(null);

export interface UseListingEngagementOverlayOptions {
  /** Hold the request (a grid that has not resolved its rows yet). */
  readonly enabled?: boolean;
}

/**
 * Run the batch read for a page of ids and get the bag back.
 *
 * The headless half: a host rendering its own visuals over its own grid calls
 * this directly. A host using this pair's cards wraps them in
 * {@link ListingEngagementScope} instead, which calls this once and puts the
 * bag where the cards can find it.
 */
export function useListingEngagementOverlay(
  ids: readonly number[],
  options: UseListingEngagementOverlayOptions = {}
): ListingEngagementBag {
  const query = useListingEngagement(
    ids,
    options.enabled !== undefined ? { enabled: options.enabled } : {}
  );
  const wanted = useMemo(() => engagementIds(ids), [ids]);
  const batch = query.data;
  return useMemo(
    () => ({
      overlayFor: (id: number) => engagementFor(batch, id),
      state:
        query.status === "error"
          ? loadFailed(query.error)
          : batch !== undefined
            ? loadReady(batch)
            : loadLoading(),
      ids: wanted,
    }),
    [batch, query.status, query.error, wanted]
  );
}

export interface ListingEngagementScopeProps
  extends UseListingEngagementOverlayOptions {
  /** The listing ids on this page — normalized before the request, so the
   * caller may hand them in any order and need not de-duplicate. */
  readonly ids: readonly number[];
  readonly children: ReactNode;
}

/**
 * One request for the page, one lookup for every card inside it.
 *
 * Renderless: it draws no element of its own, so it can be wrapped around a
 * grid without entering its layout.
 */
export function ListingEngagementScope(
  props: ListingEngagementScopeProps
): ReactElement {
  const bag = useListingEngagementOverlay(
    props.ids,
    props.enabled !== undefined ? { enabled: props.enabled } : {}
  );
  return (
    <ListingEngagementContext.Provider value={bag}>
      {props.children}
    </ListingEngagementContext.Provider>
  );
}

/** The scope's bag, or a permanently-empty one outside a scope. Never throws:
 * a card must render everywhere, wired or not. */
export function useListingEngagementScope(): ListingEngagementBag {
  return useContext(ListingEngagementContext) ?? NO_OVERLAY;
}

/** One listing's overlay entry, or `undefined`. */
export function useEngagementOverlay(
  id: number
): ListingEngagement | undefined {
  return useListingEngagementScope().overlayFor(id);
}

/**
 * A row with the scope's answer laid over it — what every card in this pair
 * actually reads.
 *
 * Outside a scope, or for an id the batch did not carry, this returns the
 * SAME object it was given, so a card that never opted in re-renders exactly
 * as often as it used to.
 */
export function useEngagedListing(row: ListingCard): ListingCard {
  const overlay = useEngagementOverlay(row.id);
  return useMemo(() => withEngagement(row, overlay), [row, overlay]);
}
