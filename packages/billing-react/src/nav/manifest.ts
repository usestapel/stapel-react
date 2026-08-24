/**
 * @stapel/billing-react's contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from this package's own `package.json`, and writes
 * `packages/billing-react/nav-manifest.json` plus this package's slice of the
 * monorepo's root aggregate. `resolveNav` (`@stapel/shell-react`) turns that
 * aggregate plus a host's override file into the tree a shell renders and a
 * container mounts routes from.
 *
 * ── One entry, and its id does not start with `billing.` ──────────────────
 *
 * The convention is `"<module>.<screen>"`, and this is `account.billing`:
 * nobody looks for their credits under the name of the Django app that holds
 * them, they look in their account settings. The id names the MENU an entry
 * belongs to, because that is what an id is for in a tree assembled from many
 * packages; the package that owns the code is recorded beside it in the
 * manifest.
 *
 * `account.root` is a CONTAINER-synthesised parent this pair does not declare
 * (stapel-tools' `_frontend_templates.py` builds it around the account
 * submenu), which is why the nav gate's `NAV_CONTAINER_PARENTS` allowlist
 * carries it and this entry is not the orphan `admin.root` case.
 *
 * ── Why `WalletPanel` and not the four parts ──────────────────────────────
 *
 * The parts (`SubscriptionCard`, `BuyOptions`, `WalletSettings`,
 * `TransactionHistory`) are exports for a host laying out its own page, not
 * destinations. Four menu items where a person expects one ("Billing") is a
 * menu describing our file layout rather than their account. `WalletPanel` is
 * the page; everything else is reachable by scrolling it.
 *
 * ── The icon is a compromise, and a recorded one ──────────────────────────
 *
 * `shell-react`'s registry has sixteen names and none of them is a wallet or
 * a card; a name it cannot resolve renders a generic square, which the nav
 * gate now catches. `TagOutlined` (a price tag) is the closest true thing in
 * the set. A `WalletOutlined` request is filed in
 * `SCRATCH/wave-b/REQUESTS-billing-react.md`.
 */
import type { NavEntry } from "@stapel/core";

/** The container-owned account section this pair's screen hangs from. */
export const ACCOUNT_ROOT_ID = "account.root";

export const navEntries: readonly NavEntry[] = [
  {
    id: "account.billing",
    labelKey: "billing.wallet.heading",
    icon: "TagOutlined",
    route: { path: "billing" },
    component: { export: "WalletPanel", subpath: "default" },
    placement: { level: "submenu", parentId: ACCOUNT_ROOT_ID },
    menuVisibleDefault: true,
    // Every endpoint behind this screen is IsAuthenticated — stapel-billing
    // denies guests on the wallet, the checkout, the portal and the
    // subscription alike ("money is account business").
    requiresAuth: true,
    surface: "member",
    order: 80,
  },
];
