/**
 * Navigation-manifest contract (scripted-fullstack navigation, Ф1 lib-side
 * core): the shared shape every `@stapel/<module>-react` pair's
 * `src/nav/manifest.ts` exports, and the shape `@stapel/shell-react`'s
 * `resolveNav` consumes. Lives in `@stapel/core` because it is cross-package
 * — the one place every pair and the shell both already depend on.
 *
 * A pair that owns a screen (a `/default` component worth a menu entry —
 * sign-in, settings, a feed) declares ONE OR MORE `NavEntry` values in its
 * own `src/nav/manifest.ts`. `scripts/gen-nav-manifest.mjs` reads those,
 * validates them against this contract, and emits:
 *  - `packages/<pair>/nav-manifest.json` — that pair's own manifest (the
 *    `./nav-manifest` export subpath points here).
 *  - the root `nav-manifest.json` — every wired pair's manifest, combined.
 *
 * `resolveNav` (see `@stapel/shell-react`) is the SINGLE function that turns
 * an array of `PackageNavManifest` (+ a project's override file) into the
 * tree a shell renders. It runs at two call sites with the exact same code:
 * once at scaffold codegen time (baking a default `stapel.nav.json`) and
 * once at runtime in the shipped app (re-applying the project's overrides) —
 * that duality is why this type is a plain, serializable data contract with
 * no React and no I/O.
 */

/** Where a `NavEntry` renders in the shell's chrome. */
export type NavPlacementLevel = "top" | "submenu";

/** The route this entry mounts at (react-router v7 shape: a path segment
 * relative to the shell's route tree, plus whether it is that segment's
 * index route). */
export interface NavRoute {
  readonly path: string;
  readonly index?: boolean;
}

/** Which component renders this entry, and where it comes from — a named
 * export off a pair's `/default` subpath (never a default export: the
 * scaffold's codegen imports it by name). */
export interface NavComponentRef {
  /** The named export, e.g. `"AuthPanel"`, `"ProfileSettings"`. */
  readonly export: string;
  /** The pair's subpath this export lives on, e.g. `"default"` for
   * `@stapel/auth-react/default`. */
  readonly subpath: string;
}

/** Where in the shell's chrome an entry is placed. */
export interface NavPlacement {
  readonly level: NavPlacementLevel;
  /** Required when `level === "submenu"` — the `id` of the top-level entry
   * (in the SAME or another pair's manifest) this entry nests under.
   * `resolveNav` degrades gracefully (drops the entry, does not throw) when
   * no entry with this id is present among the installed packages. */
  readonly parentId?: string;
}

/**
 * One navigable screen a pair contributes to the shell.
 */
export interface NavEntry {
  /** Globally unique across every installed pair's manifest, conventionally
   * `"<module>.<screen>"` (e.g. `"auth.login"`, `"profiles.settings"`). */
  readonly id: string;
  /** i18n key for the menu label — never a string literal (frontend-standard
   * §4.5's i18n discipline applies to nav labels too). */
  readonly labelKey: string;
  /** Icon name (antd icon component name, e.g. `"SettingOutlined"`) —
   * resolved by the shell's icon registry, not imported here (keeps this
   * contract free of any UI-library dependency). */
  readonly icon: string;
  readonly route: NavRoute;
  readonly component: NavComponentRef;
  readonly placement: NavPlacement;
  /** Whether this entry shows in the menu out of the box. `false` for
   * redirect targets (e.g. the login screen itself is never a menu item) —
   * `resolveNav`'s override file can still flip it on a per-project basis. */
  readonly menuVisibleDefault: boolean;
  /** Whether the shell's router should gate this route behind an
   * authenticated session before mounting the component. */
  readonly requiresAuth: boolean;
  /** Sort key within its placement level (ascending). Ties break on `id`
   * for a deterministic order. */
  readonly order: number;
}

/** A single package's contribution to the nav tree — what
 * `src/nav/manifest.ts` exports, and what `packages/<pair>/nav-manifest.json`
 * (the `./nav-manifest` export subpath) serializes. */
export interface PackageNavManifest {
  /** The npm package name, e.g. `"@stapel/auth-react"`. */
  readonly package: string;
  readonly version: string;
  readonly entries: readonly NavEntry[];
}
