---
"@stapel/shell-react": minor
---

`<PublicShell/>`: a nav menu that shows its tabs, and a measure for the content

Two findings from a walk over the live storefront, both of them geometry.

**The nav collapsed to "…" on a 1440px window.** The horizontal `<Menu>` was a
bare child of the browse row's `<Flex>`, and a flex item with no basis is sized
by its content — which rc-overflow measures before it has any, lands on ~0, and
answers by hiding every tab behind an overflow trigger. The whole public nav
was therefore reachable only through a "…" in an otherwise empty row. The menu
now sits in a `flex: 1 1 auto` / `minWidth: 0` box that takes the row's
leftover width, with the category strip pinned at `flex: 0 0 auto` so it cannot
take that width back.

**`contentMaxWidth`** (default `1280`, `false` for edge-to-edge). `Layout
.Content` was `padding: 16` and nothing else, so a listing's description ran
the full width of whatever monitor it was opened on — a line length nobody
reads, and a catalogue grid stretched into a shape no card was designed for.
The routed content is now centred at a measure the host can set:

```tsx
<PublicShell nav={nav} mode="light" contentMaxWidth={960} />
<PublicShell nav={nav} mode="light" contentMaxWidth={false} />
```

1280 is a 12-column grid of ~280px cards plus gutters — the same floor
`@stapel/search-react`'s results grid uses, so the two agree about what a
column is. The chrome above stays full-bleed on purpose: a top bar that stops
short of the window edges reads as a broken page, not as a measure.

`<AppShell/>` is deliberately untouched: its content column already sits beside
a `Sider`, and the tables an app cabinet renders there want the width.
