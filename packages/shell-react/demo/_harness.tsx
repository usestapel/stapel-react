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
 *    children are real-looking screens is the smallest honest frame.
 *  - an i18n engine carrying the shell's OWN chrome copy plus the label keys
 *    the fixture nav declares. Menu labels belong to the pairs that own the
 *    screens, so a demo has to play the part of those pairs.
 *  - NO session, no query client, no mandate: the shells read none of those,
 *    by design, and a harness that provided them would be demoing a component
 *    that does not exist.
 *
 * ── The slots are FILLED, and that is the whole point ──────────────────────
 *
 * A shell is the one component that is ONLY chrome, so a demo whose slots
 * hold labelled outlines shows nothing: there is no way to tell whether the
 * chrome works around content it never has to hold. Scaffolding is not
 * product. Every slot here therefore carries the real thing — a brand
 * lockup, a search field, a category strip, an account control, a footer and
 * plausible routed screens: the smallest honest storefront and the smallest
 * honest app.
 *
 * The theme frame is the viewer's job (`data-theme` + tokens.css), and both
 * shells now follow it through `SkinTheme` — which is why no variant here
 * passes a `mode`.
 */
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { Link } from "react-router";
import { Avatar, Card, Flex, Input, Tag, Typography } from "antd";
import { I18nProvider, createI18n, useBreakpoint, useT } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { ADMIN_ROOT_ID, resolveNav } from "../src/index.js";
import type { ResolvedNavEntry } from "../src/index.js";
import { registerShellI18n } from "../src/i18n/keys.js";
import type { NavEntry, PackageNavManifest } from "@stapel/core";

/** Demo-local copy — a `demo.*` (unmanaged) namespace, so `i18n-key-exists`
 * treats it as app-local and never false-positives. The nav LABELS use each
 * pair's real key, because that is what a host registers. */
const demoBundleEn: Record<string, string> = {
  "demo.brand": "Northgate",
  "demo.workspace": "Northgate Market",
  "demo.search.placeholder": "Search 40,000 listings",
  "demo.search.label": "Search the catalogue",
  "demo.categories.label": "Browse by category",
  "demo.categories.cars": "Cars",
  "demo.categories.homes": "Homes",
  "demo.categories.jobs": "Jobs",
  "demo.categories.electronics": "Electronics",
  "demo.account.name": "Dana Whitfield",
  "demo.account.initials": "DW",
  "demo.footer.note": "© 2026 Northgate Market",
  "demo.footer.ranking": "How results are ranked",
  "demo.footer.terms": "Terms",
  "demo.footer.privacy": "Privacy",
  "demo.settings.title": "Account settings",
  "demo.settings.lead": "Your details, and who can see them.",
  "demo.settings.profile": "Profile",
  "demo.settings.profile_name": "Display name",
  "demo.settings.profile_email": "Email",
  "demo.settings.profile_email_value": "dana@northgate.test",
  "demo.settings.visibility": "Visibility",
  "demo.settings.visibility_value": "Anyone with the link",
  "demo.settings.sessions": "Signed-in devices",
  "demo.settings.sessions_lead": "Two devices are signed in to this account.",
  "demo.settings.session_one": "MacBook Pro · Lisbon · active now",
  "demo.settings.session_two": "iPhone 15 · Lisbon · 3 days ago",
  "demo.notifications.title": "Notifications",
  "demo.notifications.lead": "What we've sent you lately.",
  "demo.notifications.one": "Your listing “Vintage road bike” was approved",
  "demo.notifications.one_meta": "2 hours ago",
  "demo.notifications.two": "Priya sent you a message about “Oak dining table”",
  "demo.notifications.two_meta": "Yesterday",
  "demo.admin.title": "Privacy requests",
  "demo.admin.lead": "Erasure and export requests waiting on an operator.",
  "demo.admin.one": "Export · account 4821 · due in 6 days",
  "demo.admin.two": "Erasure · account 5507 · due in 12 days",
  "demo.results.title": "Bikes in Lisbon",
  "demo.results.lead": "128 listings, newest first.",
  "demo.results.one": "Vintage road bike, 56 cm",
  "demo.results.one_meta": "Lisbon · listed today",
  "demo.results.one_price": "€240",
  "demo.results.two": "Kids' balance bike",
  "demo.results.two_meta": "Almada · listed yesterday",
  "demo.results.two_price": "€45",
  "demo.results.three": "Cargo bike with electric assist",
  "demo.results.three_meta": "Cascais · listed 2 days ago",
  "demo.results.three_price": "€1,150",
  "demo.tag.new": "New",
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

// ── the chrome slots, filled ────────────────────────────────────────────────

/**
 * The brand lockup a host passes as `logo`/`brand`: a mark and a wordmark,
 * drawn in `currentColor`-free token colours so it reads on either side of the
 * theme. Inline SVG rather than an asset — a demo that needed a file to be
 * copied somewhere is a demo that stops working.
 */
export function Brand(): ReactElement {
  const t = useT();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing[2],
        minWidth: 0,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28" role="img" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill={cssVar("brand")} />
        <path
          d="M8 19.5V11l6-4 6 4v8.5h-4.5V15h-3v4.5z"
          fill={cssVar("text-on-accent")}
        />
      </svg>
      <span
        style={{
          fontSize: fontSize.lg.fontSize,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: cssVar("text"),
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {t("demo.brand")}
      </span>
    </span>
  );
}

/** The storefront's search box — the control the whole header exists around. */
export function SearchField(): ReactElement {
  const t = useT();
  return (
    <Input.Search
      allowClear
      enterButton
      aria-label={t("demo.search.label")}
      placeholder={t("demo.search.placeholder")}
      style={{ maxWidth: 560 }}
    />
  );
}

const CATEGORY_KEYS = [
  "demo.categories.cars",
  "demo.categories.homes",
  "demo.categories.jobs",
  "demo.categories.electronics",
] as const;

/** The category strip under the top bar: real links, not a comma-joined
 * sentence pretending to be navigation. */
export function CategoryStrip(): ReactElement {
  const t = useT();
  return (
    <nav
      aria-label={t("demo.categories.label")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[5],
        flexWrap: "wrap",
        paddingBlock: spacing[3],
      }}
    >
      {CATEGORY_KEYS.map((key) => (
        <Link
          key={key}
          to="/s"
          style={{ color: cssVar("text-muted"), whiteSpace: "nowrap" }}
        >
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}

/** A signed-in person's account control: a monogram and a name, and on a
 * phone the monogram alone — the name is the first thing a 390px header can
 * afford to lose, and the last thing the account control can. */
export function AccountControl(): ReactElement {
  const t = useT();
  const isDesktop = useBreakpoint() === "desktop";
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: spacing[2] }}
    >
      <Avatar
        size={32}
        style={{
          background: cssVar("brand-subtle"),
          color: cssVar("brand"),
          fontWeight: 600,
        }}
      >
        {t("demo.account.initials")}
      </Avatar>
      {isDesktop && (
        <span style={{ color: cssVar("text"), whiteSpace: "nowrap" }}>
          {t("demo.account.name")}
        </span>
      )}
    </span>
  );
}

/** The storefront footer: the ranking disclosure among the lines that belong
 * beside it, rather than one link marooned at the bottom of a blank page. */
export function StorefrontFooter(): ReactElement {
  const t = useT();
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing[4],
        fontSize: fontSize.sm.fontSize,
      }}
    >
      <span style={{ color: cssVar("text-muted") }}>{t("demo.footer.note")}</span>
      <span style={{ display: "flex", flexWrap: "wrap", gap: spacing[4] }}>
        <Link to="/s">{t("demo.footer.ranking")}</Link>
        <Link to="/s">{t("demo.footer.terms")}</Link>
        <Link to="/s">{t("demo.footer.privacy")}</Link>
      </span>
    </div>
  );
}

// ── the routed screens ──────────────────────────────────────────────────────

/** Heading + lead: the two lines every screen inside a shell opens with. */
function PageHeading(props: { titleKey: string; leadKey: string }): ReactElement {
  const t = useT();
  return (
    <div style={{ marginBlockEnd: spacing[4] }}>
      <Typography.Title level={2} style={{ marginBlockEnd: spacing[1] }}>
        {t(props.titleKey)}
      </Typography.Title>
      <Typography.Text type="secondary">{t(props.leadKey)}</Typography.Text>
    </div>
  );
}

/** A label/value row — the shape a settings screen is mostly made of. */
function Field(props: { labelKey: string; valueKey: string }): ReactElement {
  const t = useT();
  return (
    <Flex justify="space-between" gap={spacing[4]} wrap>
      <Typography.Text type="secondary">{t(props.labelKey)}</Typography.Text>
      <Typography.Text strong>{t(props.valueKey)}</Typography.Text>
    </Flex>
  );
}

/** The signed-in screen the app shell frames. */
export function SettingsScreen(): ReactElement {
  const t = useT();
  return (
    <div>
      <PageHeading titleKey="demo.settings.title" leadKey="demo.settings.lead" />
      <Flex vertical gap={spacing[4]}>
        <Card title={t("demo.settings.profile")} size="small">
          <Flex vertical gap={spacing[3]}>
            <Field
              labelKey="demo.settings.profile_name"
              valueKey="demo.account.name"
            />
            <Field
              labelKey="demo.settings.profile_email"
              valueKey="demo.settings.profile_email_value"
            />
            <Field
              labelKey="demo.settings.visibility"
              valueKey="demo.settings.visibility_value"
            />
          </Flex>
        </Card>
        <Card title={t("demo.settings.sessions")} size="small">
          <Flex vertical gap={spacing[2]}>
            <Typography.Text type="secondary">
              {t("demo.settings.sessions_lead")}
            </Typography.Text>
            <Typography.Text>{t("demo.settings.session_one")}</Typography.Text>
            <Typography.Text>{t("demo.settings.session_two")}</Typography.Text>
          </Flex>
        </Card>
      </Flex>
    </div>
  );
}

/** A short feed — the second signed-in screen, so navigating between menu
 * entries visibly changes the page and not only the selected row. */
export function NotificationsScreen(): ReactElement {
  const t = useT();
  return (
    <div>
      <PageHeading
        titleKey="demo.notifications.title"
        leadKey="demo.notifications.lead"
      />
      <Flex vertical gap={spacing[3]}>
        <Card size="small">
          <Typography.Text strong>{t("demo.notifications.one")}</Typography.Text>
          <div>
            <Typography.Text type="secondary">
              {t("demo.notifications.one_meta")}
            </Typography.Text>
          </div>
        </Card>
        <Card size="small">
          <Typography.Text strong>{t("demo.notifications.two")}</Typography.Text>
          <div>
            <Typography.Text type="secondary">
              {t("demo.notifications.two_meta")}
            </Typography.Text>
          </div>
        </Card>
      </Flex>
    </div>
  );
}

/** The staff screen behind the synthesised admin section. */
export function AdminScreen(): ReactElement {
  const t = useT();
  return (
    <div>
      <PageHeading titleKey="demo.admin.title" leadKey="demo.admin.lead" />
      <Flex vertical gap={spacing[3]}>
        <Card size="small">
          <Typography.Text>{t("demo.admin.one")}</Typography.Text>
        </Card>
        <Card size="small">
          <Typography.Text>{t("demo.admin.two")}</Typography.Text>
        </Card>
      </Flex>
    </div>
  );
}

const RESULTS = [
  {
    titleKey: "demo.results.one",
    metaKey: "demo.results.one_meta",
    priceKey: "demo.results.one_price",
    fresh: true,
  },
  {
    titleKey: "demo.results.two",
    metaKey: "demo.results.two_meta",
    priceKey: "demo.results.two_price",
    fresh: false,
  },
  {
    titleKey: "demo.results.three",
    metaKey: "demo.results.three_meta",
    priceKey: "demo.results.three_price",
    fresh: false,
  },
] as const;

/** The storefront screen the public shell frames — a result list, which is
 * what a marketplace's measured content column is FOR. */
export function ResultsScreen(): ReactElement {
  const t = useT();
  return (
    <div>
      <PageHeading titleKey="demo.results.title" leadKey="demo.results.lead" />
      <Flex vertical gap={spacing[3]}>
        {RESULTS.map((result) => (
          <Card key={result.titleKey} size="small" style={{ borderRadius: radii.lg }}>
            <Flex align="center" justify="space-between" gap={spacing[4]} wrap>
              <div style={{ minWidth: 0 }}>
                <Flex align="center" gap={spacing[2]} wrap>
                  <Typography.Text strong>{t(result.titleKey)}</Typography.Text>
                  {result.fresh && <Tag color="blue">{t("demo.tag.new")}</Tag>}
                </Flex>
                <div>
                  <Typography.Text type="secondary">
                    {t(result.metaKey)}
                  </Typography.Text>
                </div>
              </div>
              <Typography.Text strong style={{ fontSize: fontSize.lg.fontSize }}>
                {t(result.priceKey)}
              </Typography.Text>
            </Flex>
          </Card>
        ))}
      </Flex>
    </div>
  );
}

/**
 * Mount a shell as a react-router LAYOUT route, which is the only way it is
 * ever used: the shell renders the `<Outlet/>`, the host nests the real
 * screens inside it.
 */
export function ShellFrame(props: {
  shell: ReactElement;
  initialPath: string;
  routes: readonly { readonly path: string; readonly element: ReactNode }[];
  children?: ReactNode;
}): ReactElement {
  return (
    <I18nProvider i18n={demoI18n()}>
      <MemoryRouter initialEntries={[props.initialPath]}>
        <Routes>
          <Route element={props.shell}>
            {props.routes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Route>
        </Routes>
      </MemoryRouter>
      {props.children}
    </I18nProvider>
  );
}
