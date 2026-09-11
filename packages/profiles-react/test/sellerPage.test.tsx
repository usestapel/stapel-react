/**
 * `<SellerPage>` — the seller page as a person with sections (§30(a)).
 *
 * The gap this covers, in the composition walk's words: `/u/<id>` was
 * "functionally a pre-filtered search results page scoped to one seller".
 * The reference's page is three sections — overview, listings, reviews —
 * and ours had one, so a buyer could not read what other buyers said and a
 * seller had nowhere to say anything about themselves.
 *
 * What is asserted here, deliberately, is the BEHAVIOUR a host depends on and
 * not the fact that antd was used:
 *
 *  - the identity stays above the sections and does not move with them;
 *  - the page opens on the inventory, and a bare `/u/<id>` IS the inventory;
 *  - a URL naming a section this page does not have never produces an empty
 *    page;
 *  - a routed host owns the address — `activeTab` decides, `onTabChange`
 *    reports — and an unrouted host still works;
 *  - the ARIA tab pattern actually responds to the keyboard;
 *  - all three sections carry a word in all three shipped locales.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";
import { SellerPage } from "../src/default/SellerPage.js";
import type { SellerPageTab } from "../src/default/SellerPage.js";
import {
  SELLER_DEFAULT_TAB,
  SELLER_TAB,
  SELLER_TABS,
  resolveSellerTab,
  sellerTabPath,
} from "../src/model/sellerTabs.js";
import { PROFILES_I18N_KEYS, registerProfilesI18n } from "../src/i18n/keys.js";
import { registerProfilesI18nRu } from "../src/i18n/ru.js";
import { registerProfilesI18nEs } from "../src/i18n/es.js";

function Harness(props: {
  readonly children: ReactNode;
  readonly locale?: string;
}): ReactElement {
  const i18n = createI18n({ locale: props.locale ?? "en" });
  registerProfilesI18n(i18n);
  registerProfilesI18nRu(i18n);
  registerProfilesI18nEs(i18n);
  return <I18nProvider i18n={i18n}>{props.children}</I18nProvider>;
}

const THREE: readonly SellerPageTab[] = [
  { key: SELLER_TAB.overview, content: <p>About Ada</p> },
  { key: SELLER_TAB.listings, content: <p>Fourteen listings</p> },
  { key: SELLER_TAB.reviews, content: <p>Nine reviews</p> },
];

function Identity(): ReactElement {
  return <h1>Ada Lovelace</h1>;
}

describe("resolveSellerTab — the router's half", () => {
  it("reads the bare /u/<id> as the inventory, not as nothing", () => {
    // The defect this exists to prevent: an unguarded `activeKey` on the bare
    // address selects no section at all — three tabs over an empty frame.
    expect(resolveSellerTab(undefined)).toBe(SELLER_TAB.listings);
    expect(resolveSellerTab(null)).toBe(SELLER_TAB.listings);
    expect(resolveSellerTab("")).toBe(SELLER_TAB.listings);
    expect(SELLER_DEFAULT_TAB).toBe(SELLER_TAB.listings);
  });

  it("keeps a section a page really has", () => {
    for (const tab of SELLER_TABS) {
      expect(resolveSellerTab(tab)).toBe(tab);
    }
    expect(resolveSellerTab("  reviews  ")).toBe(SELLER_TAB.reviews);
  });

  it("never answers a section the page does not have", () => {
    // A stale link, a typo, or a deployment that mounts two sections instead
    // of three. None of them may name a tab that is not on the page.
    expect(resolveSellerTab("otzyvy")).toBe(SELLER_TAB.listings);
    const two = [SELLER_TAB.overview, SELLER_TAB.reviews];
    expect(resolveSellerTab("reviews", two)).toBe(SELLER_TAB.reviews);
    // `listings` is the fleet default and this page has no such section, so
    // the fallback is the page's FIRST one rather than a key off the page.
    expect(resolveSellerTab("listings", two)).toBe(SELLER_TAB.overview);
    expect(resolveSellerTab(undefined, two)).toBe(SELLER_TAB.overview);
  });
});

describe("sellerTabPath — one address per document", () => {
  it("leaves the canonical /u/<id> alone for the inventory", () => {
    // Two addresses for one page splits its history, its analytics and its
    // share links; every link in the fleet already points at `/u/<id>`.
    expect(sellerTabPath("/u/42", SELLER_TAB.listings)).toBe("/u/42");
    expect(sellerTabPath("/u/42/", SELLER_TAB.listings)).toBe("/u/42");
  });

  it("gives the other sections a segment of their own", () => {
    expect(sellerTabPath("/u/42", SELLER_TAB.reviews)).toBe("/u/42/reviews");
    expect(sellerTabPath("/u/42", SELLER_TAB.overview)).toBe("/u/42/overview");
  });
});

describe("<SellerPage>", () => {
  it("opens on the inventory with the identity above it", () => {
    render(
      <Harness>
        <SellerPage identity={<Identity />} tabs={THREE} />
      </Harness>
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Ada Lovelace"
    );
    expect(screen.getByText("Fourteen listings")).toBeTruthy();
    expect(screen.queryByText("Nine reviews")).toBeNull();
    expect(
      screen.getByRole("tab", { name: "Listings" }).getAttribute("aria-selected")
    ).toBe("true");
  });

  it("keeps the identity when the section changes", () => {
    // The name disappearing behind a tab would be the §30(a) defect wearing a
    // tab bar: every section is about the same person.
    render(
      <Harness>
        <SellerPage
          identity={<Identity />}
          tabs={THREE}
          activeTab={SELLER_TAB.reviews}
        />
      </Harness>
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Ada Lovelace"
    );
    expect(screen.getByText("Nine reviews")).toBeTruthy();
  });

  it("lands a URL naming no section of this page on the inventory", () => {
    render(
      <Harness>
        <SellerPage identity={<Identity />} tabs={THREE} activeTab="otzyvy" />
      </Harness>
    );
    expect(screen.getByText("Fourteen listings")).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Listings" }).getAttribute("aria-selected")
    ).toBe("true");
  });

  it("lets a routed host own the address: it reports, the host decides", () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <Harness>
        <SellerPage
          identity={<Identity />}
          tabs={THREE}
          activeTab={SELLER_TAB.listings}
          onTabChange={onTabChange}
        />
      </Harness>
    );
    fireEvent.click(screen.getByRole("tab", { name: "Reviews" }));
    expect(onTabChange).toHaveBeenCalledWith(SELLER_TAB.reviews);
    // The host has not written the URL yet, so the page still shows what the
    // address says — a tab that does not move, never a page whose address
    // lies about what is on screen.
    expect(screen.getByText("Fourteen listings")).toBeTruthy();
    rerender(
      <Harness>
        <SellerPage
          identity={<Identity />}
          tabs={THREE}
          activeTab={SELLER_TAB.reviews}
          onTabChange={onTabChange}
        />
      </Harness>
    );
    expect(screen.getByText("Nine reviews")).toBeTruthy();
  });

  it("switches on its own when no host is routing it", () => {
    render(
      <Harness>
        <SellerPage identity={<Identity />} tabs={THREE} />
      </Harness>
    );
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByText("About Ada")).toBeTruthy();
  });

  it("opens an unrouted page on the section the host named", () => {
    render(
      <Harness>
        <SellerPage
          identity={<Identity />}
          tabs={THREE}
          defaultTab={SELLER_TAB.reviews}
        />
      </Harness>
    );
    expect(screen.getByText("Nine reviews")).toBeTruthy();
  });

  it("answers the keyboard: arrows move, Enter and Home commit", () => {
    // The ARIA tab pattern with MANUAL activation — arrows move focus, Enter
    // chooses. Asserted rather than assumed: "we used the accessible library"
    // is the kind of green that proves nothing.
    const onTabChange = vi.fn();
    render(
      <Harness>
        <SellerPage
          identity={<Identity />}
          tabs={THREE}
          onTabChange={onTabChange}
        />
      </Harness>
    );
    const listings = screen.getByRole("tab", { name: "Listings" });
    fireEvent.keyDown(listings, { code: "ArrowRight" });
    fireEvent.keyDown(listings, { code: "Enter" });
    expect(onTabChange).toHaveBeenLastCalledWith(SELLER_TAB.reviews);
    fireEvent.keyDown(listings, { code: "Home" });
    fireEvent.keyDown(listings, { code: "Enter" });
    expect(onTabChange).toHaveBeenLastCalledWith(SELLER_TAB.overview);
  });

  it("mounts a section when it is first opened, and keeps it after", () => {
    // A section is a whole search or a whole review list; mounting all three
    // on arrival buys three requests for one answer, and unmounting on the way
    // out buys the first one twice when a buyer flips back.
    render(
      <Harness>
        <SellerPage identity={<Identity />} tabs={THREE} />
      </Harness>
    );
    expect(screen.queryByText("About Ada")).toBeNull();
    expect(screen.queryByText("Nine reviews")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByText("About Ada")).toBeTruthy();
    // The inventory is still in the document, just not on screen — that is
    // what "kept" means here.
    expect(screen.getByText("Fourteen listings")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Listings" }));
    expect(screen.getByText("Fourteen listings")).toBeTruthy();
  });

  it("takes a host's own word for a section it named itself", () => {
    render(
      <Harness>
        <SellerPage
          identity={<Identity />}
          tabs={[
            { key: SELLER_TAB.listings, content: <p>Fourteen listings</p> },
            { key: "shipping", label: "Delivery", content: <p>By post</p> },
          ]}
        />
      </Harness>
    );
    expect(screen.getByRole("tab", { name: "Delivery" })).toBeTruthy();
  });

  it("falls through to the key rather than inventing a word", () => {
    // The honest bottom of the fleet's label ladder — the same rule
    // `sellerTypeLabel` follows.
    render(
      <Harness>
        <SellerPage
          identity={<Identity />}
          tabs={[
            { key: SELLER_TAB.listings, content: <p>Fourteen listings</p> },
            { key: "shipping", content: <p>By post</p> },
          ]}
        />
      </Harness>
    );
    expect(screen.getByRole("tab", { name: "shipping" })).toBeTruthy();
  });

  it("carries all three sections in all three shipped locales", () => {
    const cases: readonly (readonly [string, string, string, string])[] = [
      ["en", "Overview", "Listings", "Reviews"],
      // The reference's own three words — the row this closes names them.
      ["ru", "Главная", "Объявления", "Отзывы"],
      ["es", "Resumen", "Anuncios", "Opiniones"],
    ];
    for (const [locale, overview, listings, reviews] of cases) {
      const i18n = createI18n({ locale });
      registerProfilesI18n(i18n);
      registerProfilesI18nRu(i18n);
      registerProfilesI18nEs(i18n);
      expect(i18n.t(PROFILES_I18N_KEYS.sellerTabOverview)).toBe(overview);
      expect(i18n.t(PROFILES_I18N_KEYS.sellerTabListings)).toBe(listings);
      expect(i18n.t(PROFILES_I18N_KEYS.sellerTabReviews)).toBe(reviews);
    }
  });

  it("draws every section's word on the page in the reader's language", () => {
    render(
      <Harness locale="ru">
        <SellerPage identity={<Identity />} tabs={THREE} />
      </Harness>
    );
    expect(screen.getByRole("tab", { name: "Главная" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Объявления" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Отзывы" })).toBeTruthy();
  });
});
