/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`).
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from THIS package's own `package.json`, and emits
 * `packages/chat-react/nav-manifest.json` plus this package's slice of the
 * root aggregate.
 *
 * ONE ENTRY, MEMBER-ONLY. Chat is a member surface end to end: every endpoint
 * is `IsAuthenticated`, and the socket closes 4401 without a session. The
 * public storefront links INTO it ("message the seller"), but the link lands
 * on a member route — which is why `surface` is stated explicitly here rather
 * than left to be derived: a public container that forgot the audience filter
 * would otherwise mount an inbox for visitors who have none.
 *
 * The thread route (`/…/chat/:id`) is deliberately NOT an entry: it is not a
 * menu destination, and the nav contract addresses routes by static path. A
 * container mounts `<ConversationThreadPanel conversationId={…}/>` under its
 * own `:id` child route.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "chat.conversations",
    labelKey: "chat.nav.conversations",
    icon: "MessageOutlined",
    route: { path: "chat" },
    component: { export: "ConversationListPanel", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 25,
  },
];
