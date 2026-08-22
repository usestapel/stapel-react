import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  loadFailed,
  loadLoading,
  loadReady,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { ListingCard, ListingPageParams } from "../api/types.js";
import { useMyFavorites } from "../model/queries.js";
import { useFavoriteListing } from "../model/mutations.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { useMandateGate } from "./useMandateGate.js";

/**
 * Saving something for later — first-class in stapel-listings (a `Favorite`
 * model, three endpoints) and therefore first-class here (owner verdict F7).
 *
 * Two surfaces over one contract: {@link useFavoriteToggle} is the heart on a
 * card, {@link useFavorites} is the page listing what was saved.
 */

export interface FavoriteToggleBag {
  readonly favorited: boolean;
  /** Blocked with the reason for a visitor, a guest, an unknown mandate, or
   * while the previous toggle is still in flight. Never a hidden heart: a
   * control that disappears for a visitor teaches them nothing, and the CTA
   * to sign in is the whole point of showing it (spec §6.2 item 6). */
  readonly gate: ActionAvailability;
  toggle(): void;
  readonly inFlight: boolean;
  readonly error: unknown;
}

/**
 * The heart on one card.
 *
 * `favorited` is the caller's — `ListingCard.is_favorited` comes down with
 * every card, so a grid needs no extra read. It is `null` for an anonymous
 * reader (`with_favorited` annotates `Value(None)`), which is a THIRD state
 * and not `false`: "we did not ask" versus "not saved". The gate is what
 * renders it, so the distinction never has to be squeezed into the boolean.
 */
export function useFavoriteToggle(
  id: number,
  favorited: boolean | null | undefined
): FavoriteToggleBag {
  const mandate = useMandateGate();
  const mutation = useFavoriteListing();
  const gate = firstBlock(
    mandate,
    mutation.isPending
      ? actionBlocked(LISTINGS_I18N_KEYS.blockedInFlight)
      : actionAvailable()
  );
  return {
    favorited: favorited === true,
    gate,
    toggle: () => {
      if (!gate.available) return;
      mutation.mutate({ id, favorited: favorited !== true });
    },
    inFlight: mutation.isPending,
    error: mutation.error,
  };
}

export interface FavoritesBag {
  readonly rows: LoadState<readonly ListingCard[]>;
  readonly page: ListingPageParams;
  readonly nextPage: ActionAvailability;
  readonly prevPage: ActionAvailability;
  goNext(): void;
  goPrev(): void;
  readonly gate: ActionAvailability;
  refetch(): void;
}

export interface UseFavoritesOptions {
  readonly limit?: number;
}

/** The favourites page: a real keyset list, unlike the owner's own listings
 * (see `MyListings.tsx` for why those are different). */
export function useFavorites(options: UseFavoritesOptions = {}): FavoritesBag {
  const gate = useMandateGate();
  const [page, setPage] = useState<ListingPageParams>(
    options.limit !== undefined ? { limit: options.limit } : {}
  );
  const query = useMyFavorites(page, { enabled: gate.available });
  const envelope = query.data;

  return {
    rows:
      query.status === "error"
        ? loadFailed(query.error)
        : envelope !== undefined
          ? loadReady(envelope.items)
          : loadLoading(),
    page,
    nextPage:
      envelope?.has_next === true && envelope.next_anchor != null
        ? actionAvailable()
        : actionBlocked(LISTINGS_I18N_KEYS.pageNext),
    prevPage:
      envelope?.has_prev === true && envelope.prev_anchor != null
        ? actionAvailable()
        : actionBlocked(LISTINGS_I18N_KEYS.pagePrev),
    goNext: () => {
      const anchor = envelope?.next_anchor;
      if (anchor == null) return;
      setPage((current) => ({ ...current, anchor, direction: "next" }));
    },
    goPrev: () => {
      const anchor = envelope?.prev_anchor;
      if (anchor == null) return;
      setPage((current) => ({ ...current, anchor, direction: "prev" }));
    },
    gate,
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Renderless: the bag, handed to a render prop. */
export function Favorites(
  props: UseFavoritesOptions & {
    children: (bag: FavoritesBag) => ReactNode;
  }
): ReactElement {
  const bag = useFavorites(props);
  return <>{props.children(bag)}</>;
}
