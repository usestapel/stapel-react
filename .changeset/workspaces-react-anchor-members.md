---
"@stapel/workspaces-react": minor
---

Track stapel-workspaces 0.4.x (scheme B; contract pin bumped to the `0.4.1`
HEAD — G12 anchor pagination for member listing). **Breaking**: `GET
/{id}/members` is no longer a flat array wrapper — it is now an
anchor-paginated page (core `AnchorPagination`, the same shape as
notifications-react's feed), matching the backend's move off unbounded member
listing:

- **`MemberListData`** (the `MemberList` export) now aliases
  `PaginatedMemberResponseList` — `{ items, next_anchor, prev_anchor, has_next,
  has_prev, count }` — instead of `{ members }`. Read `.items` where you used
  to read `.members`.
- **`useMembers(workspaceId, params?)`** takes an optional second
  `MembersParams` (`{ anchor, direction, limit, search }`, all optional; no
  params fetches the newest page, default limit 100/max 500) and its query key
  now carries those params (`workspacesQueryKeys.membersPage`); the bare
  `workspacesQueryKeys.members(workspaceId)` prefix still invalidates every
  page (mutations unchanged).
- **`WorkspacesApi.listMembers(workspaceId, params?)`** sends
  `?anchor=&direction=&limit=&search=`.
- `<Members>` (headless) is unaffected at the call-site level — it still hands
  `children` a flat `members` array (now sourced from the page's `.items`,
  first page only; a follow-up can add pager controls to its bag for consumers
  with >100 members).

`backend.contract` is now `>=0.4 <0.5`.
