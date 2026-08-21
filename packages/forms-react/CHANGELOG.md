# @stapel/forms-react

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
