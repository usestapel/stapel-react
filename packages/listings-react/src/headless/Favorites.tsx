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
import {
  LISTINGS_ELEVATION_ACTIONS,
  useElevatableMandateGate,
} from "./useMandateGate.js";

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
  const { gate: mandate, elevation } = useElevatableMandateGate(
    LISTINGS_ELEVATION_ACTIONS.favorite
  );
  const mutation = useFavoriteListing();
  const gate = firstBlock(
    mandate,
    mutation.isPending || elevation.pending
      ? actionBlocked(LISTINGS_I18N_KEYS.blockedInFlight)
      : actionAvailable()
  );
  return {
    favorited: favorited === true,
    gate,
    // On a host with auto-anonymous wired, the first heart an anonymous
    // visitor presses mints their account and then saves — one press, no
    // form, nothing said about it. Everywhere else `run` performs directly.
    toggle: () => {
      if (!gate.available) return;
      elevation.run(() => mutation.mutate({ id, favorited: favorited !== true }));
    },
    inFlight: mutation.isPending || elevation.pending,
    error: mutation.error ?? elevation.error,
  };
}

export interface FavoritesBag {
  readonly rows: LoadState<readonly ListingCard[]>;
  readonly page: ListingPageParams;
  /**
   * Which page is on screen, 1-based. Keyset paging has no offset to read a
   * number off, so it is counted: a pager with no indicator leaves a person
   * unable to tell a second page from a reloaded first one.
   */
  readonly pageNumber: number;
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
  // The READ side of elevation, and the one place `identified` is the right
  // question. A guest who saved listings must be able to come back and see
  // them — an account that can save and cannot re-read is worse than the
  // refusal it replaced — but a visitor who has never elevated has nothing
  // here, so this page must not mint just to render. `covers` alone would
  // open it for them and buy a 401.
  const { gate: mandateGate, elevation } = useElevatableMandateGate(
    LISTINGS_ELEVATION_ACTIONS.favorite
  );
  const gate = elevation.covers && !elevation.identified
    ? actionBlocked(LISTINGS_I18N_KEYS.blockedSignIn)
    : mandateGate;
  const [page, setPage] = useState<ListingPageParams>(
    options.limit !== undefined ? { limit: options.limit } : {}
  );
  const [pageNumber, setPageNumber] = useState(1);
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
    pageNumber,
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
      setPageNumber((current) => current + 1);
    },
    goPrev: () => {
      const anchor = envelope?.prev_anchor;
      if (anchor == null) return;
      setPage((current) => ({ ...current, anchor, direction: "prev" }));
      setPageNumber((current) => Math.max(1, current - 1));
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
