/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry` / `PackageNavManifest`). `scripts/gen-nav-
 * manifest.mjs` reads `navEntries` below, stamps `package`/`version` from THIS
 * package's own `package.json`, and emits
 * `packages/forms-react/nav-manifest.json` plus this package's slice of the
 * root aggregate.
 *
 * ── Three entries, and the one screen that is deliberately not among them ──
 *
 * `<StapelForm>` — the anonymous fill surface — has NO nav entry, and that is
 * the important omission. It is not a page of the admin application: it is
 * embedded by a host wherever the form belongs (a marketing page, a support
 * footer, a partner's site), addressed by a non-enumerable `public_id`, and
 * reachable with no session at all. A nav entry for it would put a route in
 * the shell for a page whose address the shell does not know and cannot
 * enumerate — and `menuVisibleDefault: false` would not fix that, because the
 * route itself would be a claim the pair cannot honour.
 *
 * ── How these screens get their workspace ──────────────────────────────────
 *
 * They do not get it from the URL. Every admin route is workspace-scoped, and
 * a route carries no workspace: a container mounts `<FormsListPane/>` with
 * nothing but the address. The scope is declared once on the runtime
 * (`createFormsRuntime({ workspaceId })`) and read by
 * `useFormsWorkspaceId()`; a screen's own `workspaceId` prop still wins, so a
 * host driving two workspaces on one page keeps working. When a host declares
 * neither, the screen says so instead of rendering an empty list — see
 * `src/default/workspace.tsx`.
 *
 * ── Why these are RELATIVE paths under the cabinet ─────────────────────────
 *
 * All three are children of the container-owned `account.root` layout route
 * (the `@stapel/listings-react` / `@stapel/gdpr-react` precedent: the cabinet
 * has no module of its own, so the CONTAINER declares that top entry in its
 * `stapel.nav.json`). `resolveNav` DROPS an orphaned submenu entry instead of
 * throwing, so a host with no cabinet gets a smaller menu rather than a broken
 * build.
 *
 * Relative is also the honest spelling: an ABSOLUTE `"/forms"` is byte-for-byte
 * the catalogued `forms_api_v1_forms_create` operation path, and
 * `stapel/no-string-paths` is right to refuse a literal that a reader — or a
 * grep — cannot tell apart from an API call. `search-react` took the same
 * decision for the same reason (`/ranking-disclosure`, not `/ranking`).
 *
 * `forms.builder` and `forms.responses` take `:formId` from the address, which
 * is the `route_params` shape stapel-tools' `NAV_ENTRY_MOUNTS` already knows
 * how to generate a wrapper for. They are navigation TARGETS reached from a
 * row of the list, not menu items — the same treatment `auth.login` and
 * `search.results` get — so `menuVisibleDefault: false` on both.
 *
 * The `labelKey` strings are spelled out rather than imported from
 * `src/i18n/keys.ts`: `gen-nav-manifest.mjs` imports this module with
 * `--experimental-strip-types`, which erases TYPE imports but cannot resolve a
 * runtime `./x.js` specifier back to a `.ts` file. `test/nav.test.ts` asserts
 * every one of them exists in the pair's own bundle, so the literal cannot
 * drift into a key nothing translates.
 *
 * `surface` is declared EXPLICITLY on all three. The derivation
 * `requiresAuth ? "member" : "public"` lands on the same answer today, but the
 * explicit declaration is what a container can rely on: an entry that later
 * gains `requiresAuth` for an unrelated reason must not silently fall out of
 * the tree it was placed in (`core/src/nav.ts`, `navEntrySurface`).
 */
import type { NavEntry } from "@stapel/core";

/** The container-owned cabinet section these three screens hang from.
 * Declared as a constant so the three references cannot drift apart, and
 * exported so a container can assert it against its own override file. */
export const ACCOUNT_ROOT_ID = "account.root";

export const navEntries: readonly NavEntry[] = [
  {
    id: "forms.list",
    labelKey: "forms.nav.list",
    icon: "ProfileOutlined",
    route: { path: "forms" },
    component: { export: "FormsListPane", subpath: "default" },
    placement: { level: "submenu", parentId: ACCOUNT_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 60,
  },
  {
    id: "forms.builder",
    labelKey: "forms.nav.builder",
    icon: "AppstoreOutlined",
    route: { path: "forms/:formId" },
    component: { export: "FormBuilderPane", subpath: "default" },
    placement: { level: "submenu", parentId: ACCOUNT_ROOT_ID },
    menuVisibleDefault: false,
    requiresAuth: true,
    surface: "member",
    order: 61,
  },
  {
    id: "forms.responses",
    labelKey: "forms.nav.responses",
    icon: "OrderedListOutlined",
    route: { path: "forms/:formId/responses" },
    component: { export: "ResponsesPane", subpath: "default" },
    placement: { level: "submenu", parentId: ACCOUNT_ROOT_ID },
    menuVisibleDefault: false,
    requiresAuth: true,
    surface: "member",
    order: 62,
  },
];
