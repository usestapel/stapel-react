---
"@stapel/shell-react": minor
---

`<PublicShell/>` — a second chrome for the public surface, a sibling of
`<AppShell/>` rather than a flag on it.

`AppShell` never read a session or a workspace; what stood between the fleet
and a public storefront was the shape of its chrome (a `Sider`, always). The
new component is the marketplace geometry: a top bar (`brand`, `searchSlot`,
`accountSlot`), an optional browse bar (the nav `Menu` + `categorySlot`) that
collapses into a `Drawer` on phone while the header stays, `<Outlet/>`, and an
optional `footer`. Omitting `accountSlot` renders a sign-in CTA rather than
nothing — a public storefront with no visible way in is a dead end, not a
clean design. Like `AppShell`, it reads no session: the mandate stays with the
container.

`resolvePublicNav` / `resolveMemberNav` join `resolveNav` on the root entry.
`resolveNav`'s `audience` is optional and its default filters nothing — which
is correct for scaffold codegen and a trap for a public container, since a
forgotten option mounts every `member` screen. The audience now has a spelling
that cannot be forgotten.

`AppShell`'s own rendering is unchanged; the nav `Menu` it shares with
`PublicShell` moved to an internal module so the two chromes cannot drift on
route matching.
