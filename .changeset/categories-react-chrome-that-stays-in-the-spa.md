---
"@stapel/categories-react": minor
---

`linkComponent`: category chrome that does not reload the page

Breadcrumbs, the tree and the carousel are nothing but links, and every one of
them rendered a plain `<a href>`. Inside a router app that is a full page load
per click — the whole application thrown away and rebuilt to move between two
categories whose rows are already in memory, which is the entire point of this
pair's delta-synced, app-scoped catalogue. The storefront could not use the
chrome at all and named it a gap (Wave D, G-4).

The pair still carries no router. It takes core's `LinkComponent` — a component
over a plain `href` — and every skin spells the prop the same way:

```tsx
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <Link to={href} {...rest}>{children}</Link>
);

<CatalogPage linkComponent={RouterLink} />
<CategoryPage slug={slug} linkComponent={RouterLink} renderListings={…} />
<CategoryTreePane linkComponent={RouterLink} />
<CategoryBreadcrumbsBar slug={slug} linkComponent={RouterLink} />
<CategoryCarouselStrip linkComponent={RouterLink} />
```

`<CatalogPage>` and `<CategoryPage>` pass it down to everything they compose.
Omit it and anchors render exactly as before — a host with no router keeps
working — and it is the same prop `@stapel/listings-react`'s `<ListingCard>`
takes.

One detail was load-bearing: antd's `<Breadcrumb items>` renders its own anchor
when an item carries `href`, which would have bypassed the seam from inside the
component it lives in. A crumb's link is now its **title**, and the current
crumb stays a plain label — a link to the page under your feet is not
navigation.

`test/linkComponent.test.tsx` asserts the consequence, not the prop: with a
`linkComponent`, no `<a href>` is rendered on any of these screens.
