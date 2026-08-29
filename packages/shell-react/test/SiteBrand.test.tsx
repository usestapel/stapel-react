/**
 * `<SiteBrand/>` / `<SiteLegalFooter/>` and the two `<PublicShell/>` defaults
 * they fill (multibrand spec, frontend decision).
 *
 * The rule under test is a pair of them, and the second is the one that
 * breaks fleets: below a `<SiteProvider>` the shell draws the HOST's brand
 * and the HOST's legal line when the container passes neither — and with no
 * provider anywhere it behaves exactly as it did before the seam existed,
 * because `useOptionalSite()` returns null instead of throwing. A brand slot
 * that can take a storefront down is not a feature.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ReactElement } from "react";
import { I18nProvider, SiteProvider, createI18n, createStapelClient } from "@stapel/core";
import type { Site } from "@stapel/core";
import { PublicShell } from "../src/default/PublicShell.js";
import { registerShellI18n } from "../src/i18n/keys.js";

afterEach(() => cleanup());

const NORTHGATE_BRAND = {
  key: "northgate",
  name: "Northgate",
  title: "Northgate — classifieds",
  logo: "/brand/northgate/logo.svg",
  theme: "northgate",
  legal: {
    company: "Northgate LLC",
    support_email: "hello@northgate.test",
    privacy_url: "/privacy",
    terms_url: "/terms",
  },
} as const;

const NORTHGATE: Site = {
  host: "northgate.test",
  matched: true,
  primary: false,
  locale: "en",
  brand: NORTHGATE_BRAND,
  seo: { index: true, canonical_host: "northgate.test" },
};

/** A client whose `site/` never answers: the fallback IS the site under test,
 * so nothing here depends on a race. */
const silentClient = createStapelClient({
  baseUrl: "/auth/api/v1/",
  fetch: (() => new Promise<Response>(() => {})) as unknown as typeof globalThis.fetch,
});

function shell(
  props: Partial<Parameters<typeof PublicShell>[0]> = {},
  site?: Site
): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerShellI18n(i18n);
  const tree = (
    <MemoryRouter initialEntries={["/s"]}>
      <Routes>
        <Route element={<PublicShell nav={[]} {...props} />}>
          <Route path="s" element={<div>Search Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  return (
    <I18nProvider i18n={i18n}>
      {site === undefined ? (
        tree
      ) : (
        <SiteProvider client={silentClient} fallback={site}>
          {tree}
        </SiteProvider>
      )}
    </I18nProvider>
  );
}

describe("PublicShell below a SiteProvider", () => {
  it("draws the host's brand when no brand slot is passed", async () => {
    render(shell({}, NORTHGATE));

    const brand = await screen.findByTestId("public-shell-brand");
    expect(brand.textContent).toContain("Northgate");
    // `alt=""`: the name is right beside it, so a screen reader must not say
    // it twice.
    const logo = screen.getByTestId("site-brand-logo");
    expect(logo.getAttribute("src")).toBe("/brand/northgate/logo.svg");
    expect(logo.getAttribute("alt")).toBe("");
    // The wordmark leads home.
    expect(screen.getByTestId("site-brand").getAttribute("href")).toBe("/");
  });

  it("draws the host's legal line when no footer is passed", async () => {
    render(shell({}, NORTHGATE));

    const footer = await screen.findByTestId("site-legal-footer");
    expect(footer.textContent).toContain("Northgate LLC");
    expect(screen.getByTestId("site-legal-support").getAttribute("href")).toBe(
      "mailto:hello@northgate.test"
    );
    expect(screen.getByTestId("site-legal-support").textContent).toBe("hello@northgate.test");
    expect(screen.getByTestId("site-legal-privacy").getAttribute("href")).toBe("/privacy");
    expect(screen.getByTestId("site-legal-privacy").textContent).toBe("Privacy");
    expect(screen.getByTestId("site-legal-terms").getAttribute("href")).toBe("/terms");
    expect(screen.getByTestId("site-legal-terms").textContent).toBe("Terms");
  });

  it("renders only the legal keys this brand actually carries", async () => {
    const noTerms: Site = {
      ...NORTHGATE,
      brand: { ...NORTHGATE_BRAND, logo: "", legal: { company: "Northgate LLC" } },
    };
    render(shell({}, noTerms));

    await screen.findByTestId("site-legal-company");
    expect(screen.queryByTestId("site-legal-terms")).toBeNull();
    expect(screen.queryByTestId("site-legal-privacy")).toBeNull();
    expect(screen.queryByTestId("site-legal-support")).toBeNull();
    // A brand with no logo is a text wordmark, not a broken image.
    expect(screen.queryByTestId("site-brand-logo")).toBeNull();
    expect(screen.getByTestId("public-shell-brand").textContent).toContain("Northgate");
  });

  it("the host's own brand and footer still win over the resolved site", async () => {
    render(
      shell(
        { brand: <span data-testid="host-brand">Host brand</span>, footer: <span>Host footer</span> },
        NORTHGATE
      )
    );

    await screen.findByTestId("host-brand");
    expect(screen.queryByTestId("site-brand")).toBeNull();
    expect(screen.queryByTestId("site-legal-footer")).toBeNull();
    expect(screen.getByTestId("public-shell-footer").textContent).toContain("Host footer");
  });
});

describe("PublicShell with no SiteProvider — unchanged", () => {
  it("renders no brand and no footer, and still renders the sign-in CTA", async () => {
    render(shell());

    // Rule 2 of the public chrome: the CTA is never absent.
    await screen.findByTestId("public-shell-sign-in");
    expect(screen.queryByTestId("public-shell-brand")).toBeNull();
    expect(screen.queryByTestId("public-shell-footer")).toBeNull();
    expect(screen.queryByTestId("site-brand")).toBeNull();
  });

  it("a host-passed brand and footer render exactly as before", async () => {
    render(
      shell({
        brand: <span data-testid="host-brand">Host brand</span>,
        footer: <span data-testid="host-footer">Host footer</span>,
      })
    );

    await screen.findByTestId("host-brand");
    expect(screen.getByTestId("host-footer")).toBeTruthy();
  });
});

describe("the resolved brand reaches <html>", () => {
  it("SiteProvider stamps data-brand so the scoped token set applies", async () => {
    render(shell({}, NORTHGATE));
    await waitFor(() => expect(document.documentElement.dataset.brand).toBe("northgate"));
  });
});
