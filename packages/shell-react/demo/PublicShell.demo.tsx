/** The storefront chrome: a top bar that never collapses, and a CTA that is never absent. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PublicShell } from "../src/default/index.js";
import {
  AccountControl,
  Brand,
  CategoryStrip,
  DOCK_NAV,
  PUBLIC_NAV,
  ResultsScreen,
  SearchField,
  ShellFrame,
  StorefrontFooter,
} from "./_harness.js";

const ROUTES = [{ path: "s", element: <ResultsScreen /> }] as const;

/** What a marketplace actually has waiting: messages, and a moderated ad. */
const BADGES: Readonly<Record<string, number>> = {
  "chat.threads": 3,
  "listings.mine": 1,
};

function Storefront(props: {
  withAccount?: boolean;
  withBrowse?: boolean;
  /** The five-destination tree, for the variants that show a dock. */
  docked?: boolean;
  phoneChrome?: "drawer" | "dock";
  badges?: boolean;
  /** The sticky-header pair: where the header pins, and whether it marks that
   * the page has moved. */
  headerSticky?: boolean | "desktop" | "phone";
  scrollFlag?: boolean;
}): ReactElement {
  return (
    <ShellFrame
      initialPath="/s"
      routes={ROUTES}
      shell={
        <PublicShell
          nav={
            props.withBrowse === false ? [] : props.docked === true ? DOCK_NAV : PUBLIC_NAV
          }
          brand={<Brand />}
          searchSlot={<SearchField />}
          {...(props.withBrowse === false ? {} : { categorySlot: <CategoryStrip /> })}
          {...(props.withAccount === true
            ? { accountSlot: <AccountControl /> }
            : {})}
          {...(props.phoneChrome !== undefined ? { phoneChrome: props.phoneChrome } : {})}
          {...(props.badges === true ? { navBadges: BADGES } : {})}
          {...(props.headerSticky !== undefined
            ? { headerSticky: props.headerSticky }
            : {})}
          {...(props.scrollFlag === true ? { headerScrollFlag: true } : {})}
          footer={<StorefrontFooter />}
        />
      }
    />
  );
}

export default defineDemo({
  id: "shell.public",
  title: "Public shell",
  description:
    "A storefront's chrome, and a sibling of AppShell rather than a flag on it: top bar, browse bar, measured content, footer — and never a Sider. The phone has two frames: the default \"drawer\", where the search box moves to its own line of the same header and browse collapses behind a hamburger, and phoneChrome=\"dock\", which drops the hamburger, the sheet and the second line for one sticky row over a dock. Either way the search box never disappears, because a storefront whose search vanishes on a phone is a storefront nobody searches. Omit accountSlot and a sign-in link renders anyway: the absence of a sign-in button on a public page is not clean, it is a dead end for the one person the page exists to convert.",
  component: PublicShell,
  tokens: ["surface", "text"],
  variants: {
    default: {
      description: "Desktop: brand, search, browse bar, and the default sign-in CTA.",
      viewport: "desktop",
      step: "anonymous",
      render: () => <Storefront />,
    },
    "signed-in": {
      description: "A host's own account menu steps in for the CTA.",
      viewport: "desktop",
      step: "account-slot",
      render: () => <Storefront withAccount />,
    },
    "nothing-to-browse": {
      description: "No nav and no categories: no hamburger onto an empty sheet.",
      viewport: "phone",
      step: "no-browse",
      render: () => <Storefront withBrowse={false} />,
    },
    phone: {
      description: "Phone: the header keeps its search on a second line; browse collapses.",
      viewport: "phone",
      step: "collapsed",
      render: () => <Storefront />,
    },
    "phone-dock": {
      description:
        "phoneChrome=\"dock\": one sticky header row — search stretched, sign-in at its end — and the dock is the whole navigation. No hamburger, no sheet, no second line, no brand: identity and destinations both live under the thumb. The footer stays, because legal links are not clutter.",
      viewport: "phone",
      step: "dock",
      render: () => <Storefront docked phoneChrome="dock" />,
    },
    "phone-dock-badges": {
      description:
        "The same decluttered frame with counts on it: three unread messages and one ad awaiting moderation, addressed by nav entry id. The number is on the badge for the eye and inside the destination's accessible name for a screen reader.",
      viewport: "phone",
      step: "dock-badged",
      render: () => <Storefront docked phoneChrome="dock" badges />,
    },
    "sticky-desktop": {
      description:
        "headerSticky=\"desktop\" pins the desktop header at the top of the window — the half the shell used to leave to a host's stylesheet, which is a geometry decision taken outside the component that owns the geometry. The height it now occupies is published as --stapel-header-height on the shell's root, so a filter rail or a sort bar underneath states the offset once and reads it from here.",
      viewport: "desktop",
      step: "sticky",
      render: () => <Storefront headerSticky="desktop" withAccount />,
    },
    "sticky-scrolled": {
      description:
        "The same pinned header with headerScrollFlag: one IntersectionObserver on a 1px sentinel above it writes data-scrolled on the header, and a brand's own rule turns that into a hairline or a shadow. Never a scroll listener, which would run on every frame of a feed of photographs; the sentinel takes a pixel and gives it straight back, so it is a position in the page and not a change to it.",
      viewport: "desktop",
      step: "sticky-flagged",
      render: () => <Storefront headerSticky scrollFlag withAccount />,
    },
    badges: {
      description:
        "navBadges is the canonical channel, so the same counts mark the entries wherever they render — here the desktop browse bar's tabs, which have no dock to fall back on. A zero, or an id nothing was passed for, draws nothing at all.",
      viewport: "desktop",
      step: "badged",
      render: () => <Storefront docked badges withAccount />,
    },
  },
});
