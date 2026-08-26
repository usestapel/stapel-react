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
 *
 * Plus the five OPERATOR-console screens, whose ids start with `admin.`
 * rather than `auth.`: an id names the MENU an entry belongs to, and nobody
 * looks for "service keys" or "enterprise SSO" under a module called Auth —
 * they look under administration. Their components come from the separate
 * `default/admin` subpath, so a host that never mounts them never bundles
 * them. `admin.root` is a CONTAINER-owned parent this pair does not declare
 * (the same shape as `@stapel/video-react`'s `admin.usage`); `resolveNav`
 * DROPS an orphaned submenu entry rather than throwing, so a host with no
 * admin area gets a smaller menu, not a broken build.
 */
import type { NavEntry } from "@stapel/core";

/** The container-owned top entry the operator console hangs from. A constant
 * so the reference cannot drift, and exported so a container can assert it
 * against its own `stapel.nav.json` override. */
export const ADMIN_ROOT_ID = "admin.root";

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

  // ── Operator console (`default/admin`) ─────────────────────────────────
  //
  // Icons come from `@stapel/shell-react`'s REGISTRY, which is the set a nav
  // manifest may name — anything outside it resolves to a blank fallback
  // square with no error anywhere, so these are the closest REGISTERED
  // glyphs rather than the most precise names. More precise ones (a key, a
  // team, an add-user) are requested of shell-react in the pair's REQUESTS
  // file; they are a registry addition, not a manifest change.
  //
  // `surface: "member"` is DECLARED, not derived from `requiresAuth`: a
  // session is not a staff role, and every endpoint behind these screens
  // answers 403 to a signed-in person who holds none. The entries are
  // visible by default because the refusal is explained ON the screen; a
  // door that silently does not exist teaches nobody why.
  {
    id: "admin.sso_orgs",
    labelKey: "auth.nav.admin_sso",
    icon: "AppstoreOutlined",
    route: { path: "sso" },
    component: { export: "SsoOrgsPanel", subpath: "default/admin" },
    placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 40,
  },
  {
    id: "admin.service_keys",
    labelKey: "auth.nav.admin_service_keys",
    icon: "SafetyCertificateOutlined",
    route: { path: "service-keys" },
    component: { export: "ServiceKeysPanel", subpath: "default/admin" },
    placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 41,
  },
  {
    id: "admin.staff_roles",
    labelKey: "auth.nav.admin_staff_roles",
    icon: "UserOutlined",
    route: { path: "staff-roles" },
    component: { export: "StaffRolesPanel", subpath: "default/admin" },
    placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 42,
  },
  {
    id: "admin.users_create",
    labelKey: "auth.nav.admin_users",
    icon: "PlusOutlined",
    route: { path: "create-account" },
    component: { export: "AdminUsersPanel", subpath: "default/admin" },
    placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 43,
  },
  {
    id: "admin.auth_audit",
    labelKey: "auth.nav.admin_audit",
    icon: "AuditOutlined",
    route: { path: "auth-audit" },
    component: { export: "AdminAuditPanel", subpath: "default/admin" },
    placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 44,
  },
];
