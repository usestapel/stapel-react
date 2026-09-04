---
"@stapel/categories-react": minor
---

A transparent wrapper's breadcrumb crumb no longer links anywhere.

The browse rule already skips a one-child import wrapper's own tile
(`isTransparentWrapper`/`browseChildren`, `catalog/wrapper.ts`) — a
storefront integrator flagged that its breadcrumb trail (`Услуги →
«Предложение услуг» → group`) still linked the wrapper's crumb, offering a
destination the rest of the storefront treats as not there.

`CategoryCrumb` gains `linked` (default `true`); `<CategoryBreadcrumbsBar>`
renders a `linked: false` crumb as plain text — same typography, no anchor,
`aria-current` untouched on the real current crumb. The wrapper is detected
automatically from the trail's own rows via the new `isWrapperAncestor`
(the same `tn_children_pks` check `isTransparentWrapper` uses, sized to a
crumb list rather than a tile page's full sibling array — no extra
request). A host that holds ancestry knowledge the trail cannot supplies
`unlink` instead — on `<CategoryBreadcrumbsBar unlink>` directly, or via
`<CategoryPage breadcrumbs={{ unlink }}>` — which REPLACES the automatic
check for every crumb rather than adding to it.
