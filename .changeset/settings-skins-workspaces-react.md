---
"@stapel/workspaces-react": minor
---

Add the pair's first `/default` settings skin: `WorkspaceSettings` (rename, danger-zone delete gated to the `owner` role) and `MembersManager` (roster with per-row role change and removal, plus an invite dialog for emails + role — all gated by a host-supplied `canManage` prop derived from the caller's own membership).
