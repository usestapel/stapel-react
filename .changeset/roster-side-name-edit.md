---
"@stapel/workspaces-react": minor
---

Roster-side name edit: yesterday's backend release becomes callable from the
frontend, and the product drops its raw HTTP call.

Contract pin moved to stapel-workspaces `v0.19.0` (`>=0.19 <0.20`) and every
`gen:*` projection was regenerated against it in the same change: two
operations (`workspaces_api_v1_members_name_partial_update`,
`workspaces_api_v1_invitations_name_partial_update`) and five error keys —
the four display-name rules borrowed verbatim from stapel-profiles
(`error.400.display_name_too_short` / `_forbidden_chars` / `_invisible_chars`
/ `_emoji`) plus `error.503.profiles_unavailable`.

- `useRenameMember` — `PATCH /{ws}/members/{userId}/name`, an owner/admin
  fixing how a co-member is shown without waiting for that person. It
  invalidates **every** cached roster, not the one on screen: the backend
  writes the CANONICAL name (stapel-profiles' `Profile.display_name`, through
  the in-process profiles seam, which also publishes `profile.changed`), and
  `MemberResponse.display_name` is a live lookup of that one value — so the
  same person renders their old name on every other workspace's member list
  until those drop too. Hence the new workspace-less
  `workspacesQueryKeys.membersAll()` prefix, which also covers every page and
  every active `search` filter (a rename can move a row out of one).
- `useRenameInvitation` — `PATCH /{ws}/invitations/{invitationId}/name`, the
  same correction one step earlier, on a still-pending invitation's name
  hint. Before it, the only fix for a typo in an invitee's name was
  revoke-and-re-invite, which re-mails the person. Its blast radius is
  deliberately narrower: the hint is a workspace-local column on one
  invitation, so only that workspace's invitation lists are invalidated.

Both are gated on capability `members.role.change` — not the invitation
surface's `members.invite`, because the hint IS the member's name after
acceptance and splitting them would let a role fix a name that reverts. Ask
`useCapabilityGate(workspaceId, "members.role.change")` before offering the
affordance; the capability is `standard`, so no step-up is demanded.

Both accept `displayName: string | null`, because clearing is a real outcome
the backend supports and a dropped key would be ambiguous. Validation
failures arrive in the single error dialect with the borrowed keys;
over-length is the fleet-standard `error.400.field.max_length` with `{field,
max_length}`, not a bespoke code. Where stapel-profiles does not run in the
deployment's process the member rename answers
`error.503.profiles_unavailable` rather than a 200 over a write that did not
happen.

A host that also renders `@stapel/profiles-react` data for the renamed person
owns the other half of the invalidation (`profilesQueryKeys.profile(userId)`)
— this pair does not reach into another pair's query namespace.
