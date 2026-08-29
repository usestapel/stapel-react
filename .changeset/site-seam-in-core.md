---
"@stapel/core": minor
---

The host decides the brand, at runtime: `SiteProvider` / `useSite` / `fetchSite`.

A product served under two domains had no honest way to say which one it was
being looked at from. The brand was a build-time fact in three places at once
— the `<title>` in `index.html`, a `SITE` constant, an i18n key — so a second
domain made every one of them wrong on half the traffic, and the only fixes
available were a second image or an nginx header, which is a fleet fork of the
one thing that must stay identical across deployments.

`@stapel/core` now carries the seam instead:

- `fetchSite(client)` reads `GET <baseUrl>/site/` — public, no auth header,
  the document `stapel_core.sites` serves: host, whether the registry matched
  it, locale, the brand (key, name, title, logo, theme, legal strings) and the
  SEO verdict for that host.
- `<SiteProvider client fallback>` renders the `fallback` on the FIRST frame
  and replaces it when the answer lands. There is no empty first frame and no
  flash of a generic shell; a failure keeps the fallback, warns once, and
  never throws into the tree — a branding document being unreachable must not
  blank the page a visitor came for.
- It reflects the answer onto `<html>`: `data-brand="<brand.theme>"`, which is
  what a `stapel-tokens --scope` stylesheet is addressed by, and `lang`, which
  a screen reader reads and no `<meta>` replaces.
- `useSite()` throws outside a provider — a screen whose content IS the brand
  has nothing honest to draw without one. `useOptionalSite()` returns `null`
  instead, for library code that PREFERS a site: it is why
  `@stapel/shell-react`'s `<PublicShell/>` can default its brand slot without
  breaking every host that mounts no provider.
