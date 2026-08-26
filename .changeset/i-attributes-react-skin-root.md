---
"@stapel/attributes-react": patch
---

Every `/default` surface is its own skin root, and the composer's chips are a touch target.

**Nothing in `src/default/**` wrapped itself.** The package draws form rows,
not pages, and it took that as licence to render no `SkinTheme` anywhere — so
on a dark document with no `ConfigProvider` above it, antd fell back to its
light algorithm and the ten editors painted light inputs and near-invisible
help text on a dark form. `FeatureFields`, `UnsupportedValueEditor`,
`FeatureBadges`, `FeatureValueList` and every builtin editor in
`BUILTIN_VALUE_EDITORS` now render inside `SkinTheme surface="bare"`: the theme
applies, the paint stays the host's, and a host that wraps the composer too
pays nothing (nested skins reuse the applied config and render no second
provider).

**The test proved the test.** `test/responsive.test.tsx` already rendered every
surface at phone/desktop × light/dark and asserted a skin root on the
document's side — inside a `SkinTheme surface="base"` the test itself
supplied. It renders with no skin above it now, so the assertion is about the
component; the phone case asserts `data-stapel-skin-phone`, the branch the
44px `controlHeight` comes from.

**Chips at 27px.** `SkinTheme` raises antd's `controlHeight` to 44px on a phone
VIEWPORT, and the listings composer draws these rows in a narrow form column on
a full desktop — where the visual pass measured the segmented feature chips at
~27px. `FeatureFields` measures its own column with `useElementWidth` (the
substrate's one measurement) against the `tablet` breakpoint and publishes the
answer to the editors through context, since a registry-resolved editor cannot
see its host. Below it, a `select` drawn as chips holds its labels to the touch
floor, so the chip lands on 44 regardless of how wide the window is.
