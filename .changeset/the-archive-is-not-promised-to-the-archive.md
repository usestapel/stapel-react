---
"@stapel/listings-react": patch
---

The delete dialog stops promising the archive to a listing already in it.

Measured on the phone walk, deleting from the **Archive** tab: "It disappears
from your dashboard and cannot be brought back. **Archiving keeps it.**" —
offered as an alternative to somebody standing in the archive, where it is not
an alternative at all.

The sentence now follows the ROW rather than the wording, and the state that
decides it is the one the seller would have to act on: whether `archived` is
still a move this listing has. An archived row (and a taken-down one) has spent
it and gets `listings.mine.delete_confirm_body.final` — the same warning
without the promise; a draft, a paused or an expired listing still has it and
still hears it. That is the row's own `available_transitions` and not a table
about its status: `<MyListingsPane>`'s confirmation hook is now given the
card's field, as the row's own controls have been since 0.22.0, so "a sold
listing may be archived" and "this one may" stop being the same claim.
