---
"@stapel/listings-react": patch
---

listings-react: the dashboard's Delete is drawn only where there is a route behind it

A published listing cannot be deleted — the server has no such route — and the
seller's dashboard drew the control for it anyway, switched off. Pooled into
the pane's `<PaneGate>`, "switched off" is a live-looking button carrying
`aria-disabled="true"` whose reason sits somewhere else on the screen: the
desktop walk pressed it twenty-six times for zero dialogs and zero effect.

Delete is now drawn on the rows that can be deleted (drafts, archived, sold,
paused, expired) and not at all on a listing that is on sale, whose own next
move — Archive — is in `actions.moves` because the server put it there. After
archiving, Delete appears and works.

`useListingActions` gains `removable`, the same question `moves` answers for
the lifecycle edges asked for the one action that is not one of them.
`remove` still states its reason, so a skin that chooses to draw the control
anyway says why it is off rather than showing a bare disabled box.
