/**
 * `resolveNav` — the single source of nav truth (scripted-fullstack
 * navigation, Ф1 lib-side core, owner directive: one scripted command with
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
 *     `false`. A top entry that resolves invisible drops its entire
 *     subtree — a child cannot render nested under a parent that isn't in
 *     the menu at all.
 */
import type { NavComponentRef, NavRoute, PackageNavManifest } from "@stapel/core";

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

/** A `NavEntry` after override resolution and (for a top-level entry with
 * nested submenu children) tree assembly. */
export interface ResolvedNavEntry {
  readonly id: string;
  readonly labelKey: string;
  readonly icon: string;
  readonly route: NavRoute;
  readonly component: NavComponentRef;
  readonly requiresAuth: boolean;
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
    order: o?.order ?? entry.order,
    menuVisible: o?.menuVisible ?? entry.menuVisibleDefault,
  };
}

function byOrderThenId(a: { order: number; id: string }, b: { order: number; id: string }): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}

export function resolveNav(
  installed: readonly PackageNavManifest[],
  overridesFile?: NavOverridesFile
): readonly ResolvedNavEntry[] {
  const overrides = overridesFile?.overrides ?? {};
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
    if (!top.menuVisible) continue;
    const kids = childrenByParent.get(top.id);
    if (kids === undefined) {
      result.push(top);
      continue;
    }
    const visibleKids = kids.filter((k) => k.menuVisible).sort(byOrderThenId);
    result.push({ ...top, children: visibleKids });
  }

  return result;
}
