---
"@stapel/search-react": patch
---

A popular value wraps inside its column instead of over the next one

`column-width` is a MINIMUM, so the browser hands each row of the popular
band whatever width the box divides into. antd's `.ant-btn` carries
`white-space: nowrap`, so a value longer than its column kept its natural
width and painted OVER the next column.

Measured on a jobs root at 1440: columns pitched 187px, with a 357px value
sitting at the same baseline as the value 187px to its right — two labels on
top of each other, unreadable. Makes never showed it because "Ford" is short;
the defect was in the block from the start and only a long vocabulary
revealed it.

The value now wraps (`white-space: normal`), starts its lines at the column's
edge rather than centring them the way a button does, and both the row and
the value carry `min-inline-size: 0` — a flex item's automatic minimum size
is its CONTENT, which is the other half of how the row escaped its column.
