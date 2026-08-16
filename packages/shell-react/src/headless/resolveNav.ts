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
 *     this is documented degrade-gracefully behavior, not a bug.
 *  4. Sort: top entries by `(order, id)`; each parent's children by the
 *     same `(order, id)` — the `id` tiebreak keeps output deterministic
 *     when two entries share an `order`.
 *  5. Filter: drop any entry (top or child) whose resolved `menuVisible` is
 *     `false`, or whose `surface` is closed to the caller's `audience` (see
 *     {@link ResolveNavOptions}). A top entry that drops takes its entire
 *     subtree with it — a child cannot render nested under a parent that
 *     isn't in the menu at all.
 */
import { navEntrySurface, navSurfaceVisibleTo } from "@stapel/core";
import type {
  MandatePrincipal,
  NavComponentRef,
  NavRoute,
  NavSurface,
  PackageNavManifest,
} from "@stapel/core";

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
}

/** A `NavEntry` after override resolution and (for a top-level entry with
 * nested submenu children) tree assembly. */
export interface ResolvedNavEntry {
  readonly id: string;
  readonly labelKey: string;
  readonly icon: string;
  readonly route: NavRoute;
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
  entry: PackageNavManifest["entries"][number],
  overrides: Record<string, NavOverrideEntry>
): ResolvedNavEntry {
  const o = overrides[entry.id];
  return {
    id: entry.id,
    labelKey: entry.labelKey,
    icon: entry.icon,
    route: entry.route,
    component: entry.component,
    requiresAuth: entry.requiresAuth,
    surface: navEntrySurface(entry),
    order: o?.order ?? entry.order,
    menuVisible: o?.menuVisible ?? entry.menuVisibleDefault,
  };
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
  /** The surface gate. A project's override file can flip `menuVisible` and
   * `order`; it deliberately cannot flip this — a per-project preference must
   * not be able to put a screen that will refuse the caller back in front of
   * them. */
  const openToAudience = (e: ResolvedNavEntry): boolean =>
    audience === undefined || navSurfaceVisibleTo(e.surface, audience);
  const all = installed.flatMap((m) => m.entries);

  const tops = new Map<string, ResolvedNavEntry>();
  for (const entry of all) {
    if (entry.placement.level === "top") {
      tops.set(entry.id, resolveOne(entry, overrides));
    }
  }

  const childrenByParent = new Map<string, ResolvedNavEntry[]>();
  for (const entry of all) {
    if (entry.placement.level !== "submenu") continue;
    const parentId = entry.placement.parentId;
    if (parentId === undefined || !tops.has(parentId)) continue; // orphan — dropped, not thrown
    const resolved = resolveOne(entry, overrides);
    const bucket = childrenByParent.get(parentId);
    if (bucket) bucket.push(resolved);
    else childrenByParent.set(parentId, [resolved]);
  }

  const result: ResolvedNavEntry[] = [];
  for (const top of [...tops.values()].sort(byOrderThenId)) {
    if (!top.menuVisible || !openToAudience(top)) continue;
    const kids = childrenByParent.get(top.id);
    if (kids === undefined) {
      result.push(top);
      continue;
    }
    const visibleKids = kids
      .filter((k) => k.menuVisible && openToAudience(k))
      .sort(byOrderThenId);
    result.push({ ...top, children: visibleKids });
  }

  return result;
}
