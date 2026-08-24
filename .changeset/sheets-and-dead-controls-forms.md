---
"@stapel/forms-react": minor
---

The response detail is a bottom sheet on a phone, and an erased submission
stops offering writes against itself.

`ResponsesPane`'s side `Drawer` — fixed at 480px on every viewport — renders
through `@stapel/tokens-antd/skin`'s `SkinDialog`: a bottom sheet on a phone, a
centred modal above the tablet breakpoint. Its content is a vertical
read-and-act detail surface, which is a dialog, not navigation.

A submission with `erased_at` set showed an "erased" tag and then offered
Resend and Delete anyway. Both are blocked now, with the reason as visible text
beside the controls, and Delete drops its confirmation popover rather than
wrapping a dead button in one.

The submissions `Table` gained `scroll={{ x: true }}`: it carries two fixed
columns plus one per form field, so a ten-question form produced twelve columns
that could not be read or scrolled on a phone.

The module doc claimed Delete was gated on `forms.responses.manage`. It was
not, and it cannot be from this side: every admin route documents its
permission as `IsNotAnonymousUser`, neither `SubmissionPresenterDTO` nor
`FormPresenterDTO` carries a capability field, and the module exposes no
capabilities read. The doc says that now instead of implying a gate that does
not exist; a refusal arrives as the mutation error. The backend would need to
project that capability — cheapest as a small capabilities read beside the
submissions list — and it must reach this pair through the committed schema,
not by hand.
