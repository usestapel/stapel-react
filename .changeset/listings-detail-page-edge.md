---
"@stapel/listings-react": patch
---

`<ListingDetailPane>`: the page edge, and where the seller sits on a phone.

Two host-measured defects of the one-column arm, both about position:

- `gutter?: "own" | "shell"` — the pane painted a flat `spacing[4]` gutter
  INSIDE a frame that had already placed the page edge with
  `--stapel-page-gutter`, so a desktop read at 40px from the frame and a 360px
  phone lost a ninth of its width to two stacked gutters. `"shell"` says the
  frame owns the edge and the pane adds none; `"own"` is the default and is
  byte-compatible.
- `asidePlacement?: "end" | "after-actions"` — `"column"` IS the phone
  rendering of this page, and there the host's seller block sat below the
  description, the spec table and the meta table: two screens of scrolling
  between "message the seller" and who the seller is. `"after-actions"` puts
  it directly under the actions, which is the order the split layout has read
  since it shipped. `"end"` is the default and is byte-compatible.
