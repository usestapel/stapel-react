---
"@stapel/reviews-react": minor
---

The moderation queue and the seller's reply exist on a screen. The default
skins are the product, so they are now in the showcase.

stapel-reviews has shipped `POST {id}/moderate` and `POST {id}/response` since
0.1 — a hide/publish verdict with an emitted fact, and the target owner's
single reply. This pair documented their absence as a scoped boundary ("they
belong to consoles this pair does not ship"), and the fleet consequence was
that no user anywhere could reach either: the backend shipped, the console did
not. Both are wired now, and the argument for omitting them turns out to be the
argument for including them — the `can_moderate` callback is **fail-closed**, so
the server is the authority and a mis-offered control costs a 403, not a leak.
What the client owes is the other half: the control is never offered blindly,
and where the host has not armed it, it renders switched off **with its reason
beside it** rather than removed. A seller whose ownership callback is mis-wired
now sees a bug report instead of a page that quietly has no reply button.

- **`ReviewModerationPanel`** — the queue. Every row badged with the state it is
  in, both verdicts gated on where that row stands (re-applying a state is an
  upstream no-op that answers 200, so "Already hidden" is said *before* the
  click instead of a button that appears to do nothing), a moderation reason
  that rides into the fact and is shown to nobody, and a confirmation on hide
  because hiding also removes the review from the rating — a bottom sheet on a
  phone via `SkinConfirm`, never a `Popconfirm`.
- **`ReviewResponseComposer`** — the reply, shown and written by the same
  component, because on the page they are one thing. The one-shot rule is
  stated while the box is still empty: the module stores at most one `Response`
  and ships no endpoint that edits or deletes it, so a composer that discovered
  that afterwards would be a text box that silently turns out to have been the
  last word. An empty reply is blocked client-side — `RespondRequest.body`
  defaults to `""`, so the server would store a blank reply and then refuse
  forever to replace it.
- **`include: "all"` stops lying by omission.** The view narrows a
  non-moderator's request to published-only with no error and no marker in the
  body, so a host that passed the prop to the wrong viewer got a quietly
  incomplete list. `ReviewListBag.scope` now separates what was *requested*
  from what can be *vouched for* — `granted: "all"` only when a non-published
  row is actually on screen, which is proof — and the skin prints the sentence
  when nothing proves the grant.
- **Reviews have dates.** `renderDate` was a slot, and the result was a review
  list with no dates in it anywhere the host had not written a formatter. The
  pair ships a short absolute date in the reader's locale
  (`formatReviewDate` / `useReviewDateFormat`); the slot survives on top for a
  host that wants relative time.
- **The count is a plural.** `reviews.rating.count` was one flat string, so
  English said "1 reviews" and Russian dodged it by putting the numeral last.
  It is a CLDR family now (`REVIEWS_I18N_PLURALS`, through core's `tPlural`),
  with the paucal Russian actually needs.
- **On the shared substrate.** The pair's own `theme.tsx` and `ErrorAlert.tsx`
  are deleted in favour of `@stapel/tokens-antd/skin`'s `SkinTheme`,
  `ErrorAlert`, `EmptyState`, `LoadList`/`LoadBoundary`, `GatedButton` and
  `SkinConfirm` — so the reactive-mode fix, the 44px phone control height and
  the designed empty state arrive here instead of being re-decided. Zero
  hardcoded dimensions; every gate reason is visible text with the control's
  `aria-describedby` pointing at it, never a tooltip on a control that cannot
  fire one.
- **The showcase renders the product.** All seven `/default` exports have a
  skin demo at phone *and* desktop with distinct seeded states; the debug
  harness (`DemoCard`, `StepBadge`) that rendered a state dump in place of
  every screen is deleted, and demo fixtures carry prose instead of i18n keys
  that used to print as the text of a review.

**Breaking (pre-1.0 minor):** `ReviewsSkinTheme` and this pair's `ErrorAlert`
are no longer exported from `./default` — import `SkinTheme` / `ErrorAlert`
from `@stapel/tokens-antd/skin`. `REVIEWS_I18N_KEYS.ratingCount` moved to
`REVIEWS_I18N_PLURALS.ratingCount` and is resolved with `tPlural`, not `t`.
Peer floors rise to `@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`.
