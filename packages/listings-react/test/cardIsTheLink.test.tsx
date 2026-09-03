/**
 * The card IS the link — owner ruling 2026-08-28, from the live stand.
 *
 * The card used to carry a separate captioned "Open" control under its own
 * content, so a person looking at a photo, a price and a title had to find and
 * press a fourth thing to act on the three they were reading. Nothing on a
 * classified works that way.
 *
 * Four claims, each of which a rewrite could quietly lose:
 *
 *  1. everything a person READS — price, title, place — is inside ONE anchor,
 *     and the PICTURE opens the same listing. The photo STRIP is still a
 *     sibling of the reading anchor (a swipeable scroller is a control and a
 *     link may not contain one), but each slide carries its own link: the
 *     267x200 photograph was measured as the one place on a card where a
 *     click did nothing at all. The slide links are `aria-hidden` +
 *     `tabIndex={-1}`, so the card stays ONE tab stop with ONE accessible
 *     name — a second way to reach a destination, not a second destination;
 *  2. it is a REAL `<a href>`, so middle-click, ⌘-click, "copy link address"
 *     and a crawler all still work. An `onClick` on a div has none of that,
 *     and is the shape a "make the card clickable" rewrite reaches for first;
 *  3. its accessible name is the TITLE alone — not a paragraph made of every
 *     text node on the card, which is what a list of forty would announce;
 *  4. the heart is OUTSIDE the anchor (a button inside a link is neither valid
 *     nor operable) and is the only separate control left.
 *
 * Plus the projection reality: a SEARCH hit carries title, price, currency,
 * location and an image and NOTHING else — no feature badges, and
 * `is_favorited: null`. The card has to look deliberate with all of that
 * missing, so the last group renders exactly that row.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen, within } from "@testing-library/react";
import type { LinkComponent } from "@stapel/core";
import { ListingCard } from "../src/default/index.js";
import { CARD_HOVER_CLASS, cardTargetCss } from "../src/default/ListingCard.js";
import type { ListingCard as ListingCardData } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function providers(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

/** A container's router adapter — the one line a host writes. */
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

/**
 * What the SEARCH projection actually carries: title, price, currency,
 * location, an image — and NO feature badges, with `is_favorited: null`
 * (a search hit never says whether you saved it).
 */
const SEARCH_HIT: ListingCardData = {
  ...CARD,
  features_title: [],
  features_badges: [],
  is_favorited: null,
};

describe("the whole card is one target", () => {
  it("puts the price, the title and the place INSIDE the anchor", () => {
    render(providers(<ListingCard listing={CARD} href="/l/7" />));
    const target = screen.getByTestId("listings-card-open");
    expect(target.tagName).toBe("A");
    const inside = within(target);
    expect(inside.getByTestId("listings-card-price")).toBeTruthy();
    expect(inside.getByTestId("listings-card-title")).toBeTruthy();
    expect(inside.getByTestId("listings-card-location")).toBeTruthy();
  });

  it("keeps the photo STRIP outside it — a link may not contain a control", () => {
    render(providers(<ListingCard listing={CARD} href="/l/7" />));
    const target = screen.getByTestId("listings-card-open");
    const strip = screen.getByTestId("listings-card-photos");
    // The photo used to be inside the anchor, on the argument that a still
    // `<img>` in a link is just a bigger link. That is true, and it stops
    // being true the moment there is more than one photo: `<SkinCarousel>` is
    // a scroll container with its own tab stop, and a horizontal swipe that
    // ends inside an `<a>` is a swipe the browser may deliver as a click — so
    // every attempt to look at photo two opened the listing. Measured on the
    // live desktop SERP: one photo per card, no carousel, image inside the
    // link, while the phone card (strip outside) worked.
    expect(target.contains(strip)).toBe(false);
    expect(strip.contains(target)).toBe(false);
    // The anchor still covers everything a person READS, which is the whole
    // of the "the card is the link" ruling that survives.
    const reading = within(target);
    expect(reading.getByTestId("listings-card-price")).toBeTruthy();
    expect(reading.getByTestId("listings-card-title")).toBeTruthy();
    expect(reading.getByTestId("listings-card-location")).toBeTruthy();
  });

  it("draws no separate captioned control any more", () => {
    render(providers(<ListingCard listing={CARD} href="/l/7" />));
    // The retired key: `listings.card.open` is gone from the keys and from
    // all three catalogues, so nothing can render it by accident.
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open" })).toBeNull();
  });

  it("stays a real anchor: every href is the listing's, and no div pretends to be a link", () => {
    const { container } = render(
      providers(<ListingCard listing={CARD} href="/l/7" />)
    );
    const anchors = [...container.querySelectorAll("a[href]")];
    expect(anchors.length).toBeGreaterThan(0);
    // Every anchor on the card leads to the SAME listing. A card that grew a
    // second destination would be a card a person cannot predict.
    for (const a of anchors) expect(a.getAttribute("href")).toBe("/l/7");
    // Nothing else on the card claims to be a link.
    expect(container.querySelectorAll('[role="link"]')).toHaveLength(0);
  });

  it("THE PICTURE IS PART OF THE TARGET — and costs no extra tab stop or name", () => {
    // Measured on a live 1440px grid before this existed: the 267x200 photo
    // sat outside the anchor, `cursor: auto`, and clicking it left the visitor
    // exactly where they were. It is the largest and most obvious target on
    // the card.
    const { container } = render(
      providers(<ListingCard listing={CARD} href="/l/7" />)
    );
    // The slide, not the `<img>`: with no resolver wired this harness draws
    // the designed "no photo" box instead of a picture, and the claim is
    // about the SLIDE being part of the target either way.
    const photoAnchor = container.querySelector(
      '[data-testid="listings-photo-link"]'
    );
    expect(photoAnchor).not.toBeNull();
    expect(photoAnchor?.getAttribute("href")).toBe("/l/7");
    // Whatever the slide draws — a resolved picture, or the designed "no
    // photo" box this harness gets with no resolver wired — is INSIDE it.
    expect(photoAnchor?.firstElementChild).not.toBeNull();

    // …and it is INVISIBLE to the keyboard and to a screen reader, because
    // the reading anchor beside it already announces this listing once.
    expect(photoAnchor?.getAttribute("tabindex")).toBe("-1");
    expect(photoAnchor?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("the card LOOKS like a target: a hover rule, and one that respects reduced motion", () => {
    // `box-shadow: none`, `transform: none`, border unchanged, `cursor: auto`
    // — the measured resting AND hovered state of a card that opens a listing.
    const css = cardTargetCss();
    expect(css).toContain(`.${CARD_HOVER_CLASS}:hover`);
    expect(css).toContain("box-shadow:var(--listing-card-hover-shadow)");
    expect(css).toContain("border-color:var(--listing-card-focus)");
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");

    const { container } = render(
      providers(<ListingCard listing={CARD} href="/l/7" />)
    );
    expect(
      container.querySelector(`.${CARD_HOVER_CLASS}`)
    ).not.toBeNull();
  });

  it("hands the anchor to the host's router component when there is one", () => {
    render(
      providers(
        <ListingCard listing={CARD} href="/l/7" linkComponent={RouterLink} />
      )
    );
    const target = screen.getByTestId("listings-card-open");
    expect(target.getAttribute("href")).toBe("/l/7");
    expect(within(target).getByTestId("listings-card-title")).toBeTruthy();
  });

  it("wraps the same content in a button on the callback arm", () => {
    const onOpen = vi.fn();
    const { container } = render(
      providers(<ListingCard listing={CARD} onOpen={onOpen} />)
    );
    const target = screen.getByTestId("listings-card-open");
    expect(target.tagName).toBe("BUTTON");
    // No href for the browser to follow after the handler has already routed.
    expect(container.querySelectorAll("a[href]")).toHaveLength(0);
    expect(within(target).getByTestId("listings-card-title")).toBeTruthy();
    target.click();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("is a plain card, no target at all, where nothing opens", () => {
    const { container } = render(providers(<ListingCard listing={CARD} />));
    expect(screen.queryByTestId("listings-card-open")).toBeNull();
    expect(container.querySelectorAll("a[href]")).toHaveLength(0);
    // Still a card: the price and the title are there to be read.
    expect(screen.getByTestId("listings-card-price")).toBeTruthy();
  });
});

describe("the accessible name is the title, and only the title", () => {
  it("names the link with the listing's title", () => {
    render(providers(<ListingCard listing={CARD} href="/l/7" />));
    const link = screen.getByRole("link", { name: "Bosch GSB 1200" });
    expect(link.getAttribute("href")).toBe("/l/7");
    // NOT a concatenation of every text node: the price, the badge and the
    // place are inside the anchor and must not be in its NAME.
    expect(link.getAttribute("aria-label")).toBe("Bosch GSB 1200");
  });

  it("falls back to a name rather than announcing nothing", () => {
    render(
      providers(
        <ListingCard listing={{ ...CARD, title: "" }} href="/l/7" />
      )
    );
    expect(screen.getByRole("link", { name: "Untitled listing" })).toBeTruthy();
  });

  it("names the callback arm the same way", () => {
    render(providers(<ListingCard listing={CARD} onOpen={() => undefined} />));
    expect(screen.getByRole("button", { name: "Bosch GSB 1200" })).toBeTruthy();
  });
});

describe("the heart is the only separate control, and it is outside the link", () => {
  it("keeps the favourite button out of the anchor", () => {
    render(providers(<ListingCard listing={CARD} href="/l/7" />));
    const heart = screen.getByTestId("listings-card-favorite");
    const target = screen.getByTestId("listings-card-open");
    // A <button> inside an <a> is neither valid HTML nor operable.
    expect(target.contains(heart)).toBe(false);
    expect(heart.getAttribute("aria-pressed")).toBe("false");
  });

  it("still states its refusal as text when a visitor cannot favourite", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard listing={CARD} href="/l/7" signIn={{ href: "/login" }} />
      </TestProviders>
    );
    const heart = screen.getByTestId("listings-card-favorite");
    // `aria-disabled`, not the html attribute — an inert control cannot be
    // tapped and therefore cannot disclose why it refused.
    expect(heart.getAttribute("aria-disabled")).toBe("true");
    expect(heart).toHaveProperty("disabled", false);
    // The reason is on screen and wired to the control — the whole reason the
    // heart is a row under the card rather than a glyph on the photograph.
    expect(heart.getAttribute("aria-describedby")).toBeTruthy();
    const blocked = screen.getByTestId("listings-card-favorite-blocked");
    expect(blocked.textContent?.length).toBeGreaterThan(0);
    // And it is outside the anchor with it, so the link's name stays the title.
    expect(screen.getByTestId("listings-card-open").contains(blocked)).toBe(false);
  });

  it("leaves the card a pure link when the favourite is switched off", () => {
    render(
      providers(<ListingCard listing={CARD} href="/l/7" showFavorite={false} />)
    );
    expect(screen.queryByTestId("listings-card-favorite")).toBeNull();
    expect(screen.getByTestId("listings-card-open")).toBeTruthy();
  });
});

describe("a search hit carries almost nothing, and the card still reads", () => {
  it("renders the five fields the projection has and nothing hollow", () => {
    render(providers(<ListingCard listing={SEARCH_HIT} href="/l/7" />));
    const target = within(screen.getByTestId("listings-card-open"));
    expect(target.getByTestId("listings-card-price")).toBeTruthy();
    expect(target.getByTestId("listings-card-title").textContent).toBe(
      "Bosch GSB 1200"
    );
    expect(target.getByTestId("listings-card-location").textContent).toBe("Kazan");
    // No badge row at all rather than an empty one: the search projection
    // carries no `features_badges`, and a card that only reads well WITH them
    // would read badly on every result page.
    expect(screen.queryByTestId("listings-card-badges")).toBeNull();
  });

  it("shows no location line when the hit has no place", () => {
    render(
      providers(
        <ListingCard listing={{ ...SEARCH_HIT, location_label: "" }} href="/l/7" />
      )
    );
    expect(screen.queryByTestId("listings-card-location")).toBeNull();
    expect(screen.getByTestId("listings-card-title")).toBeTruthy();
  });
});
