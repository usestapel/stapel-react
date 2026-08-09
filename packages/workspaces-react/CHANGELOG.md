# @stapel/workspaces-react

## 0.11.1

### Patch Changes

- 212a198: `useWorkspaceSelection` now really does return a stable bag.

  The memoisation was there but two of its dependencies were TanStack result
  objects — `useWorkspaces()`'s query and `useSetPreferredWorkspace()`'s
  mutation — and TanStack returns a NEW object on every render. So `refetch`
  and `switchTo` changed identity every render, and the bag with them.

  That is exactly the #251 failure the memoisation exists to prevent:
  consumers put `current` straight into `useEffect` dependency arrays, so an
  unstable bag re-runs those effects every render, and where the effect also
  sets state it is an unbounded render loop whose only symptom is a spinner
  that never resolves, with nothing in the console. The hooks now close over
  the stable `refetch` / `mutate` handles, and a regression test pins value
  identity across renders (and pins that it still CHANGES on a real switch).

  Found by adopting 0.11.0 in a product — the library's own tests asserted the
  resolution, not the identity.

## 0.11.0

### Minor Changes

- 766849f: Active-workspace selection, in the library instead of in every product.

  `WorkspaceSelectionProvider` + `useWorkspaceSelection` resolve "which
  workspace am I in" from three layers, and the order between them IS the
  design: **URL > localStorage > backend preference**, then the instance's
  `default_workspace_id`, then the personal workspace, then — last, and only
  last — the first row.

  `workspaces[0]` was the rule every product invented for itself, and it is
  #239: the list is ordered by `-last_accessed_at`, so the first row is
  "wherever you happened to be last", not a choice, and the owner's pending
  invitations sat in the org workspace while his screen showed his personal
  one. It survives only as the final fallback, where it is trivially right for
  the single-workspace majority.

  The URL layer is what makes several tabs each work in a different workspace,
  and it is bound through controlled props — `urlWorkspaceId` +
  `onUrlWorkspaceChange` — so this pair still depends on no router. A library
  reading `window.location` itself could not re-render on `history.pushState`
  (which emits no event), and a `{read, write}` adapter has the same defect in
  disguise. The host reads `?workspace=` however its router does and navigates
  when asked; a query parameter, not a path segment, so no host is forced to
  grow a `/w/:workspaceId/*` route prefix.

  Multi-tab independence is a stated rule, not an accident: local storage is
  read exactly ONCE, at mount, and never subscribed to. The obvious
  "improvement" — a `storage` event listener to sync tabs — is precisely what
  destroys the feature, because that event fires in the _other_ tabs and would
  drag tab B onto tab A's workspace.

  The write policy separates context from choice. `switchTo` (a picker click)
  writes all three layers, fire-and-forget on the backend so a flaky network
  never blocks the switch. Resolving from a shared link writes _nothing_ —
  otherwise one pasted URL would permanently repoint its recipient's home. A
  stale stored pointer is deleted rather than rewritten to the fallback, so an
  ossified guess cannot outrank a later-corrected preference.

  A URL naming a workspace the person cannot open (deleted, not a member,
  suspended — the backend deliberately does not distinguish) lands them through
  the rest of the chain, raises `urlWorkspaceInvalid` for a visible notice, and
  replaces the address bar so the broken URL is not reachable with back. Never
  a blank screen, and never a silent switch to another tenant's data.

  Also adds `useSetPreferredWorkspace` / `useClearPreferredWorkspace` over
  stapel-workspaces 0.20.0's `PUT`/`DELETE /me/preferred-workspace`, and
  `source` on the bag so "why am I here" is answerable from outside.

## 0.10.0

### Minor Changes

- a08cc85: Roster-side name edit: yesterday's backend release becomes callable from the
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

## 0.8.0

### Minor Changes

- f9c04aa: Ручки вчерашних релизов бэкенда стали вызываемыми с фронта.

  `@stapel/workspaces-react` (контракт stapel-workspaces `>=0.14 <0.15`):

  - `useInvitations` / `useInfiniteInvitations` — админская таблица приглашений
    (`GET /{ws}/invitations`) с фильтрами `status` (`pending` / `never_accepted`
    / `all`) и `search`. Пагинация **якорная**, как у `useMembers`: страница
    адресуется непрозрачным `next_anchor` предыдущей, номера страницы нет —
    оффсет поехал бы ровно в тот момент, когда приглашение отзывают у админа
    под руками.
  - `useRevokeInvitation` / `useResendInvitation` — отзыв и повторная отправка;
    обе возвращают обновлённый DTO. Ресенд ротирует токен и перезапускает TTL,
    поэтому таблица инвалидируется: старый `expires_at` на экране врал бы про
    живую креденцию.
  - `useResetMemberPassword` — админский сброс пароля участнику.
    `generated_password` приходит ровно один раз и **не попадает в кэш
    запросов** (ничего не пишется через `setQueryData`, `gcTime: 0`): рантайм
    ядра персистит весь пользовательский query-кэш в localStorage, так что
    запись туда означала бы живой пароль на диске и в девтулзах.
  - `useCapabilityGate` + порт `BUILTIN_CAPABILITY_LEVELS` — уровень `high` и
    скоуп `sensitive` известны **до** кнопки, а не после 403.
    `readVerificationEnrollment` отличает конверт «заведи фактор» (его ядро не
    перехватывает — перехватывать нечего) от обычного челленджа.
  - `useUpdateSecuritySettings` — `provisioned_user_policies` теперь список
    независимых требований (#90), пустой список отправляется явно. Мердж
    делается на клиенте: бэкенд присваивает `settings` целиком, и голый
    `{security: …}` стёр бы остальные ключи.

  `@stapel/profiles-react` (контракт stapel-profiles `>=0.9 <0.10`):

  - `useProfilesBatch` — `POST /profiles/api/v1/batch`, один запрос вместо N.
    `profileBatchEntry` отвечает четырьмя состояниями (`found` / `missing` /
    `not_requested` / `unknown`): «профиля нет» — нормальное состояние и
    плейсхолдер, «не спрашивали» — другое дело, и схлопывать их в `undefined`
    значило бы вернуть тот самый дефект, ради которого батч и делался.
    Найденные профили засеваются в кэш `useProfile`; для `missing` не
    выдумывается ничего.

## 0.7.0

### Minor Changes

- 2f27177: Org-program wave (spec §A2/§B4/§E): mandate model surface + invite flow.

  - **model**: `useCapabilities(wsId)` (reads `my_capabilities` off the workspace detail; wildcard-aware `can()`), `useRoles()` (GET /roles — the effective registry), `useInvitationPreview(token)` (AllowAny — deliberately NOT session-gated), `useClaimInvitation`, `useDeclineInvitation`. Backend-ported, semantics-synced utils: `capabilityMatches`/`hasCapability` (`*` and `prefix.*`) and `maskEmail`/`emailMatchesMask` (the preview's mask algorithm — drives §B4 session/email routing client-side without exposing the invitee's address).
  - **headless**: `Can` (static-children gate + render-prop verdict; deny-by-default — UI convenience, backend re-checks), `RoleSelect` (registry-driven roles; labels via `workspaces.role.<key>` with client-bundle merge and RAW-name fallback), `InviteAcceptFlow` — the §B4 flow machine (preview → accept-prompt / wrong-account / login slot / claim → grant → basic-data slot → accept/decline, terminal `unavailable` for dead invites).
  - **THE GRANT SEAM**: pairs don't depend on each other — `claim` hands the minted `grant_token` OUT via `onLoginGrant(grantToken)`; the HOST exchanges it at auth (`@stapel/auth-react`'s `exchangeLoginGrant`) and calls `grantExchanged()`. `InviteAcceptPage` automates the advance when the host callback's promise resolves.
  - **default**: `InviteAcceptPage` (the `/invite/{token}` route component — every flow state, with `renderLoginPanel`/`renderInitialSetup` host slots for auth-react and profiles-react); `MembersManager` now takes its role options from the registry via `RoleSelect` instead of the hardcoded builtin four.
  - **types**: `InvitationPreview`, `InvitationClaim`, `RoleInfo`, `RoleList`; `MemberRoleChange.role` widened to `string` (registry-extensible roles). Generated types regenerated against stapel-workspaces v0.8.0 — the 0.8 provision/suspension/security contract shapes are already carried; their model/headless/skins land in the next wave.
  - **i18n**: `workspaces.role.*` (builtin four), `workspaces.invite.*` (all flow states), en + ru.
  - Contract pin: stapel-workspaces → v0.8.0 (`df58135`), regen'd together.

## 0.6.0

### Minor Changes

- 6ef6c44: Gate top-level "the caller's own …" query hooks on `@stapel/core`'s new
  `useActiveSessionReady()` (owner-diagnosed live incident, 2026-07-17): a hook
  with no natural `enabled` condition of its own (`useWorkspaces`, `useWallet`,
  `useTransactions`, `useSubscription`, `useNotificationFeed`/
  `useInfiniteNotificationFeed`, `useCalendar`/`useEvents`/`useAvailability`,
  `useRecordings`) fires the instant a component mounts — which used to race a
  session still bootstrapping and read a live one as "expired". Detail hooks
  keyed by an id (`useWorkspace`/`useMembers`/`useEvent`/`useRecording`) now
  ALSO gate on session readiness in addition to their existing non-empty-id
  check, since an id can be known synchronously (e.g. a URL param) before the
  session settles.

  Deliberately NOT gated: `useCatalog` (billing) and `useLanguages` (profiles,
  unaffected by this changeset but worth noting for symmetry) — both are
  public reference lists a signed-out visitor legitimately needs.

  Zero manual wiring at any call site: `useActiveSessionReady()` reads
  whichever `SessionManager` a session-owning module (e.g.
  `@stapel/auth-react`'s `createAuthRuntime`) registered as "active", and
  defaults to `true` (never blocks) when no such module exists in the host at
  all.

## 0.5.0

### Minor Changes

- f15c6be: Add the pair's first `/default` settings skin: `WorkspaceSettings` (rename, danger-zone delete gated to the `owner` role) and `MembersManager` (roster with per-row role change and removal, plus an invite dialog for emails + role — all gated by a host-supplied `canManage` prop derived from the caller's own membership).

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
