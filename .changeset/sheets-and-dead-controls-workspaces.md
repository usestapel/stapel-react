---
"@stapel/workspaces-react": minor
---

The invite dialog is a bottom sheet on a phone, and the members table stops
offering removals the backend will refuse.

`MembersManager`'s `Modal` renders through `@stapel/tokens-antd/skin`'s
`SkinDialog` — this package now declares `@stapel/tokens-antd` as an optional
peer, like every other antd-skinned pair. The table gained
`scroll={{ x: true }}`.

Remove was rendered identically on every row, including the last owner's, which
the backend enforces against. When the roster is COMPLETE (`has_next` is false
— now surfaced on the bag as `rosterComplete`) "exactly one row holds owner" is
a fact, so that row's Remove is disabled with the reason printed beside it. On a
paginated roster nothing is claimed: a count of a page is not a count of the
roster, and gating on it would refuse a removal the backend would allow.

The caller's OWN row is still not gated, and deliberately: `MemberResponse`
carries no `is_self`, and the pair has no caller identity to compare `user_id`
against (core's session exposes a status, the mandate axis a role — neither is
"who am I"). Guessing would grey out somebody else's row. The backend needs one
additive field: `is_self` on `MemberResponse`, or the caller's `user_id` on the
members page envelope.

When the role registry read fails, the per-row role `Select` no longer renders
enabled over an empty option list; the role still reads as text and the invite
dialog states the outage instead of offering a picker with nothing in it.
