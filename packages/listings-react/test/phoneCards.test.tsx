/**
 * The two phone card surfaces of the mobile wave.
 *
 * What is worth asserting is the set of decisions a rewrite would quietly
 * lose:
 *
 *  1. the SERP card's photo strip is a `SkinCarousel` and it is OUTSIDE the
 *     anchor — a swipe that ends inside an `<a>` is a swipe the browser may
 *     deliver as a navigation, which is the defect that makes a phone gallery
 *     unusable;
 *  2. the price is the FIRST thing in the anchor and the title comes after it
 *     — the ref's order, and the reverse of the grid card's;
 *  3. `priceTrend` is a seam, so it renders nothing at all when absent and a
 *     labelled arrow plus a struck previous price when present;
 *  4. the heart is outside the anchor on both cards, and blocked-with-a-reason
 *     for a visitor, exactly as `<ListingCard>` is;
 *  5. `<FeedGrid>` lays out two columns by default and takes a number.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen, within } from "@testing-library/react";
import {
  FeedGrid,
  ListingFeedCard,
  ListingSerpCard,
} from "../src/default/index.js";
import { FEED_TITLE_CLASS, feedCardCss } from "../src/default/ListingFeedCard.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function providers(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

const THREE_PHOTOS = {
  ...CARD,
  images: ["image/one", "image/two", "image/three"],
};

describe("<ListingSerpCard> — the photo strip is a strip, and it is not in the link", () => {
  it("renders one carousel slide per photo", () => {
    render(providers(<ListingSerpCard listing={THREE_PHOTOS} href="/l/7" />));
    const strip = screen.getByTestId("listings-serp-photos");
    expect(strip.getAttribute("data-stapel-carousel-slides")).toBe("3");
    expect(strip.querySelectorAll("[data-stapel-carousel-slide]")).toHaveLength(3);
  });

  it("keeps the strip OUT of the anchor", () => {
    render(providers(<ListingSerpCard listing={THREE_PHOTOS} href="/l/7" />));
    const target = screen.getByTestId("listings-serp-open");
    const strip = screen.getByTestId("listings-serp-photos");
    expect(target.contains(strip)).toBe(false);
    // And it is still a real anchor with the title as its name.
    expect(target.tagName).toBe("A");
    expect(target.getAttribute("aria-label")).toBe("Bosch GSB 1200");
  });

  it("drops the peek and the dots for a single photo", () => {
    render(providers(<ListingSerpCard listing={CARD} href="/l/7" />));
    const strip = screen.getByTestId("listings-serp-photos");
    expect(strip.getAttribute("data-stapel-carousel-peek")).toBe("0px");
    expect(strip.querySelector("[data-stapel-carousel-dots]")).toBeNull();
  });

  it("still draws one slide for a listing with no photos at all", () => {
    render(
      providers(<ListingSerpCard listing={{ ...CARD, images: [] }} href="/l/7" />)
    );
    const strip = screen.getByTestId("listings-serp-photos");
    expect(strip.querySelectorAll("[data-stapel-carousel-slide]")).toHaveLength(1);
    expect(screen.getByTestId("listings-photo-absent")).toBeTruthy();
  });
});

describe("<ListingSerpCard> — price first", () => {
  it("puts the price before the title inside the anchor", () => {
    render(providers(<ListingSerpCard listing={CARD} href="/l/7" />));
    const target = screen.getByTestId("listings-serp-open");
    const price = within(target).getByTestId("listings-serp-price");
    const title = within(target).getByTestId("listings-serp-title");
    // DOCUMENT_POSITION_FOLLOWING: the title comes after the price.
    expect(price.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeGreaterThan(0);
  });

  it("draws no trend at all when the projection carries none", () => {
    render(providers(<ListingSerpCard listing={CARD} href="/l/7" />));
    expect(screen.queryByTestId("listings-serp-old-price")).toBeNull();
    expect(screen.queryByRole("img", { name: "The price went down" })).toBeNull();
  });

  it("draws the arrow and the struck previous price when it does", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          priceTrend={{ oldPrice: "5900.00", direction: "down" }}
        />
      )
    );
    // The arrow is NAMED — a glyph that carries the whole message must not be
    // aria-hidden.
    expect(screen.getByRole("img", { name: "The price went down" })).toBeTruthy();
    const was = screen.getByTestId("listings-serp-old-price");
    expect(was.textContent).toContain("Was");
    expect(was.querySelector("del")).not.toBeNull();
  });

  it("names the arrow the other way up", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          priceTrend={{ oldPrice: "3900.00", direction: "up" }}
        />
      )
    );
    expect(screen.getByRole("img", { name: "The price went up" })).toBeTruthy();
  });
});

describe("<ListingSerpCard> — the slots and the rail", () => {
  it("renders the host's spec line, seller and rail", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          specsLine="Petrol 1.5, robot"
          sellerSlot={<span data-testid="host-seller">Anna</span>}
          actionsRail={<button type="button" data-testid="host-chat">Write</button>}
        />
      )
    );
    expect(screen.getByTestId("listings-serp-specs").textContent).toBe(
      "Petrol 1.5, robot"
    );
    const target = screen.getByTestId("listings-serp-open");
    // The seller line is outside the anchor: it usually holds its own link.
    expect(target.contains(screen.getByTestId("host-seller"))).toBe(false);
    expect(
      screen.getByTestId("listings-serp-actions").contains(
        screen.getByTestId("host-chat")
      )
    ).toBe(true);
  });

  it("keeps the heart outside the anchor and inside the rail", () => {
    render(providers(<ListingSerpCard listing={CARD} href="/l/7" />));
    const heart = screen.getByTestId("listings-serp-favorite");
    expect(screen.getByTestId("listings-serp-open").contains(heart)).toBe(false);
    expect(screen.getByTestId("listings-serp-actions").contains(heart)).toBe(true);
    expect(heart.getAttribute("aria-pressed")).toBe("false");
  });

  it("blocks the heart for a visitor and states the reason as text", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingSerpCard listing={CARD} href="/l/7" />
      </TestProviders>
    );
    const heart = screen.getByTestId("listings-serp-favorite");
    expect(heart.getAttribute("aria-disabled")).toBe("true");
    expect(heart).toHaveProperty("disabled", false);
    expect(heart.getAttribute("aria-describedby")).toBeTruthy();
    const gate = screen.getByTestId("listings-serp-favorite-gate");
    expect(gate.getAttribute("data-stapel-gated")).toBe("blocked");
    expect(gate.querySelector("[data-stapel-gated-reason]")?.textContent?.length)
      .toBeGreaterThan(0);
  });

  it("opens by callback with no href for the browser to follow after", () => {
    const onOpen = vi.fn();
    const { container } = render(
      providers(<ListingSerpCard listing={CARD} onOpen={onOpen} />)
    );
    const target = screen.getByTestId("listings-serp-open");
    expect(target.tagName).toBe("BUTTON");
    expect(container.querySelectorAll("a[href]")).toHaveLength(0);
    target.click();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(7);
  });
});

describe("<ListingFeedCard> — borderless, photo-led, heart over the corner", () => {
  it("puts the photo, the title, the price and the place in one anchor", () => {
    render(providers(<ListingFeedCard listing={CARD} href="/l/7" />));
    const target = screen.getByTestId("listings-feed-open");
    expect(target.tagName).toBe("A");
    const inside = within(target);
    expect(inside.getByTestId("listings-feed-title")).toBeTruthy();
    expect(inside.getByTestId("listings-feed-price")).toBeTruthy();
    expect(inside.getByTestId("listings-feed-location")).toBeTruthy();
    // Either the resolved photo or the designed placeholder — this harness
    // mounts no resolver, and both are the photo box.
    expect(
      target.querySelector(
        "[data-testid='listings-photo'], [data-testid='listings-photo-absent']"
      )
    ).not.toBeNull();
  });

  it("clamps the title to two lines", () => {
    render(providers(<ListingFeedCard listing={CARD} href="/l/7" />));
    // The clamp is a CSS RULE, not an inline style: `-webkit-line-clamp` and
    // `-webkit-box-orient` are dropped silently by every style serializer
    // outside a browser, which is exactly how a clamp goes missing unnoticed.
    expect(screen.getByTestId("listings-feed-title").className).toContain(
      FEED_TITLE_CLASS
    );
    expect(feedCardCss()).toContain("-webkit-line-clamp:2");
  });

  it("keeps the heart outside the anchor", () => {
    render(providers(<ListingFeedCard listing={CARD} href="/l/7" />));
    const heart = screen.getByTestId("listings-feed-favorite");
    expect(screen.getByTestId("listings-feed-open").contains(heart)).toBe(false);
  });

  it("draws the badge overlay only when the container fills it", () => {
    const { rerender } = render(
      providers(<ListingFeedCard listing={CARD} href="/l/7" />)
    );
    expect(screen.queryByTestId("listings-feed-badge")).toBeNull();
    rerender(
      providers(
        <ListingFeedCard
          listing={CARD}
          href="/l/7"
          badgeOverlay={<span data-testid="host-badge">New</span>}
        />
      )
    );
    expect(screen.getByTestId("host-badge")).toBeTruthy();
  });

  it("draws no antd card surface around itself", () => {
    const { container } = render(
      providers(<ListingFeedCard listing={CARD} href="/l/7" />)
    );
    expect(container.querySelector(".ant-card")).toBeNull();
  });
});

describe("<FeedGrid>", () => {
  it("is two columns by default", () => {
    render(
      providers(
        <FeedGrid>
          <ListingFeedCard listing={CARD} href="/l/7" />
        </FeedGrid>
      )
    );
    const grid = screen.getByTestId("listings-feed-grid");
    expect(grid.getAttribute("data-columns")).toBe("2");
    expect(grid.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
  });

  it("takes a column count for a wider surface", () => {
    render(
      providers(
        <FeedGrid columns={4}>
          <ListingFeedCard listing={CARD} href="/l/7" />
        </FeedGrid>
      )
    );
    expect(
      screen.getByTestId("listings-feed-grid").getAttribute("data-columns")
    ).toBe("4");
  });
});
