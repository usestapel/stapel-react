---
"@stapel/profiles-react": minor
---

A person with no photograph gets their initials on a deterministic tinted disc, legible in both themes.

Every avatar on the live stand was a gradient blob with no face and no letters.
That was NOT this package's defect and the investigation is worth recording:
each seeded profile carried a real `avatar_image` pointing at a flat gradient
PNG on the CDN, so `<PersonAvatar>` was drawing the photograph it was given,
correctly. With that seed cleared, the no-photo arm is what a visitor actually
sees — and what it drew was antd's untinted default: white on `rgba(0,0,0,0.25)`,
which composited against a light page is **1.84:1**, a contrast failure rather
than merely a plain disc.

It now draws the fleet's own `useIdentityTint` (`@stapel/tokens-antd/skin`), so
the seller line on a card, the seller page and the listing page's seller block
all come right at once and agree with the chat inbox about what colour a given
person is. The key is the profile's `user_id`, so a rename does not repaint
somebody; `tintKey` is there for a surface holding a better key than the profile
read has answered with yet. A profile that HAS a photograph is untouched.

**Both colours are written on the avatar node, out of one call.** antd's
`<Avatar>` paints its own background and its own text colour from its component
tokens, so a disc that stated only the background would be a chosen colour
against a derived one — which is how a 4.5:1 claim renders at 3.6:1.

Measured in headless Chromium on the rendered DOM, both operands read as
COMPUTED styles off the live nodes — `backgroundColor` from the `.ant-avatar`
element and `color` from the separate `.ant-avatar-string` element inside it,
never from a token — over 13 people × 2 sizes (40px and 72px) × both themes:
**worst 8.40:1 in light, 10.33:1 in dark**, every disc opaque so nothing had to
be composited, and the initials fitting and centred on both axes at both sizes
in all 26 cases.
