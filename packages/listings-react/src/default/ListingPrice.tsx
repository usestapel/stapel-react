/**
 * `<ListingPrice>` — the asking price, formatted as money.
 *
 * ── The defect this closes ─────────────────────────────────────────────────
 *
 * Every price on this pair's screens was `` `${price} ${currency}` `` —
 * `4500.00 RUB`. An ISO code where a glyph belongs, no thousands grouping, a
 * forced `.00` on a whole number, and the same string in `ru` and `es` as in
 * `en`. `@stapel/currencies-react` exists precisely so no pair spells that
 * template literal again: `formatMoney` is `Intl.NumberFormat` over a decimal
 * STRING (never a `number` — `4500.10` is not a float), per locale and per the
 * currency's own minor units.
 *
 * ── Two branches, because the catalogue is optional ────────────────────────
 *
 * A deployment that mounted `<CurrenciesProvider>` has the catalogue, so the
 * price gets the currency's real glyph even where the locale carries none
 * (`en` has no `₽`) and the formatting is the one the rest of that host's
 * money uses. A host that did not mount it still gets a properly formatted,
 * properly localized number through the pure `formatMoney` — the pair does not
 * require a second module to render a price, and it does not silently fall
 * back to the template literal either.
 *
 * The branch is decided by a context READ, and each arm is its own component,
 * so no hook is called conditionally. `@stapel/currencies-react` is an
 * OPTIONAL peer for exactly this reason: absent, only the plain arm ever
 * mounts.
 */
import { useContext } from "react";
import type { ReactElement } from "react";
import { useI18n, useT } from "@stapel/core";
import {
  CurrenciesRuntimeContext,
  formatMoney,
  useMoney,
} from "@stapel/currencies-react";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";

export interface ListingPriceProps {
  /**
   * The amount as the wire spells it — a decimal string, or `null` for a
   * listing that carries no price at all.
   *
   * `null` is in the TYPE since stapel-listings 0.17 spelled it in the
   * schema (`price?: string | null`, D51: a blank price stays null
   * server-side). It was always in the DATA — `hasAmount` below has guarded
   * for it from the start, with a comment saying the serializer hands it
   * through an unguarded `string | undefined`. Now the type says what the
   * runtime already knew, and the guard stops being a defence against its
   * own signature.
   */
  readonly amount: string | null | undefined;
  /** The code the amount is quoted in (`Listing.currency`). */
  readonly currency?: string | undefined;
}

/** Is there a price at all? A listing may carry none, and "no price" is a
 * sentence, not a zero. The wire spells absence as `null` (a blank price
 * stays null server-side — D51), and a serializer may hand that through the
 * `string | undefined` type unguarded, so the check is a type test rather
 * than a `.length` on whatever arrived. */
function hasAmount(props: ListingPriceProps): boolean {
  return typeof props.amount === "string" && props.amount.length > 0;
}

function PlainPrice(props: ListingPriceProps): ReactElement {
  const { locale } = useI18n();
  return (
    <>
      {formatMoney(props.amount ?? "", (props.currency ?? "").toUpperCase(), {
        locale,
      })}
    </>
  );
}

function CataloguePrice(props: ListingPriceProps): ReactElement {
  const money = useMoney();
  return <>{money.format(props.amount ?? "", (props.currency ?? "").toUpperCase())}</>;
}

/**
 * The price as text — the caller owns the typography, so one component serves
 * the card's strong line and the detail page's display heading.
 */
export function ListingPrice(props: ListingPriceProps): ReactElement {
  const t = useT();
  const wired = useContext(CurrenciesRuntimeContext) !== null;
  if (!hasAmount(props)) return <>{t(LISTINGS_I18N_KEYS.cardPriceAbsent)}</>;
  return wired ? <CataloguePrice {...props} /> : <PlainPrice {...props} />;
}
