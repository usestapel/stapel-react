---
"@stapel/workspaces-react": minor
"@stapel/recordings-react": minor
---

The pair the 2026-08-09 incident happened in.

`WorkspaceSelection` — the surface products actually consume — gains
`state: LoadState<readonly Workspace[]>` and LOSES `workspaces` and `loading`.
It previously had no error field at all, so a host saw `loading: false`,
`workspaces: []`, `current: null` for a 404 and could not tell that apart from
a person who belongs to no workspace. `current` stays, documented as null in
three different situations, which is why a screen must branch on `state`.

`WorkspaceListBag`, `MembersBag`, `RoleSelectBag` and `useCapabilities` take
the same cutover: one `state`, no flattened array, no `isLoading`/`isError`
read fields. `MembersBag` splits the read failure from `writeError` (an
invite/role/removal that failed is a different sentence). `CanBag` gains
`isUnknown` — deny-by-default still holds on a failed capability read, but a
skin can now say which of the two it is. `RecordingListBag` gains `state` and
loses `recordings`/`isLoading`/`isError`/`error`.

`<MembersManager/>` renders the roster through `matchList`, so a failed read no
longer produces an error banner AND antd's built-in "No data" illustration at
the same time; the role registry gets its own sentence rather than silently
yielding an empty picker. `<WorkspaceSettings/>` no longer greys out the name
field and Save with no explanation: `useActionGate` + `firstBlock` state
either "only the owner can change these settings" or "enter a workspace name"
as visible text.

New keys (en + ru): `workspaces.list.load_failed`,
`workspaces.members.load_failed`, `workspaces.members.empty`,
`workspaces.roles.load_failed`, `workspaces.retry`,
`workspaces.settings.blocked.not_owner`,
`workspaces.settings.blocked.name_required`,
`recordings.list.load_failed`, `recordings.retry`.
