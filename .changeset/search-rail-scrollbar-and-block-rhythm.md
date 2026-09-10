---
"@stapel/search-react": minor
---

The rail's scrollbar is the skin's, and one token spaces every block on the page.

Two findings from a walk of a live storefront's category page in the dark
theme, both of them a decision nobody had taken.

**`<SearchPage railScrollbar>`** — default `"styled"`. The rail stays its own
scroll container: filters that stay put while the results move under them are
the whole point of it, and a page that scrolled for the rail would send a person
back up to the controls after every tick. What was never decided is the BAR. An
`overflow-y: auto` box gets the platform's, and the platform's is a grey chrome
strip standing beside the filters. `"styled"` replaces it with the skin's own,
from the tokens, in both themes: a 6px track, no arrows, no track fill, and a
thumb that is transparent at rest and arrives on `:hover` of the rail (a pointer
scrolling inside it) and on `:focus-within` (a keyboard doing the same), with
`scrollbar-gutter: stable` so the panel's right edge does not move when it
appears. Both vendor forms, because they are not alternatives — Firefox reads
`scrollbar-width`/`scrollbar-color`, WebKit reads the `::-webkit-scrollbar`
pseudo-elements — and under `(pointer: coarse)`, where neither hover nor focus
ever fires, the thumb stands. `railScrollbar="system"` hands the port back to the
platform untouched and mounts no rule set at all. `RAIL_SCROLLBAR_CLASS` and
`railScrollbarCss()` are exported for a host that mounts the panel itself.

**`<SearchPage blockRhythm>`** — default `"token"`. The distance between two
blocks on this page was `spacing[4]` written inline on the root `<Flex>`: 16px
is a form's field spacing, not a page's section spacing, and the blocks read as
one column with no seams. Every gap now comes from ONE pair of custom
properties, declared as a usage and not as a definition —
`var(--stapel-block-gap, 32px)`, and `var(--stapel-block-gap-compact, 24px)` on a
coarse pointer or under the tablet edge — so a host, a container or a brand sets
the property once, anywhere above the page, and every block moves together. Each
direct block's outer margin is reset in the same rule set, because a block with a
margin of its own is a second opinion about a distance the gap already states.
`@stapel/categories-react` declares the same two property names, so one
declaration tunes both halves of a category screen. `blockRhythm="legacy"`
restores the flat inline gap for a host whose layout was measured against it.

Both defaults are the NEW behaviour on purpose: neither the system scrollbar nor
the 16px gap was a design anybody chose — they are what a scroll port and a
vertical `<Flex>` do when nobody says otherwise.
