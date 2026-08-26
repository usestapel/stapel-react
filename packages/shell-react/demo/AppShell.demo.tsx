/** The signed-in chrome: a sidebar on a desktop, a sheet on a phone. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AppShell } from "../src/default/index.js";
import {
  AccountControl,
  AdminScreen,
  Brand,
  MEMBER_NAV,
  NotificationsScreen,
  SettingsScreen,
  ShellFrame,
} from "./_harness.js";

const ROUTES = [
  { path: "settings", element: <SettingsScreen /> },
  { path: "settings/security", element: <SettingsScreen /> },
  { path: "notifications", element: <NotificationsScreen /> },
  { path: "admin/privacy", element: <AdminScreen /> },
] as const;

function Shell(props: { staff: boolean; path?: string }): ReactElement {
  return (
    <ShellFrame
      initialPath={props.path ?? "/settings"}
      routes={ROUTES}
      shell={
        <AppShell
          nav={MEMBER_NAV}
          staff={props.staff}
          logo={<Brand />}
          headerExtra={<AccountControl />}
        />
      }
    />
  );
}

export default defineDemo({
  id: "shell.app",
  title: "App shell",
  description:
    "The chrome around every signed-in screen. It renders an already-resolved nav and owns no nav logic: one top bar across the whole window, a Sider under it at desktop width, a hamburger sheet below that width, decided by @stapel/core's useBreakpoint — which now answers on the FIRST client render, so the phone branch is never painted on a desktop and swapped out a frame later. The admin section is the one a pair hangs a staff screen from and nobody declares; it is synthesised, LISTED for everyone, and drawn as a closed group with its reason under it when the staff capability is absent, because an entry that vanishes teaches nobody the screen exists.",
  component: AppShell,
  // The synthesised admin section is what these two constants ARE — the
  // parent nobody declares and the entry the shell puts in its place — so the
  // demo that draws that section is the demo that documents them.
  covers: ["ADMIN_ROOT_ID", "ADMIN_ROOT_ENTRY"],
  tokens: ["surface", "text"],
  variants: {
    default: {
      description: "Desktop: brand, sidebar, nested submenu, routed screen.",
      viewport: "desktop",
      step: "sider",
      render: () => <Shell staff />,
    },
    "admin-blocked": {
      description: "The admin section, listed and closed, with the reason under it.",
      viewport: "desktop",
      step: "admin-blocked",
      render: () => <Shell staff={false} />,
    },
    phone: {
      description: "Phone: menu, brand and account in a 56px header.",
      viewport: "phone",
      step: "collapsed",
      render: () => <Shell staff path="/notifications" />,
    },
    "phone-drawer": {
      description: "The same phone chrome with the nav sheet open.",
      viewport: "phone",
      step: "drawer-open",
      render: () => <Shell staff />,
      // The sheet is opened through its own affordance rather than through a
      // prop that exists only for demos: the hamburger is what a person
      // presses, so it is what this variant presses. As a `play` step the shot
      // runner waits for it (`data-stapel-play="done"`) instead of racing a
      // mount effect.
      play: async ({ click, find }) => {
        await click('[data-testid="app-shell-menu-trigger"]');
        await find('[data-testid="app-shell-drawer-close"]', { portal: true });
      },
    },
  },
});
