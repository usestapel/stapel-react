# @stapel/forms-react

## 0.3.0

### Minor Changes

- 1d3e11e: True to stapel-forms 0.4.0: gate the response writes on the projected capability, and stop drawing an outage as a denial.

  **The floor moves, so this is a minor.** `manifest.json`'s backend contract goes
  `>=0.2 <0.3` → `>=0.4 <0.5`. 0.4.0 asserts that a `403` and a workspaces outage
  are distinguishable, and on an older server they are not — a host reading this
  pair's behaviour against forms 0.3.x would be told something untrue about its
  own deployment.

  - **`forms.responses.manage` is gated, and NAMED.** stapel-forms 0.3.0 started
    projecting which capability gates which route (`docs/capabilities.json`,
    `x-stapel-capability` on all sixteen gated operations) — but no payload
    carries the caller's grants, so they are **provided rather than computed**:
    `createFormsRuntime({ capabilities })`, fed from `my_capabilities` in a tenant
    app or a session claim elsewhere. `<ResponsesPane>`'s override field and both
    write buttons now sit under ONE `GatedControl`, so a caller who lacks the
    capability sees the block switched off with the permission written beside it
    and `aria-describedby` linking all three controls to that one sentence.

    **Omitting `capabilities` gates nothing** — `judgeCapability` has three
    answers and `unknown` is not `denied`. A guessed "you may not" is the same
    defect as a dead button, and the server re-checks every request regardless.
    `capabilityMatches` is a port of the backend matcher, wildcards included.

  - **The 503 arm exists, as a state of its own.** Core 0.47.0 gave
    `require_capability` a third answer, forms 0.4.0's `unavailable` branch fires,
    and a workspaces outage is now `503 error.503.forms_workspaces_unavailable`
    instead of a `403`. `classifyGateRefusal(error)` names which of the two you
    have — code first, status second, `null` for everything that is not the gate
    — and `<ResponsesPane>` draws them apart: the denial says which permission to
    ask for and offers **no** retry, the outage says it is on our side and offers
    one. Anything else keeps its own sentence, so a 500 is never relabelled as a
    permission problem.

  - **The caveat is deleted, not softened.** Every line of this pair that repeated
    the retired contract warning — that the pair "does NOT pre-gate … the contract
    exposes none" and that a 403 might not be a verdict — is gone from
    `ResponsesPane`, the skin demo's description, README and MODULE.md. A stale
    caveat here would not be out of date, it would be false.

  New public surface off the main entry: `FORMS_CAPABILITIES`,
  `capabilityMatches`, `judgeCapability`, `useFormsCapability`,
  `useFormsCapabilityGate`, `classifyGateRefusal`, `FORMS_FORBIDDEN`,
  `FORMS_WORKSPACES_UNAVAILABLE`, and the `CapabilityVerdict` / `FormsCapability`
  / `GateRefusal` types. Three i18n keys in en+ru+es. Tests 160 → 168.

- 80617e9: Ship the feature, not just the backend: form settings, delete, nav, and the skin on the shared substrate.

  **The gap that made this a minor.** `PATCH /forms/<id>` is the only writer of
  `Form.settings`, and `Form.settings` is where a form's notification
  destinations live. Both `useUpdateForm` and `useDeleteForm` were exported with
  **zero callers** — so a form authored entirely through the shipped skin
  collected responses that reached nobody, and could never be removed. The
  module's whole `form.submission.received` → notification half was unreachable
  from the product.

  - **`<FormSettingsPane>` / `<FormSettingsEditor>`** — title, `notify_emails`,
    `notify_telegram_chat_ids`, `retention_days`. The `settings` bag is patched
    whole with the host's own unknown keys preserved (the backend REPLACES it);
    a malformed-looking address is a notice, never a refusal (the server does not
    validate them, so refusing would be a verdict this pair cannot give); the
    retention ceiling is a deployment setting no client can read, so a too-long
    override arrives as `error.400.forms_invalid_retention`. With nothing
    configured, the pane says so.
  - **Delete a form** from `<FormsListPane>` through `SkinConfirm` — a danger
    confirmation naming the consequence, because a soft-delete also CLOSES an
    open form and its public link stops resolving immediately.
  - **`src/nav/manifest.ts` + `nav-manifest.json`** — `forms.list`,
    `forms.builder`, `forms.responses` under the container-owned `account.root`.
    The anonymous `<StapelForm>` deliberately has none.
  - **Workspace scope on the runtime**: `createFormsRuntime({ workspaceId })` +
    `useFormsWorkspaceId()`. `workspaceId` is now OPTIONAL on the three admin
    panes — a routed screen has only the address. With neither declared, the
    screen says so instead of rendering an empty list.

  **BREAKING (pre-1.0 = minor).** `FormsSkinTheme` and this pair's local
  `ErrorAlert` are removed from `@stapel/forms-react/default`. Both were per-pair
  copies of a fleet rule and now live once in `@stapel/tokens-antd/skin` as
  `SkinTheme` (plus a `surface` prop) and `ErrorAlert`. Every surface migrated to
  the substrate: `SkinTheme`, `LoadBoundary`/`LoadList`, `EmptyState`,
  `ErrorAlert`, `SkinConfirm` (the last `Popconfirm` is gone) and `GatedButton`
  (reasons beside controls, wired with `aria-describedby`). Peer floors move to
  `@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`.

  **Freshness is now declared, not implied.** stapel-forms ships no realtime
  consumer — MODULE.md §11 reserves `forms:ws:<workspace_id>` for one that does
  not exist — so `<ResponsesPane>` is refetch-only and says so on screen, with a
  visible control. No background timer: a table that reorders under a reviewer
  mid-read is worse than a stale one.

  Also: six default-skin demos (previously 0 — every story was a harness dump),
  each seeded so its variants photograph distinct states; all raw dimensions on
  `@stapel/tokens` or a named geometry constant; `es`/`ru` complete for every new
  key.

- 95e8eec: The response detail is a bottom sheet on a phone, and an erased submission
  stops offering writes against itself.

  `ResponsesPane`'s side `Drawer` — fixed at 480px on every viewport — renders
  through `@stapel/tokens-antd/skin`'s `SkinDialog`: a bottom sheet on a phone, a
  centred modal above the tablet breakpoint. Its content is a vertical
  read-and-act detail surface, which is a dialog, not navigation.

  A submission with `erased_at` set showed an "erased" tag and then offered
  Resend and Delete anyway. Both are blocked now, with the reason as visible text
  beside the controls, and Delete drops its confirmation popover rather than
  wrapping a dead button in one.

  The submissions `Table` gained `scroll={{ x: true }}`: it carries two fixed
  columns plus one per form field, so a ten-question form produced twelve columns
  that could not be read or scrolled on a phone.

  The module doc claimed Delete was gated on `forms.responses.manage`. It was
  not, and it cannot be from this side: every admin route documents its
  permission as `IsNotAnonymousUser`, neither `SubmissionPresenterDTO` nor
  `FormPresenterDTO` carries a capability field, and the module exposes no
  capabilities read. The doc says that now instead of implying a gate that does
  not exist; a refusal arrives as the mutation error. The backend would need to
  project that capability — cheapest as a small capabilities read beside the
  submissions list — and it must reach this pair through the committed schema,
  not by hand.

## 0.1.0

### Minor Changes

- b1f9a4e: `@stapel/forms-react` — the frontend pair for stapel-forms.

  A host page says "put form `<id>` here" and gets a rendered form:

  ```tsx
  const runtime = createFormsRuntime({ baseUrl: "/forms/api/v1/" });
  <FormsProvider runtime={runtime}>
    <StapelForm publicId="k3J…x9" />
  </FormsProvider>;
  ```

  No session, no workspace id, no auth client — the two public endpoints are
  anonymous, so a marketing page can embed a form and nothing else.

  **A failed schema fetch is never "no form here."** The skin distinguishes "this
  link is not valid" (404), "this form is closed" (410) and "we could not load it,
  our problem, not your link" (network/5xx, with a retry). The data sits behind
  `LoadState`'s discriminant, so the empty-state lie is a compile error rather
  than a code-review note.

  **Three override levers, none of them a fork.** `registerFormFieldWidget(kind, C)`
  replaces how one field kind draws and outranks the skin's builtin;
  `registerFormsSkinComponent(slot, C)` replaces a piece of the skin across eight
  typed slots; and retheming through the token JSON reaches every surface with
  zero code. A field kind nothing can draw renders a loud notice _and_ blocks the
  submit — quietly skipping a possibly-required field would fabricate an invalid
  submission and get the person refused for a question they never saw.

  Ten builtin antd widgets, one per kind stapel-forms allows. Headless
  `FormFill` / `FormBuilder` / `ResponsesTable` / `FormList` under the main entry;
  `StapelForm` / `FormBuilderPane` / `ResponsesPane` / `FormsListPane` under
  `./default`; `ru` and `es` as opt-in `./i18n/*` subpaths.

  The submit path echoes `version_id` (a racing publish becomes a clean 409),
  routes per-field `error.400.feature_*` onto controls by `params.field`, folds a
  409 supersede into a refetch that preserves compatible answers and _says so_,
  and threads `captcha_token` through. CSV export follows the
  `X-Forms-Next-Before` header cursor verbatim.

  Built against stapel-forms 0.2.0: the builder reads its field-kind catalogue
  from `GET /forms/api/v1/field-kinds` (no mirrored table in the client), and
  the `error.400.feature_*` family comes from the backend's own error contract.
  `stapel_attributes` ships English only, so the generated ru/es bundles are
  `Partial` and the pair layers authored strings for those 12 keys over them.

  Enrollment note for consumers of other pairs: the `stapel-core` contract pin
  moves v0.23.1 → v0.32.0 to pick up `error.503.mandate_unavailable`. Verified a
  one-key delta — no already-enrolled pair's locale bundle changes.

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
