/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`, `frontend-core-
 * architecture` Phase 1). `scripts/gen-nav-manifest.mjs` reads `navEntries`
 * below, stamps `package`/`version` from THIS package's own `package.json`
 * (never hand-copied here — a version bump must not require touching this
 * file), and emits `packages/auth-react/nav-manifest.json` plus this
 * package's slice of the root aggregate.
 *
 * Three entries:
 *  - `auth.login` — the sign-in screen. `menuVisibleDefault: false`: it is
 *    the unauthenticated redirect target, never a menu item a signed-in user
 *    clicks.
 *  - `auth.qr_confirm` — the `login_request` QR confirmation screen, at the
 *    exact path stapel-auth redirects a scanner to. `menuVisibleDefault:
 *    false` for the same reason as the login screen: it is an address the
 *    backend sends people to, not something anyone navigates to by choice.
 *  - `auth.security` — the composed `<SecuritySettings/>` page (see
 *    `../default/SecuritySettings.tsx`), nested under `profiles.settings`'s
 *    submenu. `resolveNav` degrades this entry gracefully (drops it, no
 *    throw) if a host installs auth-react without profiles-react.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "auth.login",
    labelKey: "auth.nav.login",
    icon: "LoginOutlined",
    route: { path: "/login" },
    component: { export: "AuthPanel", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: false,
    order: 0,
  },
  {
    // The address stapel-auth's `/qr/{key}/scan/` redirects a signed-in
    // scanner to — hardcoded there, so it is not optional for any host that
    // leaves the QR channel on. Left unmounted, the scanner falls through the
    // host's catch-all (usually to the home page, looking successful) and the
    // device waiting on the code is never confirmed and never told why.
    id: "auth.qr_confirm",
    labelKey: "auth.nav.qr_confirm",
    icon: "QrcodeOutlined",
    route: { path: "/qr-confirm" },
    component: { export: "QrConfirmPanel", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    // A session is needed (the backend's `confirm` is `IsAuthenticated`), a
    // mandate is not — this is the case `surface` exists to express.
    requiresAuth: true,
    surface: "public",
    order: 1,
  },
  {
    id: "auth.security",
    labelKey: "auth.nav.security",
    icon: "SafetyCertificateOutlined",
    route: { path: "security" },
    component: { export: "SecuritySettings", subpath: "default" },
    placement: { level: "submenu", parentId: "profiles.settings" },
    menuVisibleDefault: true,
    requiresAuth: true,
    order: 10,
  },
];
