/** The storefront chrome: a top bar that never collapses, and a CTA that is never absent. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PublicShell } from "../src/default/index.js";
import { PUBLIC_NAV, ShellFrame } from "./_harness.js";
import { DemoPage } from "./_harness.js";

const ROUTES = [{ path: "s", labelKey: "demo.page.settings" }] as const;

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
          brand={<DemoPage labelKey="demo.brand" />}
          searchSlot={<DemoPage labelKey="demo.search" />}
          {...(props.withBrowse === false
            ? {}
            : { categorySlot: <DemoPage labelKey="demo.categories" /> })}
          {...(props.withAccount === true
            ? { accountSlot: <DemoPage labelKey="demo.account" /> }
            : {})}
          footer={<DemoPage labelKey="demo.footer" />}
        />
      }
    />
  );
}

export default defineDemo({
  id: "shell.public",
  title: "Public shell",
  description:
    "A storefront's chrome, and a sibling of AppShell rather than a flag on it: top bar, browse bar, measured content, footer — and never a Sider. On a phone the browse bar collapses into a sheet while the header and its search box stay, because a storefront whose search disappears on a phone is a storefront nobody searches. Omit accountSlot and a sign-in link renders anyway: the absence of a sign-in button on a public page is not clean, it is a dead end for the one person the page exists to convert.",
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
      description: "Phone: the header and its search stay; browse collapses.",
      viewport: "phone",
      step: "collapsed",
      render: () => <Storefront />,
    },
  },
});
