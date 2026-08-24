/**
 * `resolveNav` — the single source of nav truth (scripted-fullstack
 * navigation, Phase 1 lib-side core, owner directive: one scripted command with
 * NO LLM produces a working navigated fullstack). PURE: no React, no I/O, no
 * globals — takes the installed packages' nav manifests (`@stapel/core`'s
 * `PackageNavManifest[]`, e.g. the root `nav-manifest.json` a host's
 * `dependencies` produce via `pnpm gen:nav`) plus an optional project
 * override file, and returns the tree a shell renders.
 *
 * Runs at exactly two call sites with the EXACT SAME function — that duality
 * is the whole point of keeping this pure and serializable:
 *  1. scaffold codegen time — bakes a default `stapel.nav.json` from the
 *     manifests present at generation.
 *  2. shipped-app runtime — `@stapel/shell-react`'s `<AppShell/>` calls this
 *     again with the project's live override file, so a host can flip
 *     `menuVisible`/`order` without touching generated code.
 *
 * Algorithm (deterministic, documented — not incidental):
 *  1. Flatten every installed package's `entries` into one list.
 *  2. Resolve each entry's `menuVisible` (override ?? `menuVisibleDefault`)
 *     and `order` (override ?? `order`).
 *  3. Nest: a `placement.level === "submenu"` entry attaches under the
 *     resolved TOP entry whose `id === placement.parentId`. A submenu entry
 *     whose parent is absent from the installed set (e.g. the parent's
 *     package isn't installed) is DROPPED — logged nowhere, thrown nowhere;
 *     this is documented degrade-gracefully behavior, not a bug. The ONE
 *     exception is {@link ADMIN_ROOT_ID}: no module owns "the admin
 *     section", so nothing declares it and every staff screen hung from it
 *     used to vanish. It is synthesised here instead (see
 *     {@link ADMIN_ROOT_ENTRY}).
 *  4. Address: `route.index` says an entry mounts at its SECTION's address
 *     rather than at a segment of its own, so the resolved entry carries a
 *     {@link ResolvedNavEntry.linkPath} a renderer links to and matches the
 *     location against — the field the manifest emitted and nothing read.
 *  5. Sort: top entries by `(order, id)`; each parent's children by the
 *     same `(order, id)` — the `id` tiebreak keeps output deterministic
 *     when two entries share an `order`.
 *  6. Filter: drop any entry (top or child) whose resolved `menuVisible` is
 *     `false`, whose `surface` is closed to the caller's `audience`, or
 *     whose `requiresAuth` is closed to the caller's session (see
 *     {@link ResolveNavOptions}). A top entry that drops takes its entire
 *     subtree with it — a child cannot render nested under a parent that
 *     isn't in the menu at all.
 *
 * What is deliberately NOT filtered here is the STAFF axis. The admin
 * section is listed for everyone and refuses by name (the reason lives
 * beside the entry — `<AppShell staff={…}/>`, `adminNavIds`): a menu entry
 * that vanishes teaches nobody that the screen exists, and a person who
 * cannot see it cannot ask for access to it.
 */
import { navEntrySurface, navSurfaceVisibleTo } from "@stapel/core";
import type {
  MandatePrincipal,
  NavComponentRef,
  NavEntry,
  NavRoute,
  NavSurface,
  PackageNavManifest,
} from "@stapel/core";

/**
 * The parent id of "the admin section" — the staff area every module hangs
 * its own operator screen from (`@stapel/gdpr-react`'s DSAR queue,
 * `@stapel/video-react`'s usage table) and that NO module owns, because
 * "admin" is not a feature: it is where the features a person operates the
 * product with are collected.
 *
 * Nobody declared it, so `resolveNav`'s orphan-drop removed every screen
 * that named it, in every host, with no log — two real staff screens gone
 * (shared-layer audit Q3/G5). {@link resolveNav} therefore SYNTHESISES the
 * parent when at least one installed entry asks for it, the same way the
 * generated container synthesises it for the route tree. A host that wants
 * its own admin root simply declares an entry with this id and the
 * synthetic one steps aside.
 */
export const ADMIN_ROOT_ID = "admin.root";

/**
 * The synthetic {@link ADMIN_ROOT_ID} top entry, byte-for-byte the shape the
 * generated container declares (`stapel-tools`'
 * `_frontend_templates.MONOLITH_CONTAINER_ROOTS["admin.root"]`) so a
 * scaffolded host and a hand-wired one draw the same section: same label
 * key, same icon, same address, same order.
 *
 * `component` names the section page a host mounts at that address. The
 * shell mounts no routes, so this is data for the host's route builder — a
 * host with no such component simply gets a section whose own address is
 * empty and whose children carry the screens.
 */
export const ADMIN_ROOT_ENTRY: NavEntry = {
  id: ADMIN_ROOT_ID,
  labelKey: "shell.nav.admin",
  icon: "AuditOutlined",
  route: { path: "admin" },
  component: { export: "AdminSection", subpath: "." },
  placement: { level: "top" },
  menuVisibleDefault: true,
  requiresAuth: true,
  surface: "member",
  order: 110,
};

/** One entry's override in a project's nav-override file. */
export interface NavOverrideEntry {
  readonly menuVisible?: boolean;
  readonly order?: number;
}

/**
 * The project override file's shape (conventionally `stapel.nav.json`):
 * per-entry-id overrides, keyed by `NavEntry.id`. The outer `overrides` key
 * (rather than the record living at the top level) leaves room for sibling
 * top-level keys in a future revision without a breaking shape change.
 */
export interface NavOverridesFile {
  readonly overrides?: Record<string, NavOverrideEntry>;
}

/**
 * Who the tree is being resolved FOR.
 *
 * Omit `audience` and nothing is filtered by surface — the scaffold-codegen
 * call site, which bakes every route a project could ever mount, and every
 * existing runtime caller, which keeps its exact behaviour.
 *
 * Pass one and a screen whose `surface` is closed to that principal is
 * dropped — menu entry AND, since the same resolved tree is what a host
 * mounts routes from, the screen itself. That is the fix for the defect this
 * axis exists for: a mandate-less person was handed every module's entry and
 * every one of those screens answered 403.
 *
 * The type is a {@link MandatePrincipal}, so `"unresolved"` cannot be passed.
 * A host whose mandate has not settled must render the wait or the outage
 * (`matchMandate`) instead of resolving a nav for it — the alternative is a
 * menu that quietly empties whenever the backend hiccups, which is "we could
 * not ask" rendered as "you may not".
 */
export interface ResolveNavOptions {
  readonly audience?: MandatePrincipal;
  /**
   * Whether the caller holds a SESSION — the axis `NavEntry.requiresAuth`
   * states, and the one nothing read.
   *
   * `surface` and `requiresAuth` are not the same question. `auth.qr_confirm`
   * is `surface: "public"` (no mandate needed — a phone confirming a
   * signed-out desktop) and `requiresAuth: true` (a session is), so the
   * audience filter alone hands it to an anonymous visitor, who is then
   * bounced to `/login` by the route guard. A door that opens onto a
   * redirect is the same defect as a door that answers 403.
   *
   * Omit it and nothing is filtered on this axis — the scaffold-codegen call
   * site, which bakes every route a project could ever mount, and every
   * caller written before the axis was read. Pass `false` and every
   * `requiresAuth` entry drops.
   */
  readonly authenticated?: boolean;
}

/** A `NavEntry` after override resolution and (for a top-level entry with
 * nested submenu children) tree assembly. */
export interface ResolvedNavEntry {
  readonly id: string;
  readonly labelKey: string;
  readonly icon: string;
  readonly route: NavRoute;
  /**
   * The address a renderer links to, and matches the browser's location
   * against. `route.path` for an ordinary entry; for an `route.index` entry
   * nested in a section, the SECTION's path — an index route mounts at its
   * parent's address, so linking to a segment of its own would land on a
   * route that does not exist.
   *
   * Resolved here rather than in each renderer because `route.index` was the
   * one manifest field nothing read: `resolveNav` copied `route` opaque and
   * the menu's matcher ignored it, so an index screen was permanently
   * unreachable and permanently unselected (shared-layer audit Q3).
   */
  readonly linkPath: string;
  /** Resolved `route.index` — `false` when the manifest omits it, so a
   * renderer reads one shape instead of `boolean | undefined`. */
  readonly index: boolean;
  readonly component: NavComponentRef;
  readonly requiresAuth: boolean;
  /** Resolved surface — declared, or derived from `requiresAuth`. Always
   * present here even though `NavEntry.surface` is optional, so a renderer
   * or a route guard reads the axis without repeating the derivation. */
  readonly surface: NavSurface;
  /** Resolved order (override applied). */
  readonly order: number;
  /** Resolved visibility (override applied). Every entry `resolveNav`
   * RETURNS has already been filtered to `menuVisible === true` — the field
   * stays on the type because a caller that wants the pre-filter view can
   * still inspect it before `resolveNav` drops the entry (e.g. an admin
   * "show hidden nav entries" screen doing its own resolution pass). */
  readonly menuVisible: boolean;
  /** Nested `placement.level === "submenu"` entries whose `parentId`
   * resolved to this entry. Present (possibly empty) only on entries that
   * had at least one submenu entry target them before filtering; absent
   * otherwise — so `"children" in entry` doubles as "this can host a
   * SubMenu" for a renderer. */
  readonly children?: readonly ResolvedNavEntry[];
}

function resolveOne(
  entry: NavEntry,
  overrides: Record<string, NavOverrideEntry>,
  /** The section this entry sits in, when it sits in one — an index entry
   * takes its address from it (see {@link ResolvedNavEntry.linkPath}). */
  section?: NavEntry
): ResolvedNavEntry {
  const o = overrides[entry.id];
  const index = entry.route.index === true;
  return {
    id: entry.id,
    labelKey: entry.labelKey,
    icon: entry.icon,
    route: entry.route,
    linkPath: index && section !== undefined ? section.route.path : entry.route.path,
    index,
    component: entry.component,
    requiresAuth: entry.requiresAuth,
    surface: navEntrySurface(entry),
    order: o?.order ?? entry.order,
    menuVisible: o?.menuVisible ?? entry.menuVisibleDefault,
  };
}

/**
 * The installed entries plus the {@link ADMIN_ROOT_ENTRY} when something
 * needs it: at least one entry hangs from {@link ADMIN_ROOT_ID} and no
 * installed package declares it. Returns the input untouched otherwise, so a
 * project with no staff screen never grows an empty "Admin" tab and a
 * project that declares its own root keeps it.
 */
function withAdminRoot(all: readonly NavEntry[]): readonly NavEntry[] {
  const wanted = all.some(
    (e) => e.placement.level === "submenu" && e.placement.parentId === ADMIN_ROOT_ID
  );
  if (!wanted) return all;
  if (all.some((e) => e.id === ADMIN_ROOT_ID)) return all;
  return [...all, ADMIN_ROOT_ENTRY];
}

function byOrderThenId(a: { order: number; id: string }, b: { order: number; id: string }): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}

export function resolveNav(
  installed: readonly PackageNavManifest[],
  overridesFile?: NavOverridesFile,
  options?: ResolveNavOptions
): readonly ResolvedNavEntry[] {
  const overrides = overridesFile?.overrides ?? {};
  const audience = options?.audience;
  const authenticated = options?.authenticated;
  /** The surface + session gate. A project's override file can flip
   * `menuVisible` and `order`; it deliberately cannot flip this — a
   * per-project preference must not be able to put a screen that will refuse
   * the caller back in front of them. */
  const openTo = (e: ResolvedNavEntry): boolean => {
    if (audience !== undefined && !navSurfaceVisibleTo(e.surface, audience)) return false;
    return !(authenticated === false && e.requiresAuth);
  };
  const all = withAdminRoot(installed.flatMap((m) => m.entries));

  const topSources = new Map<string, NavEntry>();
  const tops = new Map<string, ResolvedNavEntry>();
  for (const entry of all) {
    if (entry.placement.level === "top") {
      topSources.set(entry.id, entry);
      tops.set(entry.id, resolveOne(entry, overrides));
    }
  }

  const childrenByParent = new Map<string, ResolvedNavEntry[]>();
  for (const entry of all) {
    if (entry.placement.level !== "submenu") continue;
    const parentId = entry.placement.parentId;
    const section = parentId === undefined ? undefined : topSources.get(parentId);
    if (parentId === undefined || section === undefined) continue; // orphan — dropped, not thrown
    const resolved = resolveOne(entry, overrides, section);
    const bucket = childrenByParent.get(parentId);
    if (bucket) bucket.push(resolved);
    else childrenByParent.set(parentId, [resolved]);
  }

  const result: ResolvedNavEntry[] = [];
  for (const top of [...tops.values()].sort(byOrderThenId)) {
    if (!top.menuVisible || !openTo(top)) continue;
    const kids = childrenByParent.get(top.id);
    if (kids === undefined) {
      result.push(top);
      continue;
    }
    const visibleKids = kids.filter((k) => k.menuVisible && openTo(k)).sort(byOrderThenId);
    result.push({ ...top, children: visibleKids });
  }

  return result;
}

/**
 * The ids that make up the admin section of an already-resolved tree: the
 * {@link ADMIN_ROOT_ID} entry and every screen nested under it. Empty when
 * the tree carries no admin section at all.
 *
 * This is the input to the STAFF gate, which is a rendering decision and not
 * a resolution one: the section stays in the menu for everyone and states
 * that it is staff-only beside itself (`<AppShell staff={…}/>`). Hiding it
 * would leave a person who needs access with nothing to point at, and would
 * put the answer in a second place from the container's own `AdminGate`,
 * which refuses by name on the screen itself.
 */
export function adminNavIds(nav: readonly ResolvedNavEntry[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const entry of nav) {
    if (entry.id !== ADMIN_ROOT_ID) continue;
    ids.add(entry.id);
    for (const child of entry.children ?? []) ids.add(child.id);
  }
  return ids;
}

/**
 * `resolveNav` for an ANONYMOUS visitor — the public storefront's tree.
 *
 * This exists because `audience` is optional and its default does not
 * protect: omit it and nothing is filtered, so a public container that forgot
 * the option mounts every `member` screen and every one of them answers 403.
 * The default has to stay permissive (the scaffold-codegen call site bakes
 * every route a project could mount), which means the fix cannot be a changed
 * default — it has to be a call you cannot make wrong. These two wrappers are
 * that: the audience is in the NAME, so there is nothing to forget.
 */
export function resolvePublicNav(
  installed: readonly PackageNavManifest[],
  overridesFile?: NavOverridesFile
): readonly ResolvedNavEntry[] {
  return resolveNav(installed, overridesFile, {
    audience: "anonymous",
    // An anonymous visitor has no session either, so a `requiresAuth` screen
    // is a door that opens onto the sign-in redirect. The storefront's own
    // door to a session is the sign-in CTA `PublicShell` always renders.
    authenticated: false,
  });
}

/** `resolveNav` for a settled MEMBER mandate — the signed-in tree. See
 * {@link resolvePublicNav} for why the audience is spelled in the name.
 *
 * There is deliberately no `resolveGuestNav`: `"guest"` is a principal a host
 * may hold, and `navSurfaceVisibleTo` already answers for it — a caller with
 * a guest mandate passes it to `resolveNav` explicitly, which is the honest
 * spelling for the case where the answer is "the public tree, and here is
 * why". */
export function resolveMemberNav(
  installed: readonly PackageNavManifest[],
  overridesFile?: NavOverridesFile
): readonly ResolvedNavEntry[] {
  return resolveNav(installed, overridesFile, { audience: "member", authenticated: true });
}
