/**
 * The bottom dock — the phone's primary navigation, drawn as a floating glass
 * island rather than a flat bar welded to the viewport's edge.
 *
 * Photographing it needs the thing it floats OVER: an island's whole claim is
 * that content passes under it and stays readable, so every variant here
 * mounts a real storefront screen behind the dock rather than an empty page.
 * A shot of a dock on white proves nothing about a dock.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { NavDock, PublicShell } from "../src/default/index.js";
import {
  Brand,
  DOCK_NAV,
  ResultsScreen,
  SearchField,
  ShellFrame,
} from "./_harness.js";

const ROUTES = [{ path: "s", element: <ResultsScreen /> }] as const;

/** What a marketplace actually has waiting: messages, and a moderated ad. */
const BADGES: Readonly<Record<string, number>> = {
  "chat.threads": 3,
  "listings.mine": 1,
};

function Docked(props: { readonly badges?: boolean }): ReactElement {
  return (
    <ShellFrame
      initialPath="/s"
      routes={ROUTES}
      shell={
        <PublicShell
          nav={DOCK_NAV}
          brand={<Brand />}
          searchSlot={<SearchField />}
          {...(props.badges === true ? { dockBadges: BADGES } : {})}
        />
      }
    />
  );
}

export default defineDemo({
  id: "shell.nav-dock",
  title: "Bottom dock",
  description:
    "Five destinations under the thumb, in the order the project's own nav file already declares — no second selection axis, no manifest flag. The island is translucent with a real blur where the engine has one and OPAQUE where it does not: the fill is progressive enhancement, never the thing the labels' contrast rests on. It floats above env(safe-area-inset-bottom), the page leaves clearance under its last row, and the destination you are on carries aria-current plus a tinted pill rather than colour alone.",
  component: NavDock,
  covers: ["NavDock"],
  tokens: ["surface-raised", "text", "brand"],
  variants: {
    phone: {
      description:
        "390px, over a live result list: the island floats, the content scrolls under it, and the current destination is marked.",
      viewport: "phone",
      step: "docked",
      render: () => <Docked />,
    },
    badges: {
      description:
        "Three unread messages and one ad awaiting moderation. The count is on the badge for the eye and inside the link's accessible name for a screen reader; a zero draws nothing at all.",
      viewport: "phone",
      step: "badged",
      render: () => <Docked badges />,
    },
    desktop: {
      description:
        "The same shell at desktop width: the browse bar is the navigation and no island floats over the content.",
      viewport: "desktop",
      step: "no-dock",
      render: () => <Docked />,
    },
  },
});
