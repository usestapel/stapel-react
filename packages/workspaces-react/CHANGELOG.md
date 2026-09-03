# @stapel/workspaces-react

## 0.19.1

### Patch Changes

- f79bdc3: tokens-antd: a gated control is semantically off and interactively ALIVE — it can be tapped, focused, and can say why it will not do the thing

  `GatedControl` handed callers `bind.disabled` and its own JSDoc told them to spread it straight onto the control. That produced an html-`disabled` element, which fires no events in any browser: it cannot be clicked, cannot take focus, cannot be described to a screen reader that never reaches it, and cannot carry the one gesture that mattered — the tap that should open the sign-in door standing behind the gate. Every gated control across the ~20 pairs using it was inert, and the wrong instruction was half the defect: the docs taught the shape that broke it.

  Measured on a live deployment: an anonymous visitor taps the favourite heart and nothing happens at all — no sentence, no tooltip, no door (walker defects D45/D72).

  **The corrected contract.** While the gate is shut a control is now `aria-disabled="true"` and NOT html-disabled, so it stays focusable and keeps receiving events. The ACTION is suppressed by `GatedControl` itself, in a capture-phase wrapper (`display: contents`, so no pair's layout moves by a pixel): the caller's `onClick`, keyboard activation, typing, IME input, paste and drop are swallowed before the control sees them. Callers write their handlers exactly as if the gate did not exist. The activation comes back as the new `onBlockedActivate`, which is where a pair opens its door. The reason stays where it was — visible text wired by `aria-describedby` — and where a `PaneGate` pools it into one footnote, the gesture now brings a `role="status"` copy of the sentence back to the control it belongs to. A blocked `GatedButton` keeps antd's exact disabled paint (its own `-disabled` class, which sets no `pointer-events`), so nothing about any screen looks different.

  `GatedControlProps.whenBlocked` holds the two deliberate opt-outs, neither of them the default:

  - `"inert"` — html `disabled`, for the rare control that must be switched off at the browser level. `attributes-react`'s catalogue lock is the one place in the fleet that asks for it, and now says so.
  - `"annotate"` — the control stays fully usable and only gains the sentence, for a gate that judges the VALUE rather than refusing the person: `calendar-react`'s slot-length field must stay editable, because editing it is how the reason goes away, and `search-react`'s sort must still pick the options that are not the blocked one.

  `useBlockedButtonClassName()` is exported for render-prop call sites that paint their own button and want the same unavailable look rather than a second grey.

  **⚠️ The readiness-signal hazard, and its cure.** `element.disabled` is now permanently `false` on every gated control in the fleet. Any test using it as a readiness signal — `await waitFor(() => expect(save.disabled).toBe(false))`, meaning "wait until this is allowed" — returns instantly and mis-times SILENTLY: every assertion after it reads an unseeded component, and the failure looks like broken product logic rather than a gate that had not opened. One pair's suite went green → 21 failures across unrelated files on exactly this. Wait on the stamp instead, which is what such a wait was always asking:

  ```ts
  await waitFor(() =>
    expect(
      screen.getByTestId("save-gate").getAttribute("data-stapel-gated")
    ).toBe("available")
  );
  ```

  `data-stapel-gated="available" | "blocked"` is on the wrapper of every gated control in all three modes (`GatedButton` names it `<testId>-gate`). For a point assertion on one element, read `aria-disabled`. Never `disabled`.

  **ChoiceChips** carried the same defect on its own chips and is fixed the same way: a chip at the cap is `aria-disabled` and focusable, and the tap is refused in the handler, so the row's sentence reaches a keyboard.

  **The consumers.** Every `GatedButton` call site (64 imports across 20 pairs) is fixed with no code change — the correction is in the substrate. The render-prop call sites that consumed the binding field-by-field now spread it whole: `billing-react`'s auto-recharge switch, `calendar-react`'s RSVP buttons, `moderation-react`'s sanction checkbox, `notifications-react`'s push switch, `attributes-react`'s at-max add button. `tasks-react`'s assignee picker is a host slot rendering its own control out of reach of the suppression, so it is handed a plain verdict on purpose. `workspaces-react` had two hand-rolled gates that never went through `GatedControl` at all — a row-action column and the create button on a failed roster read — and both now use the same anatomy.

## 0.19.0

### Minor Changes

- 57bd738: Visual pass 3: delete the legacy harness stories, and stop the screens saying
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
  - **Invitation page.** A dead expired link was drawn in antd's _info_ blue with
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

## 0.18.0

### Minor Changes

- 80617e9: The pair becomes the product: the delete button stops lying, the MFA policy gets a screen, and the invitation console exists

  **The refusal a screen used to promise.** `<WorkspaceSettings/>` drew "Delete
  workspace" from `my_role === "owner"` — the exact derivation stapel-workspaces
  0.26.0 added `WorkspaceResponse.can_delete` + `delete_blocked_reason` to
  replace, because an owner of the instance's default workspace or of a personal
  one gets a 409. The control now reads the server's verdict through
  `GatedControl`, and prints the server's own refusal CODE as a sentence beside
  it — translatable at last, because the generated error bundle was five codes
  behind the backend (`error.409.workspace_is_instance_default`,
  `workspace_is_personal`, `error.429.invitation_grant_pending`,
  `error.503.billing_unavailable`, `error.503.mandate_unavailable`). The test
  that cemented the old rule now asserts the new one. Name and security editing
  are gated on the CAPABILITIES the server granted (`workspace.update`,
  `workspace.security.manage`), falling back to the pre-0.6 owner rule only when
  a backend sends no `my_capabilities` at all.

  **Four screens that were hooks with no pixels.** `<WorkspacesPage/>` (the §54
  default skin `WorkspaceList` never had: roster, create gated on
  `can_create_workspace`, preferred-workspace choice, guest and closed-instance
  copy), `<InvitationsPane/>` (list / revoke / resend / rename — four API methods
  and zero pixels until now, each control gated on the invitation state the
  endpoint would refuse), `<AuditTrailPane/>` (the membership history, action
  vocabulary as sentences, timestamps as "3 days ago (23 Sept 2026, 09:00)"), and
  `<RoleSelectField/>` (a real `<Select>` with an accessible name and the rank as
  a caption, where the story used to show five bullet points).

  **MFA enforcement, visible.** `mfa_enforcement` (state, coverage, unverified
  members, last error) is drawn beside the `require_mfa` switch that
  `useUpdateSecuritySettings` now actually has a consumer for, and
  `MemberResponse.mfa_compliant` is a per-member tag with three states — true,
  false, and "nobody has asked yet".

  **Members reach page two.** `<Members>` takes `params` and exposes `page`
  (anchor cursors + `has_next`/`has_prev`); the roster ships a pager and a
  search box. `rosterComplete` now also requires `has_prev === false`, so the
  last-owner claim is not made from the last page of a longer roster.

  **Substrate migration.** Local `src/default/ErrorAlert.tsx` deleted; every
  screen self-themes through `<SkinTheme>`, confirms are `SkinConfirm` (no
  `Popconfirm`), load arms are `LoadList`/`LoadBoundary`, blocked controls are
  `GatedButton`/`GatedControl`, and the unfilled `renderLoginPanel` slot renders
  a `SlotPlaceholder` instead of a hole. Doctrine lint: 99 warnings → 0.

  **i18n.** `es` went from 1 translated UI key to complete; `ru` stays complete
  over a bundle that roughly tripled. Counts render through CLDR plurals
  (`useTPlural`) instead of `1 workspace(s)`, and dates through a new
  `useWorkspaceFormat()` in the model layer instead of raw ISO.

  BREAKING (pre-1.0, hence minor): `MembersBag` gained `page`/`rename`/
  `isRenaming`, `RoleSelect`'s `labelFor` now title-cases an unlabelled registry
  role (`secretary` → `Secretary`) instead of returning the raw token, and
  `src/default/ErrorAlert.tsx` is gone — import `ErrorAlert` from
  `@stapel/tokens-antd/skin`.

- 308e3d6: `is_self` closes two lying controls, the four admin screens get doors, and every default-skin screen is finally photographed

  **The row the roster could not identify.** stapel-workspaces 0.30.0 derives
  `MemberResponse.is_self` server-side, and the pair now reads it off the
  generated schema instead of a defensive cast. It gates TWO controls, not one.
  "Remove" was already asking. "Reset password" was not — and it is the worse
  case: `MemberPasswordResetView` refuses the caller's own row with the
  byte-identical 404 it gives for a stranger ("Yourself is not in the set this
  endpoint acts on"), so an ungated button reads the backend's correct refusal
  as "this member has been removed". Both are switched off through `GatedButton`
  with the reason beside them, in en/ru/es. A backend that sends no `is_self`
  still claims nothing: the absence reads as "the server did not say".

  **The administrative password reset now exists on the glass.**
  `useResetMemberPassword` had no consumer at all — the endpoint (#110) was
  unreachable from any shipped screen. `<MembersManager/>` grows the control and
  the dialog around it, and the dialog states the three things this operation is:
  the step-up is ANNOUNCED before the click (the capability is declared `high`,
  so `requires_verification(scope="sensitive")` will demand one), the generated
  password is labelled as the one-shot credential it is and leaves the screen
  when the dialog closes (the mutation is reset), and `notified: false` is said
  out loud — it means the account had no channel to be told on, which makes the
  admin the only person who can tell them.

  **Four finished screens stop being undeclared.** `<WorkspaceSettings/>`,
  `<MembersManager/>`, `<InvitationsPane/>` and `<AuditTrailPane/>` are in the
  nav manifest, on paths relative to the account section, and their `workspaceId`
  prop became OPTIONAL. The architecture answer the pair was waiting for: the
  active workspace is RUNTIME state — the same state the container writes when a
  person switches — not a path param of a settings URL. So a nav-mounted screen
  reads it from the selection seam (`useOptionalWorkspaceSelection`, new export)
  and a screen with no active workspace renders a designed "choose a workspace"
  (and "you are not in a workspace yet" for a person who belongs to none) rather
  than a blank page or a throw from a provider a shell forgot to wire.

  **The showcase stops showing the test bench.** Seven default-skin demos, one
  per `/default` export, each with a phone variant and variants seeded at
  distinct steps — the roster with the viewer's own row refused, the settings
  screen an owner may not delete, the terminal invitations, the audit line
  nobody performed, the role field with no registry to read, the invitation page
  on the wrong account. `gen:demos` goes 0/7 → 7/7 skin covered. A render test
  per new surface at 390 and 1024, in light and dark, plus the `is_self` and
  chooser cases: 164 → 187 tests.

  Peer floors raised to the substrate the pair actually imports:
  `@stapel/core >=0.18.0 <1.0.0` (`useTPlural`, `STAPEL_UI_KEYS`) and
  `@stapel/tokens-antd >=0.6.0` (the skin surface).

- 95e8eec: The invite dialog is a bottom sheet on a phone, and the members table stops
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

## 0.17.0

### Minor Changes

- ace82db: `useMandateSource()` — this module's derivation in the shape core's
  `<MandateProvider>` takes. A screen reads the axis with `useMandate()` from
  `@stapel/core` and no longer imports this package to do it, which is what
  lets the same screen work on a public surface that has no workspace list at
  all. `useMandateState()` and its behaviour are unchanged; the `@stapel/core`
  floor rises to the release that carries the seam.

## 0.16.0

### Minor Changes

- e25e9a6: `useMandateState()`, and a `resolveNav` that consumes the surface axis.

  `is_guest` has ridden the workspace-list response since stapel-workspaces
  0.19 and had **zero readers**. `useMandateState()` is the first one: the
  single point of truth for "does this person hold a mandate anywhere",
  computed from two answers that already existed — the active session's status
  (which settles anonymous and no-session without asking anyone) and the
  server's own `is_guest` predicate. No new endpoint, and no extra request:
  it reads the same `useWorkspaces()` a screen is already running.

  The server evaluates the predicate; the hook does not re-derive it. A caller
  can hold membership rows that grant no mandate, so `workspaces.length` is not
  the question — it is consulted only against a backend too old to answer.

  The unresolved case is the reason the hook is shaped the way it is. A list in
  flight and a list that 502'd both resolve to `unresolved` with a reason, and
  neither ever resolves to `guest`. The one-liner this forecloses —
  `data?.is_guest ?? true` — turns every backend hiccup into "you are a guest",
  locks members out of their own product, and explains nothing; there is no
  expression of that shape available, because the pending and failed states
  carry no principal to read. Render it with `matchMandate`: a wait, or the
  outage stated out loud.

  `resolveNav` now takes an optional `{ audience }` and every `ResolvedNavEntry`
  carries its resolved `surface`. Omit the audience and nothing changes — the
  scaffold-codegen call site keeps baking every route, and so does every
  existing runtime caller. Pass one and a screen closed to that principal is
  dropped, menu entry and route together, which is the fix: the tree a host
  mounts from is the tree the axis filtered. A project's override file can flip
  `menuVisible` and `order`; it deliberately cannot flip this, because a
  per-project preference must not put a screen that will refuse the caller back
  in front of them.

  `audience` is a `MandatePrincipal`, so `"unresolved"` cannot be passed. A host
  whose mandate has not settled has to render the wait or the error rather than
  resolve a nav for it — the alternative is a menu that quietly empties itself
  whenever the backend hiccups, which is "we could not ask" rendered as "you
  may not".

## 0.15.1

### Patch Changes

- a8bd3f4: Raise the `@stapel/core` peer floor to the version that actually exports what each package imports.

  `@stapel/workspaces-react` 0.15.0 shipped declaring `>=0.12.0` while importing
  `LoadState`, which core did not export until 0.13.0. npm installed it happily;
  the host's typecheck then failed on a type the package's own `.d.ts` referenced
  and the host could not resolve. Nine packages were wrong the same way — most by
  a wider margin (`recordings-react` allowed 0.3.0).

  Nothing here could have caught it by building: in this monorepo every package
  compiles against the workspace core, always the newest one, so a declared floor
  is never the version anything is compiled against. `pnpm check:peer-floors` now
  reads each package's imports from `@stapel/core`, asks core's own tagged history
  which release first exported each name, and fails when the floor is older —
  wired into CI **and** the publishing path, since a gate only on the merge path
  does not stop a release.

  Also invalidates the workspace audit query after an invite, a role change and a
  removal: the history sits beside the roster and an admin who acts on one expects
  to see it in the other. Its key is its own root, so the members invalidation did
  not reach it.

## 0.15.0

### Minor Changes

- Catch up to stapel-workspaces 0.24.1: the membership audit, the workspace
  creation policy, and who owns a space.

  `useAudit(workspaceId, params?)` — the workspace's membership history
  (`GET {id}/audit`), anchor-paginated like the member and invitation lists.
  Nothing kept a record before: the comm events that module emits are
  notifications nobody stores, and half the transitions emit nothing at all. Every
  product that grew an admin screen therefore had the same unanswerable question,
  and the first one to need it wrote a bespoke fetch through the runtime client —
  the copy this hook exists to make unnecessary.

  `useCanCreateWorkspace()` — the SERVER's answer for this caller
  (`can_create_workspace`), not a rule re-derived from the deploy shape. Ask it
  before drawing a "+ New space" control: the same helper answers the gate on
  `POST /workspaces`, so a drawn button always opens. Fails closed while loading.

  `Workspace.owner_display_name` now rides the generated types: a workspace name
  stopped identifying a workspace once a person could hold several "Personal" ones
  and ownership could change hands, so pickers draw the owner as a second line.

  New wire types `AuditEvent` / `AuditPage` / `AuditParams`, and the generated
  schema is regenerated against the corrected contract — 0.24.0 advertised a bare
  array for the audit page while the endpoint sent the pagination envelope, fixed
  in 0.24.1 before any consumer shipped against it.

## 0.14.0

### Minor Changes

- 400f9e6: The pair the 2026-08-09 incident happened in.

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

## 0.13.0

### Minor Changes

- a5b8faa: Spanish ships as a locale of the pairs: the `./i18n/es` subpath

  Each of these five pairs gains a generated Spanish error bundle
  (`src/i18n/generated/errors.es.gen.ts`) and the `@stapel/<pair>/i18n/es` subpath
  that makes it reachable — `registerXI18nEs(engine)`, mirroring the existing `ru`
  contour. Key counts, complete over each backend's error registry by
  construction: auth 127, workspaces 67, profiles 53, billing 53,
  notifications 43.

  **Declared coverage — read this before adopting.** The `es` bundle translates
  the BACKEND ERROR CODES only. The pairs' own UI copy (`AUTH_I18N_KEYS` and its
  siblings) has no hand-written Spanish yet, and `registerXI18nEs` deliberately
  registers the en floor UNDERNEATH the Spanish texts, so those keys resolve to
  their English text — never to a raw key. A Spanish-speaking user therefore reads
  Spanish error messages and English UI copy. That boundary is asserted in each
  pair's `test/i18nEs.test.ts`, not left to be discovered. Hand-written Spanish UI
  copy lands later, additively: the subpath and the `xI18nBundleEs` export keep
  their names and shapes when it does.

  The locale stays out of the main entry (size-limit budget per subpath + a
  module-graph purity test), so hosts that never register it carry none of it.

  Regenerated against bumped contract pins — auth v0.20.1, notifications v0.7.1,
  billing v0.6.1, workspaces v0.22.1 (profiles was already pinned at v0.12.0,
  which already carried its catalogue). Besides the catalogues, those pins bring:

  - **auth** — two new error codes, `error.403.privileged_account` and
    `error.403.registration_closed`; and the OTP `code` field's documented length
    goes 4 → 8 digits across the password/TOTP/disable-otp request bodies. In the
    emitted TypeScript this is a doc-comment change only (`maxLength` is a runtime
    validation, not a TS type), so no generated type moved.
  - **workspaces** — one new error code, `error.503.profiles_not_configured`: the
    deployment-has-no-profiles-service half of the member-rename 503, distinct
    from `error.503.profiles_unavailable` (the call was made and failed).
  - **notifications** — the push-token register/unregister permission is restated
    as `IsNotAnonymousUser`; OpenAPI description prose only.
  - **billing** — nothing but the catalogue and the backend-version pin.

  No path, method, field or type was added, removed or retyped in any pair's
  generated `schema.ts`. `calendar-react` and `recordings-react` are deliberately
  untouched: `stapel-calendar` and `stapel-recordings` ship no locale catalogues at
  all (they have no Russian either), and a fabricated empty Spanish file would only
  make the set look uniform.

## 0.12.0

### Minor Changes

- c5c0a11: Default skins render the error surface through core's split copy: the human
  sentence as the alert's message, and the technical detail (`HTTP 500`) as a
  muted, small description beside it instead of a protocol number spliced into
  the sentence. Requires `@stapel/core >= 0.12.0`.

## 0.11.2

### Patch Changes

- 3ac8297: fix: the error surface a 500 puts on screen — readable, and in the user's language

  Two defects an owner hit behind a backend 500 on a live sandbox, both fixed at
  their root rather than at the one alert that showed them.

  **The alert was unreadable on a dark deployment.** `@stapel/tokens-antd`'s
  `readLiveCssVar` served the host's LIVE `--stapel-*` custom properties for
  whatever mode the caller asked for — but those properties resolve through the
  document's active `data-theme`, so they are the DOCUMENT's mode, not the
  caller's. A default skin defaulting `mode` to `"light"` inside
  `<html data-theme="dark">` therefore got antd's LIGHT algorithm (deriving
  `--ant-color-error-bg: #fff2f0`, near-white) welded to a LIVE DARK
  `--ant-color-text: #f4f5f7` — measured 1.00:1 contrast.

  - `resolveThemeMode()` (new export) reads the same `data-theme` attribute
    `@stapel/tokens`' `tokens.css` keys its dark block on. `mode` is now optional
    on `toAntdTheme`/`toAntdThemeConfig` and defaults to it.
  - `readLiveCssVar` serves a live value only when the document is in the mode
    being asked for; otherwise the compiled-in default for the REQUESTED mode.
    The bridge can no longer emit a blended theme.
  - Every `@stapel/profiles-react` default skin defaults `mode` to
    `resolveThemeMode()` instead of `"light"`, so it self-themes with no host
    wiring. Pass `mode` explicitly to pin a side.

  **The alert showed `Request failed with status 500`.** That is
  `parseErrorEnvelope`'s own diagnostic for a response with no error envelope (a
  Django 500 under `DEBUG=False` returns HTML) — the HTTP client's internals, in
  English, on a Russian UI. The one-dialect machinery existed but had no rung a
  query/mutation-driven skin could reach, and no catalogue behind the codes core
  itself mints.

  - `@stapel/core` now ships an error FLOOR (`stapel.http.*`,
    `stapel.transport.failed`, `stapel.error.unknown`) in en and ru, seeded by
    `createI18n` under every locale before any caller bundle — a host wires
    nothing, and any pair or host bundle registered later still wins the key.
  - `useErrorText()` (new export) folds ANY thrown value into that dialect in one
    call, which is what a skin holding `error: unknown` needed.
  - `formatFlowError` exposes the error's HTTP `{status}` to templates and widens
    core's OWN `stapel.http.<status>` codes to a class-wide `stapel.http.5xx`
    entry. Real backend codes are never widened — two different 404s stay two
    different states.
  - Default skins across profiles-react, auth-react, notifications-react and
    workspaces-react now render `useErrorText(...)` instead of `error.message`.

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
