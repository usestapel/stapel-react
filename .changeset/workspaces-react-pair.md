---
"@stapel/workspaces-react": minor
---

New headless React flow pair for **stapel-workspaces** — the fourth pipeline pair
(final of the first wave) after notifications, profiles, and billing (scaffolded
by `stapel-new-react-lib`, tools 0.8.2). Business + state only, zero visual
opinion, built on `@stapel/core`'s StapelClient.

- **API surface (`workspacesApi`)** — ten typed operations over the signed-in
  workspaces endpoints: `listWorkspaces` / `createWorkspace` / `getWorkspace` /
  `updateWorkspace` / `deleteWorkspace` / `listMembers` / `inviteMembers` /
  `updateMemberRole` / `removeMember` / `acceptInvitation`. Wire types alias the
  generated `@stapel/core` schema (two documented corrections: `WorkspaceRole`
  and `WorkspaceKind` narrow the backend's bare `role` / `type` strings to their
  `TextChoices`). The service-to-service `GET /internal/{ws}/members/{user}` and
  `POST /internal/users/{user}/personal` are intentionally excluded —
  machine-to-machine surfaces, not part of the signed-in UI.
- **Model hooks** — read hooks `useWorkspaces` / `useWorkspace` / `useMembers`
  and write hooks `useCreateWorkspace` / `useUpdateWorkspace` /
  `useDeleteWorkspace` / `useInviteMembers` / `useUpdateMemberRole` /
  `useRemoveMember` / `useAcceptInvitation`, all under the namespaced
  `workspacesQueryKeys`. Membership and ownership are server truth (roles gate
  access cross-service via the membership cache), so no mutation is optimistic
  (frontend-core-architecture §2.6).
- **Headless components** — `WorkspaceList` (the caller's workspaces + create),
  `Members` (roster + invite / role-change / removal for one workspace), and
  `AcceptInvitation` (join by email-link token), plus the `WorkspacesProvider`
  root. Each ships a demo (completeness gate green) and msw happy-path tests,
  including a negative case that surfaces a localizable
  `error.400.invitation_expired`.
- **i18n** — an English `workspaces.*` key bundle spread over the generated
  backend error fallbacks, so a `StapelApiError.code` never renders as a raw key.
