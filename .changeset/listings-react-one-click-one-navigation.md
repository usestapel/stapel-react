---
"@stapel/listings-react": minor
---

`<ListingCard>`: one click, one navigation — and a `<Link>` it can be handed

`href` and `onOpen` were two optional props and the card rendered BOTH when
both were given: the handler ran, the container routed, and the browser then
followed the anchor still sitting on the button. Two navigations for one click.
The storefront's workaround was `onOpen` alone, which cost the most linkable
element in the app its anchor — no middle-click, no "open in new tab", nothing
for a crawler to follow (Wave D, G-2).

`ListingCardOpenProps` is now a union with three arms and no fourth:

```tsx
<ListingCard listing={row} href={`/l/${row.id}`} />                       // an anchor
<ListingCard listing={row} href={`/l/${row.id}`} linkComponent={Link} />  // the host's <Link>
<ListingCard listing={row} onOpen={(id) => navigate(`/l/${id}`)} />       // a button
<ListingCard listing={row} />                                            // no open control
```

Passing `href` and `onOpen` together no longer typechecks, and neither does a
`linkComponent` on the callback arm — `linkComponent` IS the link.

`linkComponent` is `@stapel/core`'s `LinkComponent`, a component taking a plain
`href`, so this pair stays router-agnostic and a container keeps a real anchor
while the click stays inside the SPA:

```tsx
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <Link to={href} {...rest}>{children}</Link>
);
```

`<FavoritesPane>` takes the same union one level up (`hrefFor` / `onOpen` /
`linkComponent`), so a pane cannot re-introduce upstream what the card refuses.

Breaking only for a caller that passed both props — which is the defect this
release removes, and which had no correct behaviour to preserve.
