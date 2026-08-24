/**
 * Shared harness for the shell-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * colours, no raw dimensions, no hardcoded prose.
 *
 * What a shell needs to be demoed at all is unusual, and it is all here:
 *
 *  - a ROUTER. `AppShell`/`PublicShell` place a react-router `<Outlet/>` and
 *    their menu navigates through `<Link>`; without a router around them
 *    there is no shell, only a crash. `MemoryRouter` + a route tree whose
 *    children are labelled stand-ins is the smallest honest frame.
 *  - an i18n engine carrying the shell's OWN chrome copy plus the label keys
 *    the fixture nav declares. Menu labels belong to the pairs that own the
 *    screens, so a demo has to play the part of those pairs.
 *  - NO session, no query client, no mandate: the shells read none of those,
 *    by design, and a harness that provided them would be demoing a component
 *    that does not exist.
 *
 * The theme frame is the viewer's job (`data-theme` + tokens.css), and both
 * shells now follow it through `SkinTheme` — which is why no variant here
 * passes a `mode`.
 */
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { I18nProvider, createI18n } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { ADMIN_ROOT_ID, resolveNav } from "../src/index.js";
import type { ResolvedNavEntry } from "../src/index.js";
import { registerShellI18n } from "../src/i18n/keys.js";
import type { NavEntry, PackageNavManifest } from "@stapel/core";

/** Demo-local copy — a `demo.*` (unmanaged) namespace, so `i18n-key-exists`
 * treats it as app-local and never false-positives. The nav LABELS use each
 * pair's real key, because that is what a host registers. */
const demoBundleEn: Record<string, string> = {
  "demo.page.settings": "Whatever the host routed here",
  "demo.page.admin": "A staff screen a module contributed",
  "demo.brand": "Acme",
  "demo.search": "Search the catalogue",
  "demo.categories": "Cars · Homes · Jobs",
  "demo.footer": "How results are ranked",
  "demo.account": "Signed in as Dana",
  "profiles.nav.settings": "Settings",
  "auth.nav.security": "Security",
  "notifications.nav.feed": "Notifications",
  "search.nav.results": "Search",
  "listings.nav.compose": "Post an ad",
  "gdpr.nav.admin": "Privacy requests",
  "video.nav.admin": "Video usage",
};

function entry(overrides: Partial<NavEntry> & Pick<NavEntry, "id">): NavEntry {
  return {
    labelKey: `${overrides.id}.label`,
    icon: "AppstoreOutlined",
    route: { path: overrides.id },
    component: { export: "Component", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    order: 0,
    ...overrides,
  };
}

function manifest(pkg: string, entries: readonly NavEntry[]): PackageNavManifest {
  return { package: pkg, version: "1.0.0", entries };
}

/**
 * The member tree a small product produces: two module screens, one nested
 * submenu, and — because two modules hang a staff screen off a parent nobody
 * owns — the synthesised admin section.
 */
export const MEMBER_NAV: readonly ResolvedNavEntry[] = resolveNav([
  manifest("@stapel/profiles", [
    entry({
      id: "profiles.settings",
      labelKey: "profiles.nav.settings",
      icon: "UserOutlined",
      route: { path: "settings" },
      order: 90,
    }),
  ]),
  manifest("@stapel/auth", [
    entry({
      id: "auth.security",
      labelKey: "auth.nav.security",
      icon: "SafetyCertificateOutlined",
      route: { path: "security" },
      placement: { level: "submenu", parentId: "profiles.settings" },
      order: 10,
    }),
  ]),
  manifest("@stapel/notifications", [
    entry({
      id: "notifications.feed",
      labelKey: "notifications.nav.feed",
      icon: "BellOutlined",
      route: { path: "notifications" },
      order: 20,
    }),
  ]),
  manifest("@stapel/gdpr", [
    entry({
      id: "admin.privacy",
      labelKey: "gdpr.nav.admin",
      icon: "AuditOutlined",
      route: { path: "privacy" },
      placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
      order: 10,
    }),
  ]),
  manifest("@stapel/video", [
    entry({
      id: "admin.usage",
      labelKey: "video.nav.admin",
      icon: "ClockCircleOutlined",
      route: { path: "usage" },
      placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
      order: 20,
    }),
  ]),
]);

/** The tree a storefront resolves for an anonymous visitor. */
export const PUBLIC_NAV: readonly ResolvedNavEntry[] = resolveNav([
  manifest("@stapel/search", [
    entry({
      id: "search.results",
      labelKey: "search.nav.results",
      icon: "SearchOutlined",
      route: { path: "/s" },
      requiresAuth: false,
      order: 10,
    }),
  ]),
  manifest("@stapel/categories", [
    entry({
      id: "categories.browse",
      labelKey: "search.nav.results",
      icon: "TagOutlined",
      route: { path: "/c" },
      requiresAuth: false,
      menuVisibleDefault: false,
      order: 20,
    }),
  ]),
]);

/** i18n frame with the shell's own copy and the fixture pairs' labels. */
function demoI18n(): ReturnType<typeof createI18n> {
  const engine = createI18n({ locale: "en" });
  registerShellI18n(engine);
  engine.registerBundle("en", demoBundleEn);
  return engine;
}

const pageStyle = {
  padding: spacing["5"],
  borderRadius: radii.lg,
  border: `1px dashed ${cssVar("border-subtle")}`,
  color: cssVar("text-muted"),
  fontSize: fontSize.md.fontSize,
} as const;

/** A labelled stand-in for whatever the host routes into the `<Outlet/>`. */
export function DemoPage(props: { labelKey: string }): ReactElement {
  const engine = demoI18n();
  return <div style={pageStyle}>{engine.t(props.labelKey)}</div>;
}

/**
 * Mount a shell as a react-router LAYOUT route, which is the only way it is
 * ever used: the shell renders the `<Outlet/>`, the host nests the real
 * screens inside it.
 */
export function ShellFrame(props: {
  shell: ReactElement;
  initialPath: string;
  routes: readonly { readonly path: string; readonly labelKey: string }[];
  children?: ReactNode;
}): ReactElement {
  return (
    <I18nProvider i18n={demoI18n()}>
      <MemoryRouter initialEntries={[props.initialPath]}>
        <Routes>
          <Route element={props.shell}>
            {props.routes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={<DemoPage labelKey={route.labelKey} />}
              />
            ))}
          </Route>
        </Routes>
      </MemoryRouter>
      {props.children}
    </I18nProvider>
  );
}
