---
"@stapel/tokens-antd": minor
---

`SkinTheme` stops charging per instance, and the design-system scale rides the edge a skin already declares.

**The cost.** `forms-react` reported its one full-skin test going ~1.8s → past vitest's 30s default on migrating to `SkinTheme`, and guessed the antd theme scope was being regenerated every render. It was not the renders — the memo was already there — it was the boundary: the memo was per COMPONENT, so ten skinned parts on a screen built ten deep-equal-but-distinct `ThemeConfig` objects (fifteen `getComputedStyle` reads each), and a list whose rows wrap themselves built one per row. Every distinct config is a fresh antd `ConfigProvider`, measured at ~9ms of mount apiece in jsdom. The doctrine tells pairs that "parts may wrap themselves AND be wrapped" costs nothing extra, so the substrate now makes that true instead of the pairs paying for it:

- one config object per distinct answer (mode × phone × the host's live token scope), shared process-wide, keyed on the host's own `--stapel-brand` so a customized or late-arriving `tokens.css` still wins;
- a nested `SkinTheme` whose answer is the one already applied above it renders its painted root and **no provider at all** — it never touches the cache or the DOM to decide. A nested skin pinning the other `mode` still gets its own, as it must;
- `toAntdTheme` resolves all fifteen roles through ONE `getComputedStyle` handle instead of fifteen;
- `useDialogSurface` keeps one `MediaQueryList` instead of building one per render of every consumer — `useSyncExternalStore` asks for the snapshot on every render, and `SkinTheme` is a consumer.

Measured in `test/skinThemePerf.test.tsx`: 200 self-wrapping rows went 1.8s → 83ms of mount, and the regression is held by counting theme BUILDS (a whole number that does not move with the machine), not by a stopwatch.

One behaviour nuance: a foreign `ConfigProvider` deliberately interposed between two `SkinTheme`s is no longer overridden by the inner one. `src/default/**` has no such providers by doctrine; a skin that means to override declares it on its own `mode`.

**The scale.** `@stapel/tokens` is a runtime import of `src/default/**` in twenty packages — `stapel/no-raw-dimensions`' autofix writes it, 274 times this wave — and not one pair declares it; it resolves only because this package depends on it and the tree happens to hoist. Rather than a twenty-first declaration, `spacing`, `radii`, `fontSize`, `fontWeight`, `breakpoints`, `breakpointForWidth`, `mediaQuery` and `cssVar` (plus their types) are re-exported from the root here — the census of what skins actually use. A pair's design-system dependency list stays exactly `@stapel/tokens-antd`, and the `@stapel/tokens` version in play is the one this bridge's colour mapping was built against. `colors`, `elevation`, `typography` and the raw ramps stay where they are: a skin reaching for a hex has left the bridge. The reasoning, and the two rejected alternatives, are in the root export's docblock.

Also new: `hostBrandFingerprint(mode)`, the one-property probe of the host's live token scope that makes the theme cache safe.
