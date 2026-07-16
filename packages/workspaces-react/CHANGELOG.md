# @stapel/workspaces-react

## 0.4.1

### Patch Changes

- ae57230: v1 canon sweep §60 (api-versioning.md §2, §6): regenerated schema.ts /
  flows / manifest / llms.txt against the backends' `/…/api/v1/` contracts;
  gen scripts and manifest tag prefixes repointed to `/api/v1/`; documented
  `baseUrl` examples and the auth QR same-origin guard now use
  `/<mod>/api/v1/`. Public TS types unchanged — only the fetch base / path
  literals carry the new version segment. Mount your runtimes at
  `/<mod>/api/v1/`.

## 0.4.0

### Minor Changes

- b1b327e: Track stapel-workspaces 0.4.x (scheme B; contract pin bumped to the `0.4.1`
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

### Patch Changes

- 2fa025a: §17 arch-contract-pipeline Wave 2 + Wave 3 — the five original pairs are now
  self-contained per-module contracts, aligned to their backend minor.

  **Wave 2 (contract isolation).** Each pair generates its typed surface from its
  backend module's OWN committed `docs/{schema,flows}.json` (byte-identical to the
  former monolith slice) instead of the unified monolith aggregate:

  - `gen:api` emits a package-LOCAL `src/api/generated/schema.ts` per pair (via the
    `API_SCHEMA`/`API_OUT` knobs — the calendar/recordings §17-native shape);
    `api/types.ts` aliases `components` from `./generated/schema.js`, no longer from
    `@stapel/core`. `@stapel/core` stays a RUNTIME peer (client / react-query),
    not the type source.
  - `gen:flows` reads `../stapel-<mod>/docs/flows.json`; `gen:manifest` reads the
    per-module `docs/schema.json`. Public types are unchanged — the repoint is a
    zero-diff source-swap (byte-identity proven), so no consumer breaks.

  **Wave 3 (version scheme B).** Each pair's minor now tracks its backend minor:
  `auth-react → 0.5.0` (stapel-auth 0.5.x), `notifications-react → 0.3.0`,
  `profiles-react → 0.3.0`, `billing-react → 0.4.0`, `workspaces-react → 0.3.0`.
  `manifest.backend.contract` records the one-minor compatibility window
  (`>=0.5 <0.6` etc.), auto-derived from the backend `pyproject.toml`.

- 4e6f442: Internal plumbing swap (slim wave §21/S2) — the pair's stamped
  `model/runtime.ts` / `model/context.tsx` / `headless/<Mod>Provider.tsx`
  boilerplate (byte-identical across the six standard pairs) now binds
  `@stapel/core`'s `createModuleRuntime` / `createModuleContext` factories
  instead of carrying its own copy. Public API preserved exactly: same exported
  names and signatures (`create<Mod>Runtime`, `<Mod>Runtime`,
  `Create<Mod>RuntimeOptions`, `<Mod>RuntimeContext`, `use<Mod>Runtime`,
  `use<Mod>Api`, `use<Mod>Analytics`, `<Mod>Provider>`), same guard-hook error
  messages. No behavior change.
- c3482e7: README wave (slim wave §21/S4): every pair now documents its setup — a new
  Install + "Wire the app once" section built on core's `<StapelProvider>`
  (previously only auth-react's README showed any wiring, as a 5-level provider
  nest). auth-react's wiring example moves to the one-provider shape with the
  `queryRuntime`/`i18n` escape hatches spelled out.
- d3232a9: Zero-flow scaffolding removed (slim wave §21/S3). These six backends annotate
  no `@flow_step`, so `gen:flows` now skips emission for them and the pair's
  `src/flows/generated/` files are gone. The public flow surface is preserved
  exactly by a tiny hand-written shim (`src/flows/registry.ts`): `<MOD>_FLOWS`
  (still `{}`), `<Mod>FlowId`/`<Mod>FlowSpec` (still `never`), `FlowEndpoint`,
  and `flowEndpoints` keep their names, types, and behavior. `toFlowError` and
  the core flow-machine re-exports are untouched. No public-surface delta; the
  generated registry returns automatically once the backend documents its first
  flow.

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
