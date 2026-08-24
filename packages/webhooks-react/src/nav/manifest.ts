/**
 * @stapel/webhooks-react's contribution to the scripted-fullstack navigation contract
 * (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from this package's own `package.json`, and writes
 * `packages/webhooks-react/nav-manifest.json` plus this package's slice of the
 * monorepo's root aggregate. `resolveNav` (`@stapel/shell-react`) is what
 * turns that aggregate plus a host's override file into the tree a shell
 * renders and a container mounts routes from.
 *
 * ── The one entry below ────────────────────────────────────────────────────
 *
 * It names `WebhooksPanel` from `./default` — a component that exists, which
 * is the whole rule: an entry naming a component that does not exist passes
 * the generator's structural validation and fails at the CONTAINER's import,
 * two repositories away from the mistake.
 *
 * `surface` is DECLARED, not left to the `requiresAuth ? "member" : "public"`
 * derivation: a screen that later gains `requiresAuth` for an unrelated reason
 * must not silently drop out of a public container's tree.
 *
 * `icon` must be a name the shell's registry knows
 * (`shell-react/src/default/icons.tsx`) — an unknown name renders a generic
 * glyph, and stapel-tools' scaffold refuses one at generation time.
 *
 * Adding the next screen: ship the component from `./default`, add an entry
 * here, then `pnpm gen:nav` — never hand-edit `nav-manifest.json`.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
    {
      "id": "webhooks.overview",
      "labelKey": "webhooks.nav.overview",
      "icon": "AppstoreOutlined",
      "route": {
        "path": "webhooks"
      },
      "component": {
        "export": "WebhooksPanel",
        "subpath": "default"
      },
      "placement": {
        "level": "top"
      },
      "menuVisibleDefault": true,
      "requiresAuth": true,
      "surface": "member",
      "order": 50
    }
  ];
