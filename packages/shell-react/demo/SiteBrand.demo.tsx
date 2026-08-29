/** One build, two domains: the wordmark and the legal line come off the wire. */
import type { ReactElement } from "react";
import { createStapelClient, SiteProvider } from "@stapel/core";
import type { Site } from "@stapel/core";
import { defineDemo } from "@stapel/showcase";
import { PublicShell, SiteBrand, SiteLegalFooter } from "../src/default/index.js";
import {
  CategoryStrip,
  PUBLIC_NAV,
  ResultsScreen,
  SearchField,
  ShellFrame,
} from "./_harness.js";

const ROUTES = [{ path: "s", element: <ResultsScreen /> }] as const;

/**
 * A mark that needs no colour of its own — `currentColor` means the logo
 * inherits the brand's text colour and stays legible in both themes, which
 * is also the rule a real deployment's SVG should follow.
 */
const MARK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
      "<path fill='currentColor' d='M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7V11h-7v9Zm0-16v5h7V4h-7Z'/></svg>"
  );

/** The two hosts one image serves, as `GET /auth/api/v1/site/` answers them. */
const NORTHGATE: Site = {
  host: "northgate.test",
  matched: true,
  primary: true,
  locale: "en",
  brand: {
    key: "northgate",
    name: "Northgate",
    title: "Northgate Market",
    logo: MARK,
    theme: "northgate",
    legal: {
      company: "Northgate Market Ltd",
      support_email: "hello@northgate.test",
      privacy_url: "/privacy",
      terms_url: "/terms",
    },
  },
  seo: { index: true, canonical_host: "northgate.test" },
};

const SOUTHGATE: Site = {
  host: "southgate.test",
  matched: true,
  primary: false,
  locale: "en",
  brand: {
    key: "southgate",
    name: "Southgate",
    title: "Southgate Classifieds",
    logo: "",
    theme: "southgate",
    legal: {
      company: "Southgate Classifieds BV",
      support_email: "hello@southgate.test",
      privacy_url: "/privacy",
    },
  },
  seo: { index: true, canonical_host: "southgate.test" },
};

/**
 * The demo's backend. A client whose `site/` answers instantly with the site
 * this variant is about — the same code path a deployment takes, rather than
 * a prop that bypasses the fetch and proves nothing.
 */
function clientFor(site: Site): ReturnType<typeof createStapelClient> {
  return createStapelClient({
    baseUrl: "/auth/api/v1/",
    fetch: (() =>
      Promise.resolve(
        new Response(JSON.stringify(site), {
          headers: { "content-type": "application/json" },
        })
      )) as unknown as typeof globalThis.fetch,
  });
}

function Storefront(props: { site: Site; explicitFooter?: boolean }): ReactElement {
  return (
    <SiteProvider client={clientFor(props.site)} fallback={props.site}>
      <ShellFrame
        initialPath="/s"
        routes={ROUTES}
        shell={
          <PublicShell
            nav={PUBLIC_NAV}
            searchSlot={<SearchField />}
            categorySlot={<CategoryStrip />}
            // A host that arranges its own footer composes the same component
            // instead of re-implementing the legal line.
            {...(props.explicitFooter === true
              ? { footer: <SiteLegalFooter /> }
              : {})}
          />
        }
      />
    </SiteProvider>
  );
}

export default defineDemo({
  id: "shell.site-brand",
  title: "Host-resolved brand",
  description:
    "The same container, the same nav, the same routed screen — and two identities, because the brand is fetched at runtime (GET site/) instead of baked into the image. Pass PublicShell no `brand` and no `footer` and it draws SiteBrand and SiteLegalFooter from useSite(); the logo is optional, so a brand with none is a text wordmark rather than a hole in the header. The legal line states the operating company, the support mailbox and the links THIS host is bound by, which on a second domain is a different company from the first.",
  component: SiteBrand,
  covers: ["SiteLegalFooter"],
  tokens: ["surface", "text"],
  variants: {
    default: {
      description: "The primary host: a logo lockup and a full legal line.",
      viewport: "desktop",
      step: "primary-host",
      render: () => <Storefront site={NORTHGATE} />,
    },
    "second-brand": {
      description:
        "The second domain off the same build: another name, another company, no terms link because this brand publishes none. Here the host passes SiteLegalFooter itself rather than letting the shell default to it.",
      viewport: "desktop",
      step: "second-host",
      render: () => <Storefront site={SOUTHGATE} explicitFooter />,
    },
    phone: {
      description: "Phone: the wordmark truncates rather than pushing the account control off the row.",
      viewport: "phone",
      step: "primary-host",
      render: () => <Storefront site={NORTHGATE} />,
    },
  },
});
