---
"@stapel/profiles-react": minor
---

Tenure on the public read, a face outside the row, and a name that is a heading.

The contract pin moves to stapel-profiles v0.19.2, which puts `created_at` on
both `ProfileResponse` and `ProfilePublicResponse` — the moment the PROFILE row
was created, which is the tenure a seller page renders as "on the site since
March 2024" and, until now, a second lookup away. Three gaps a storefront hit
building on the pair close with it:

- **`<PersonRow headingLevel={1|2|3|4}>`** — on a seller page the person's name
  is the subject of the document and this component drew it as a `<span>`, so a
  screen reader's heading list skipped straight past it. The prop changes the
  ELEMENT and nothing else: the heading inherits the row's font, carries no
  margin, and wraps the name's own link rather than sitting inside it. Omitted,
  the row is exactly what it was.
- **`<PersonAvatar>`** is exported (it was private) with `PersonAvatarProps` —
  the backend's descriptor through `<Image>` when there is one, a monogram when
  there is not, never a broken `<img>`. Every host drawing a face outside a row
  (a chat gutter, a table cell, a facepile) was rewriting that decision.
- **`profileAvatarImage(profile)`** narrows `avatar_image` to `@stapel/image`'s
  `StapelImage`, repairing the three places the generated DTO is wider than what
  `<Image>` consumes: a bare-string `source`, an OPTIONAL `variants`, and a
  bare-string `variants[].branch`. Call sites used to write `as StapelImage`,
  which asserts all three away without checking any; the two inside this package
  now go through the narrowing instead.
- **`<MemberSince created_at>`** renders the tenure as one quiet line — a month
  and a year at the app's locale through core's `useFormat`, never the raw ISO
  instant and never a day — and renders nothing at all when the deployment's
  profile carries no creation time. `<PublicProfilePage/>` shows it beside the
  counts. The Russian string states the fact rather than saying "since": `Intl`
  writes the month in the nominative case and a Russian "since <month>" governs
  the genitive, so the phrasing moves rather than the formatter.
