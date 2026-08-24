---
"@stapel/docs-react": minor
---

Every dialog is a bottom sheet on a phone, and two controls that offered
nothing are gone.

`RevisionsModal`, `NameDialog` and `MoveDialog` render through
`@stapel/tokens-antd/skin`'s `SkinDialog`, so the fleet's surface rule reaches
them without this package restating it.

Rollback was offered on EVERY revision including the current head — restoring
the head writes a new, identical revision, an action the document's own state
makes meaningless. The head row's rollback is now blocked with the reason
printed beside it. And `loading` was not keyed to the revision being restored,
so one rollback spun every row's button.

`MoveDialog`'s confirm was enabled when the chosen destination was the folder
the document is already in; it is disabled now, consistent with `NameDialog`
next to it, which already refused an unusable value.
