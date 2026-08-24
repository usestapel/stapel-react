---
"@stapel/tokens-antd": minor
---

`SkinConfirm` — a confirmation is a dialog, not an anchored popover.

`Popconfirm` is the same defect the sheet rule was written for, in a smaller
hat: it positions itself beside its trigger and sizes itself to desktop prose,
so on a 390px phone it renders half off-screen or on top of the row being
confirmed, with its Ok/Cancel targets under the touch minimum — and two of the
fleet's thirteen sites had one floating over a bottom sheet.

`SkinConfirm` is a `SkinDialog` with a question, a body and two answers, so it
is a sheet on a phone for free and needs no second decision about shape. A
destructive answer sets `maskClosable={false}`, because on a phone the backdrop
is most of the screen and that particular dismissal is permanent. The
destructive verb takes its own label rather than reusing the trigger's:
"Remove" on a row and "Remove" as the irreversible answer are one word doing
two jobs.
