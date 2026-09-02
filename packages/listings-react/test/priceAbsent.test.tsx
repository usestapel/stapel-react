/**
 * A missing price is a SENTENCE, never a zero (D51/D60, walkers P4/P2).
 *
 * The server now keeps a null price null (the ghost «0 ₽» card came from a
 * blank price publishing as zero), so the wire hands the card `price: null`
 * — and the card must say "no price" honestly:
 *
 *  - `undefined` and `null` and `""` all read as "no price at all"
 *    (`null` used to throw: `.length` on a null the DTO type did not admit);
 *  - the absent-price line comes from the catalogue
 *    (`listings.card.price_absent`), so the storefront's locale owns the
 *    words.
 */
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingPrice } from "../src/default/ListingPrice.js";
import { LISTINGS_I18N_KEYS, listingsI18nBundleEn } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";

/** The catalogue's own sentence — asserted through the key, so the copy can
 * be reworded without this test having an opinion about the words. */
const ABSENT: string = listingsI18nBundleEn[
  LISTINGS_I18N_KEYS.cardPriceAbsent
] as string;

function wrap(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

describe("<ListingPrice> — absence is a sentence", () => {
  it("renders the absent-price line for undefined", () => {
    render(wrap(<div data-testid="p"><ListingPrice amount={undefined} currency="RUB" /></div>));
    expect(screen.getByTestId("p").textContent).toBe(ABSENT);
  });

  it("renders the absent-price line for a null off the wire — and does not throw", () => {
    render(
      wrap(
        <div data-testid="p">
          <ListingPrice amount={null as unknown as string} currency="RUB" />
        </div>
      )
    );
    expect(screen.getByTestId("p").textContent).toBe(ABSENT);
  });

  it("renders the absent-price line for an empty string", () => {
    render(wrap(<div data-testid="p"><ListingPrice amount="" currency="RUB" /></div>));
    expect(screen.getByTestId("p").textContent).toBe(ABSENT);
  });

  it("still formats a real amount as money", () => {
    render(wrap(<div data-testid="p"><ListingPrice amount="4500.00" currency="RUB" /></div>));
    expect(screen.getByTestId("p").textContent).not.toBe(ABSENT);
    expect(screen.getByTestId("p").textContent).toContain("4");
  });
});
