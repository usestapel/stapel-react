# @stapel/workspaces-react

## 0.1.0

### Minor Changes

- 0786d55: Russian locale as an opt-in `@stapel/workspaces-react/i18n/ru` subpath
  (i18n-shipping wave 2, following the auth-react etalon — wave 1).

  - `errors.ru.gen.ts` — generated per-locale error bundle, auto-discovered by
    the shared `gen-errors.mjs` driver from stapel-workspaces's
    `translations/errors.ru.json` catalog. `pnpm gen:errors:check` remains the
    drift gate; existing en outputs are byte-identical.
  - `@stapel/workspaces-react/i18n/ru` — `workspacesI18nBundleRu` (generated
    backend ru + hand-written ru UI copy) and `registerWorkspacesI18nRu(engine)`,
    which registers the en floor UNDER the ru texts so a missing key degrades
    to English, never to a raw key. Host bundles registered after the pair's
    win (merge-priority convention, now documented on `registerWorkspacesI18n`).
  - Tree-shake purity is gated twice: the main-entry size-limit budget is
    unchanged (the ru locale is not in its graph; the ru subpath is its own
    chunk with its own budget) and `test/i18nRu.test.ts` walks the compiled
    `dist/index.js` module graph asserting the ru modules never appear.

- 1af230c: New headless React flow pair for **stapel-workspaces** — the fourth pipeline pair
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

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
