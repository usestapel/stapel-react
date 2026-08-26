/** The storefront chrome: a top bar that never collapses, and a CTA that is never absent. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PublicShell } from "../src/default/index.js";
import {
  AccountControl,
  Brand,
  CategoryStrip,
  PUBLIC_NAV,
  ResultsScreen,
  SearchField,
  ShellFrame,
  StorefrontFooter,
} from "./_harness.js";

const ROUTES = [{ path: "s", element: <ResultsScreen /> }] as const;

function Storefront(props: {
  withAccount?: boolean;
  withBrowse?: boolean;
}): ReactElement {
  return (
    <ShellFrame
      initialPath="/s"
      routes={ROUTES}
      shell={
        <PublicShell
          nav={props.withBrowse === false ? [] : PUBLIC_NAV}
          brand={<Brand />}
          searchSlot={<SearchField />}
          {...(props.withBrowse === false ? {} : { categorySlot: <CategoryStrip /> })}
          {...(props.withAccount === true
            ? { accountSlot: <AccountControl /> }
            : {})}
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
    "A storefront's chrome, and a sibling of AppShell rather than a flag on it: top bar, browse bar, measured content, footer — and never a Sider. On a phone the search box moves to its own line of the same header instead of disappearing, because a storefront whose search vanishes on a phone is a storefront nobody searches. Omit accountSlot and a sign-in link renders anyway: the absence of a sign-in button on a public page is not clean, it is a dead end for the one person the page exists to convert.",
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
  },
});
