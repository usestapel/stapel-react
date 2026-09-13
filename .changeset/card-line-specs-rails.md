---
"@stapel/listings-react": minor
---

Three things the reviewers measured on a live classified at 390 / 768 / 1024 /
1440 in both themes: the card's spec line runs past its column, the listing
page's «find more» rails are staircases, and the characteristics read as prose.

**The spec line's box, and why last release's fix never acted.** The line's
truncation was moved onto the span that holds the words a release ago, with
`min-inline-size: 0` so it could shrink. The class was on the element, the sheet
was in the document, every declaration was in it — and the span still ran 7px
past its column on one category page and 47px on another. What was missing is
that antd writes `a.ant-typography-ellipsis, span.ant-typography-ellipsis
{display:inline-block; max-width:100%}`, which scores (0,1,1) against a single
class's (0,1,0): it wins on SPECIFICITY, so no load order and no hoisting could
have saved the rule. The box was never a flex container, the span was therefore
never a flex child, and `min-inline-size: 0` on an element that is not a flex
item does nothing. `.ant-typography-ellipsis-single-line`'s `white-space: nowrap`
then inherited into the span, so it could not break either.

So the `ellipsis` prop goes — the prop IS what puts those classes on the box —
and the cut becomes the module this card already answers "how do I cut text"
with: `titleClamp.ts` at one line, the same class and the same hoisted sheet as
the title, the place and the description, with the ellipsis after a whole word
instead of inside one. The box keeps `display: flex` + `min-inline-size: 0`, its
selector doubled so it outranks any single class or element-plus-class whatever
the load order. Measured in headless Chromium on the DOM this component renders,
with antd's own rules, in a 180px column: before, box `display: block`, span
`display: inline` and 454.77px wide — 274.77px past the column; after, box
`display: flex`, span 180px, zero past it.

**The two rails are rails.** `RELATED_CARD_WIDTH` is one fixed 220px instead of
`min(46%, 220px)`: `min()` takes the smaller, so the share won on any rail
narrower than about 478px and the same card was 175.72px wide with a 131.78px
photo at 390 and 220 / 165 at 1440 — one card, several sizes, with the photo
height following the width. The title reserves two lines (`min-block-size: 2lh`,
two of its own line-height), because a card whose title fits on one line pulled
its price 24px up: measured on one live rail, six prices at 1733px and two at
1709. And the rail has EDGE CONTROLS — both always rendered, `hidden` while
there is nowhere to go in that direction, each stepping one card plus its gap
through `scroll-behavior: smooth`. The live rail's `scrollWidth` was 1844
against a `clientWidth` of 988 with no arrow, no fade and no "more" card: the
last card was cut at the container's edge and nothing said the rail moved.
New exports: `RELATED_CARD_WIDTH`, `RELATED_CARD_GAP`, `RELATED_FRAME_CLASS`,
`RELATED_ARROW_CLASS`. `RELATED_CARD_BASIS` is gone with the percentage it held.

**«Characteristics» is a table again, and not the table it was.** The row was a
paragraph — a muted label, one non-breaking space, the value in the same flow —
which fixed a real defect (antd's `<Descriptions>` gave a long answer a cell a
third of the page wide to wrap inside) and produced the next one: with the label
inline, every value starts wherever the label before it happened to end, so a
list of characteristics reads as prose and there is no column for an eye to run
down. The list is now a grid of `minmax(0, max-content)` and `minmax(0, 1fr)`,
with the gap from the spacing tokens and the ROW dissolved into it
(`display: contents`), so its label and its value are the grid's own items and
one label column is shared by every row. Both findings hold at once, which is
the point of those tracks: the label column is exactly as wide as the longest
label and never a reserved third of the page, and the value takes every pixel
that is left. Measured in headless Chromium: four values began at four different
x positions before and at one after, at 390 and at 1440, and the long answer's
measure at 1440 went from 448px to 1334px. New exports: `SPEC_LIST_CLASS`,
`SPEC_VALUE_CLASS`, `SPEC_FOOT_CLASS`, `SPEC_ROW_CLASS`, `SPEC_LABEL_CLASS`,
`SPEC_STYLE_HREF`.
