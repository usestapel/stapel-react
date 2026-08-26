---
"@stapel/workspaces-react": minor
---

`is_self` closes two lying controls, the four admin screens get doors, and every default-skin screen is finally photographed

**The row the roster could not identify.** stapel-workspaces 0.30.0 derives
`MemberResponse.is_self` server-side, and the pair now reads it off the
generated schema instead of a defensive cast. It gates TWO controls, not one.
"Remove" was already asking. "Reset password" was not — and it is the worse
case: `MemberPasswordResetView` refuses the caller's own row with the
byte-identical 404 it gives for a stranger ("Yourself is not in the set this
endpoint acts on"), so an ungated button reads the backend's correct refusal
as "this member has been removed". Both are switched off through `GatedButton`
with the reason beside them, in en/ru/es. A backend that sends no `is_self`
still claims nothing: the absence reads as "the server did not say".

**The administrative password reset now exists on the glass.**
`useResetMemberPassword` had no consumer at all — the endpoint (#110) was
unreachable from any shipped screen. `<MembersManager/>` grows the control and
the dialog around it, and the dialog states the three things this operation is:
the step-up is ANNOUNCED before the click (the capability is declared `high`,
so `requires_verification(scope="sensitive")` will demand one), the generated
password is labelled as the one-shot credential it is and leaves the screen
when the dialog closes (the mutation is reset), and `notified: false` is said
out loud — it means the account had no channel to be told on, which makes the
admin the only person who can tell them.

**Four finished screens stop being undeclared.** `<WorkspaceSettings/>`,
`<MembersManager/>`, `<InvitationsPane/>` and `<AuditTrailPane/>` are in the
nav manifest, on paths relative to the account section, and their `workspaceId`
prop became OPTIONAL. The architecture answer the pair was waiting for: the
active workspace is RUNTIME state — the same state the container writes when a
person switches — not a path param of a settings URL. So a nav-mounted screen
reads it from the selection seam (`useOptionalWorkspaceSelection`, new export)
and a screen with no active workspace renders a designed "choose a workspace"
(and "you are not in a workspace yet" for a person who belongs to none) rather
than a blank page or a throw from a provider a shell forgot to wire.

**The showcase stops showing the test bench.** Seven default-skin demos, one
per `/default` export, each with a phone variant and variants seeded at
distinct steps — the roster with the viewer's own row refused, the settings
screen an owner may not delete, the terminal invitations, the audit line
nobody performed, the role field with no registry to read, the invitation page
on the wrong account. `gen:demos` goes 0/7 → 7/7 skin covered. A render test
per new surface at 390 and 1024, in light and dark, plus the `is_self` and
chooser cases: 164 → 187 tests.

Peer floors raised to the substrate the pair actually imports:
`@stapel/core >=0.18.0 <1.0.0` (`useTPlural`, `STAPEL_UI_KEYS`) and
`@stapel/tokens-antd >=0.6.0` (the skin surface).
