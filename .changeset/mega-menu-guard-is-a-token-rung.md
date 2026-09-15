---
"@stapel/categories-react": minor
---

`<CategoryMegaMenu minWidth>` defaults to the tokens' `desktop` rung, not a
hard-coded 1024.

The guard below which the panel renders nothing was `const DEFAULT_MIN_WIDTH =
1024` — a number on no rung of `@stapel/tokens` that happened to equal one
deployment's private edge (its filter rail's "owner's tablet rule"). So the
FLEET default silently carried one storefront's composition to every host that
named nothing. A width that is a claim about every device belongs to the ladder
or to the caller, never to a literal in between.

The prop is unchanged and is still the way a deployment says otherwise — this
moves only what a host gets when it says nothing. Same treatment as
`<SearchPage railFrom>` (`@stapel/search-react` 0.32.7) and
`<PublicShell chromeFrom>` (`@stapel/shell-react` 0.19.0); found by the sweep
behind the latter.

**Migration.** A host relying on the default now loses the panel between 1024
and 1199, where it used to appear. If that band is wanted — and for a storefront
whose catalogue button is already visible there, it is — pass the width
explicitly, and pass the same one the deployment gives its other pairs:

```tsx
// the deployment's own edge, named once and handed to every pair
<CategoryMegaMenu minWidth={SERP_RAIL_MIN_WIDTH} />
```

Below `breakpoints.desktop` with no `minWidth` the panel renders nothing AND
asks the server nothing, exactly as before — the read is still skipped under
the guard, now at the new width. Asserted at 767 / 768 / 1023 / 1024 / 1199 /
1200 in `test/megaMenuGuard.test.tsx`, both for the default and for a host that
names 1024.

The component's demo now passes `minWidth={0}`: each variant declares
`viewport: "desktop"`, but a declared frame is not the runner's
`window.innerWidth`, and the photograph had been passing only because that
width and the old default were both 1024. The guard is proven in the test; the
demo photographs what the panel looks like.
