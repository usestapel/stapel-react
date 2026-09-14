---
"@stapel/listings-react": minor
---

The card title and the card price are one scale, declared once, from the
brand's ladder.

Measured on a live storefront at 1440: the SERP list card priced at 22px while
the grid card beside it priced the same role at 16px. The same role rendered
two ways inside one product is worse than any gap against a reference, and the
cause was a second call site — `ListingSerpCard` set `fontSize.xl.fontSize`
inline and `ListingCard` set nothing.

That number carried a second defect. `fontSize` from `@stapel/tokens` is the
DEFAULT theme's ladder, resolved into the bundle at build time, so a brand
that publishes its own ladder never reached the component: the brand is chosen
at run time and a compiled-in number does not move. The measured storefront
draws `lg` at 18/22 and `xl` at 21/26; the card was drawing 22/33.

Both cards now carry `CARD_TITLE_CLASS` / `CARD_PRICE_CLASS`, and the shared
sheet declares the scale once in custom properties, so the brand's ladder is
the one that applies. The tier asks the CARD's width at the row arm's own
threshold rather than the window's — a window query would put an 18px title in
a 280px grid tile on a wide screen, and this package's sheet already refuses
`@media (min-width` for that reason.

No weight is set: the prices are `<Typography.Text strong>` and the brand's
own `fontWeightStrong` decides what strong means.
