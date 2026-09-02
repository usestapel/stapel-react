---
"@stapel/listings-react": minor
---

The listing page gets a desktop, the blocked heart gets an indoor voice, and
the taken-down listing gets an honest sentence. All three from one desktop
walk of a live classified deployment at 1440×900.

- **`layout="split"` + `aside` on `<ListingDetailPane>`.** Measured: the
  whole listing page was a ~930px single column hugging the start edge, the
  price a 22px line UNDER the title and smaller than it, the right half of
  the screen empty — where the reference design is two columns. The split is
  a CSS grid `minmax(0, 1fr) 380px`: gallery, title, description and specs
  on the left; a sticky buy column on the right with the price LARGE at its
  top (level 2, above everything), then the actions row, then `aside` — the
  host's seller block. Specs render as TWO `<FeatureValueList>` columns in
  the split, halved by row count so category declaration order reads
  top-to-bottom, left column first. The pane's measure widens from the
  one-column `DETAIL_MEASURE` (60rem) to `DETAIL_SPLIT_MEASURE` (75rem) —
  the reading column keeps its line with the buy column beside it. The host
  states the axis (the CategoryPage `subcategories` rule); the default
  `"column"` is byte-compatible, and a column-layout `aside` joins the flow
  directly above `footer`.
- **`blockedReason: "popover"`** — the third arm on the cards, and a
  `blockedReason?: "text" | "popover"` prop on the pane. Measured: the
  standing "sign in to do this" caption printed under EVERY card, 24 copies
  per screen. The docstring used to argue there is no third setting; the
  honest rewrite is that a pooled scope and a per-card line are both still
  STANDING copy, and the product ruling is that the door belongs on
  interaction. The new arm renders nothing standing: the reason and the
  sign-in door disclose in a Popover on the heart itself, opening on hover
  AND focus AND click/tap — the anchor is `aria-disabled`, never
  html-disabled, so the events actually arrive (the grave the old Tooltip
  died in) — while a visually-hidden copy of the reason stays wired to the
  button via `aria-describedby`, so the refusal reaches assistive tech
  without a pointer.
- **`withdrawn` on the detail bag, and a fifth sentence on the pane.** A
  taken-down (archived, not deleted) listing answers 404 on the detail read
  while the AllowAny status probe answers 200 — on the live stand the
  probe's whole body was `{"is_deleted": false}` — and the pane fell into
  the generic "could not load / retry" arm: a retry that can never help, on
  a row that is gone on purpose. `useListingDetail` now reports
  `withdrawn` (detail 404 + probe answered + `is_deleted !== true`, guarded
  for a body carrying the flag alone), and the pane's failed ordering is
  removed → not found → withdrawn → generic: the withdrawn arm is an
  `EmptyState` with its own key (`listings.detail.withdrawn`, en/ru/es) and
  NO retry control.

`/default` budget raised 19 → 20 KB for the second assembly of the money
page plus the disclosure arm.
