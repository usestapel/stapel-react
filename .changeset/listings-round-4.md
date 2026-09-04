---
"@stapel/listings-react": minor
---

listings: characteristics read as sentences with units, badges say what they mean, and a card's photos answer a hover

Three findings from the live listing page and its cards, all measured, none
of them a preference.

**The characteristics list stops being a table.** `<Descriptions column={1}>`
is a real two-column table, and on a phone — and in the split layout's
half-width left column — the value cell is narrow enough that a long answer
wrapped inside it and stacked under itself, beside acres of empty label
gutter. A spec row is a short question and its answer, not tabular data
scanned down one axis. `<ListingSpecList>` draws it as a paragraph: a muted
inline `<span>` label, then the value in the same text flow, wrapping at the
full measure. `<ListingSpecColumns>` keeps the split layout's two columns —
of whole ROWS, cut by row count so the category's declaration order still
reads top-to-bottom, left column first. The label is never a column.

**A number carries its unit and groups its digits.** The live page read
"Power 173", "Mileage 20000", "Engine volume 2.0": no unit, no grouping, and
an invariant decimal point in a Russian storefront. `formatSpecValue`
(`model/featureText.ts`) typesets `int` and `float` — same value, same
precision rule, same `postfix1000` switch at a thousand — with the digits
through `Intl.NumberFormat` and the unit appended. Every other type still
goes through `@stapel/attributes-react`'s `formatFeatureValue` untouched.

There is **no generic `unit` key** on a feature definition anywhere in this
fleet: not on `FeatureDef` (`stapel-attributes/base.py:154-208`), not on
`IntConfig`/`FloatConfig` (`attributes-react/src/generated/featureDef.ts:163`),
not on the stored DAO. The unit of a number IS its `postfix`, free text on
the type's config. `dto_to_dao` copies it at WRITE time
(`stapel-attributes/types/int/type.py:198`), so a listing published before
its category gained a unit keeps printing without one for the rest of its
life — which is exactly the live case. `featureFromDao` now adopts the unit
keys (`prefix`, `postfix`, `postfix1000`, `unitType`, `unit_m`, `unit_i`)
from the CATEGORY definition the page already holds, wherever the stored row
is silent about them; the stored row still wins wherever it said anything,
the same precedence the option table has always used. `precision` is
deliberately not adopted: a stored value has already been rounded to the
precision it was written with. Where nothing declares a unit, the bare number
stands — none is invented.

**Card badges say what they mean.** A live card read "Brick · 3 · 9": three
true facts about a flat and two of them unreadable, because a stored
`features_badges` element carried the value and nothing that says what the
value is. stapel-listings 0.21.3's card badge contract adds `label`, `unit`,
`name` and `presentation` to each element, and `presentation` is the server's
decision — `value`, `value_unit`, `name_value` ("Floor 3", a space and never
a colon: a card is a caption, not a form) or `name` for a true boolean, whose
name IS the badge and whose false twin prints nothing. `cardBadgeText` is the
one place the four are read, and all three card surfaces call it. Carried as
a local type extension of `ListingFeatureDao` rather than a regenerated
schema, for the reason that mirror exists at all — the generated `FeatureDao`
union is unusable and `features_badges` is a `JSONField`.

A projection where no element declares a `presentation` is a projection from
a server older than 0.21.3, and it renders exactly as it rendered before,
through `<FeatureBadges>` off the stored DAO's own config.

**A card's photos answer a hover and a swipe.** A card with six photographs
showed one, and the other five needed a navigation. The media box is now
divided into as many equal segments as there are photographs, the segment
under the cursor is the photograph on screen, and the pointer leaving puts
the first one back — a hover is a look, not an edit. It is gated on
`(hover: hover) and (pointer: fine)` AND on a `mouse` pointer type, because a
touch laptop answers the media query and still delivers finger events. On a
finger, a horizontal drag past 32px and further across than down advances or
rewinds one photograph; the strip declares `touch-action: pan-y`, so the
page's vertical scroll stays the browser's at the platform level where no
handler can argue with it, and a diagonal thumb scrolling a feed changes no
photograph.

Neither gesture replaces the strip. Both work by SCROLLING the same
`<SkinCarousel>` the card already draws, so it stays a focusable scroll
container the arrow keys move, the slides stay in the document in reading
order, the dots keep reporting the position — and the card stays ONE link
target with ONE accessible name, the heart outside it, exactly as the earlier
ruling left it.

Size budgets raised with the rationale in the entry names: index 14 → 15 KB
(measured 14.39) for the two model modules, `/default` 22 → 25 KB (measured
23.94) for the spec list, the badge renderer and the gallery.
