---
"@stapel/core": minor
---

Two host seams a skin needs and a library must not choose: `LinkComponent` and `SignInCta`

Wave D mounted nine pairs in one container and both absences showed up as
defects the same afternoon.

**`LinkComponent`** — `categories-react`'s breadcrumbs, tree and carousel
rendered plain `<a href>`, so every click on category chrome threw the SPA
away and rebuilt it; `listings-react`'s card rendered `href` AND called
`onOpen`, which navigated twice for one click. A pair cannot import a router
(there are several, and a library that picks one picks it for every host), so
the host hands the anchor in:

```tsx
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <Link to={href} {...rest}>{children}</Link>
);
```

The props are a plain `href`, `children`, `className`/`style`/`onClick`,
`aria-label` and a `data-*` index signature — the last is what keeps a pair's
own test hooks reaching the DOM through the host's component.

**`SignInCta`** — `actionBlocked` ended the grey-rectangle incident by making
every switched-off control state its reason, but "sign in to add this to
favourites" is a reason whose next action is a LINK, and no pair took one.
Three pairs each rendered the sentence and stopped, leaving the visitor to
find the header themselves. `SignInCta` is `{ href }` **or** `{ onSignIn }` —
never both, which is the same two-navigations-for-one-click defect wearing a
different hat — and `SignInCtaProp` is the mixin so the prop is spelled the
same in every pair that has a door.

Both are TYPES: no runtime, no router, no antd, no change to the bundle. The
copy is deliberately NOT here — each pair ships the link's label in its own
bundle, because core floors `en` and `ru` while those pairs also ship `es`.

Consumers' peer floors on `@stapel/core` are unchanged in this wave: the
symbols are unreleased, so `check:peer-floors` has nothing to measure against
yet (it refuses to guess, by design). The floors move to `>=0.16.0` in the
wave AFTER this one tags.
