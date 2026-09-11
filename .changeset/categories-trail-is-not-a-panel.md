---
"@stapel/categories-react": minor
---

A breadcrumb trail is not a panel.

`<CategoryBreadcrumbsBar>` wraps itself in `<SkinTheme>` to hand antd the theme
its `Breadcrumb` is drawn with. `<SkinTheme>` defaults to `surface="raised"`,
which also paints `colorBgContainer` on its own root — and on a light theme
that is the page's own colour, so for as long as this skin has existed the
fill was invisible and nobody ever decided it.

Measured on a dark storefront by its integrator (a browser probe over the
live site): a 1392×24 lighter ribbon across the top of every `/c/:slug`,
and the same band at 1392×24 / 382×48 on every listing page that mounts the
bar for its own trail. A panel behind one line of links, with no radius, no
border, and nothing inside it that belongs on a surface of its own. It is the
same fill the flat tile grid lost one release ago, one component over.

The bar now renders `surface="bare"`: no background at all, so the trail takes
the ground it stands on. `bare` drops the text colour `raised` would have
written too, so the colour is stated back as `color: var(--stapel-text)` —
the same trade `<CategoryTileGrid>`'s flat arm makes, and strictly better than
what it replaces, because the custom property resolves per theme at paint time
where `SkinTheme` froze the value of whichever side mounted first.

No new prop. A host that pins `mode` still gets that mode: the pin is what
gives the antd components below their tokens, and every caption in this bar —
`Breadcrumb`, `Typography`, `CategoryLink`, the skeleton and the error alert —
takes its colour from those tokens rather than by inheritance.

`test/breadcrumbSurface.test.tsx` asserts the surface stamp and both halves of
the paint, on the pinned-mode path as well as the default one. jsdom resolves
no antd token, so the claim is the stamp `<SkinTheme>` publishes for exactly
this purpose; it read `"raised"` before this change.
