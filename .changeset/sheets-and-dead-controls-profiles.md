---
"@stapel/profiles-react": minor
---

Both dialogs are bottom sheets on a phone, an unchanged field cannot fire a
write, and a failed preferences read no longer renders live switches.

`InitialSetupModal` and `ProfileSettings`' field editor render through
`@stapel/tokens-antd/skin`'s `SkinDialog`; the hand-rolled
`isPhone ? <Drawer> : <Modal>` branch is gone. Blocking first-run mode passes
`dismissible={false}`, so it draws no way out at all rather than a ✕ that is
offered and inert.

`EditableTextRow`'s Save was enabled when the draft equalled the stored value —
a PATCH that changes nothing — and the dialog's dismissal was keyed on that same
equality, which is already true the instant it opens and which also closed this
row's dialog when a SIBLING row saved. Save is disabled on an unchanged draft,
and dismissal now waits for this row's own write to land.

`NotificationPreferences` rendered its switch matrix out of a defaults-shaped
read, so a FAILED read drew four live switches at defaults and flipping one
wrote a preference derived from state nobody could read. The failed arm renders
the failure and a retry, and no switch. The headless bag gained `state` and
`refetch` to make that possible — the previous `isError` folded read and write
together, so a failed toggle would have blanked a screen that is still usable.
