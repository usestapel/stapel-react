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
    badges: {
      description:
        "navBadges is the canonical channel, so the same counts mark the entries wherever they render — here the desktop browse bar's tabs, which have no dock to fall back on. A zero, or an id nothing was passed for, draws nothing at all.",
      viewport: "desktop",
      step: "badged",
      render: () => <Storefront docked badges withAccount />,
    },
  },
});
