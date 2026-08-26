---
"@stapel/workspaces-react": minor
---

Visual pass 3: delete the legacy harness stories, and stop the screens saying
the same thing twice.

**The seven harness demos are gone** (`workspace-list`, `members--default`,
`accept-invitation`, `capability-gate`, `invite-accept-flow`,
`role-select--registry`, `workspaces-provider`). They shipped a debug card —
`state.step` chips, `1 workspace(s)`, "Grant exchanged", `members.invite
allowed` — beside the real skins that replaced them, so half of what this
package showed was the harness. The headless primitives they stood for are now
covered by the skin demo that renders each one (`covers:`), and `demo/_harness`
is the provider frame and nothing else. **Breaking for anyone who deep-links a
viewer story id.**

Screen fixes, each one a repetition or a contradiction:

- **Invitations.** A terminal row printed its refusal once per control — the
  same sentence six times on one phone screen. `RowActions` states it once per
  row, as a footnote spanning the row, with every switched-off control's
  `aria-describedby` pointing at it.
- **Workspaces page.** A failed read said so twice, in two wordings, with two
  recoveries (the create button's gate carried its own copy plus `HTTP 503`
  above the alert that already had the retry). One alert now, the control
  points at it, and the retry sits under the alert instead of squeezing its
  text into ~110px at 390px. The empty state no longer repeats the restriction
  the disabled control states.
- **Workspace settings.** "Require two-factor authentication" read ON while the
  line under it said two-factor was not required here — the note derived from
  the absence of an enforcement status instead of from the policy. Both now
  read the same value, and "no check has run yet" is its own sentence.
- **Invitation page.** A dead expired link was drawn in antd's *info* blue with
  nothing to do next; it is the warning tone, names the next step, and takes an
  optional `onExit` for the host's way out.
- **Members.** The refusals on the viewer's own row widened the action column
  until that row wrapped to the phone layout in the middle of a desktop table.
  One row geometry per breakpoint now. The empty roster has one "Invite", not
  two, and no search field over nobody.
- **Roles.** "It is not a workspace without roles." was not English. An empty
  registry no longer borrows the "we could not load" sentence.
- **Membership history.** `Role: admin` was the raw slug; it goes through the
  same registry labels as the picker. Events are grouped under their day, so a
  burst of three no longer prints one timestamp three times.

Additive API: `InviteAcceptPageProps.onExit`, `WorkspaceFormat.time()`,
`useRoleLabel()` (a role label with no `GET /roles` behind it — the public
invitation page cannot make that call).
