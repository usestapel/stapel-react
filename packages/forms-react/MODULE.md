# @stapel/forms-react — module guide

The human companion to the generated `llms.txt` (agent context) and
`manifest.json` (machine catalog). `README.md` is the how-to; this is the
why-it-is-shaped-this-way.

Built against **stapel-forms 0.1.0** (contract pin
`3829576ca606a0fca6b8b1ad3a3685405c8927a1`).

## Layers

- **api/** — `createFormsApi(client)`, one method per endpoint a JS client may
  call, over the generated `components["schemas"]` from this pair's own
  package-local `api/generated/schema.ts` (`pnpm gen:api` ← stapel-forms
  `docs/schema.json`). Two families, and the split is load-bearing:
  `getPublicForm`/`submit` are **anonymous**; everything else is
  `IsNotAnonymousUser` + `authorize()` + an explicit `workspace_id`.
  `api/export.ts` is the raw-`fetch` carve-out (see below).
- **model/** — `formsQueryKeys` (one key factory, `["forms"]` namespace),
  `createFormsRuntime`, context/hooks, and the read/write hooks.
- **flows/** — `toFlowError` + the zero-flow `FORMS_FLOWS` registry shim.
  stapel-forms annotates no `@flow_step`, so `docs/flows.json` carries no
  `forms.*` flow and `gen:flows` emits nothing. When the backend annotates
  flows, swap the shim for re-exports of `generated/flows.gen.ts`.
- **widgets/** — the field-widget registry, the config-form declarations the
  builder is driven by, and the client-side validation mirror. Main entry, not
  `/default`: a host building its own renderer uses the same seam the skin does.
- **headless/** — `FormFill`, `FormBuilder`, `ResponsesTable`, `FormList`.
- **i18n/** — the en floor + generated backend error bundles; `ru`/`es` as
  their own subpaths so a host that does not need them carries nothing.
- **default/** — the antd skin, a separate entry point.

## Why the CSV export does not use core's client

`GET /forms/<id>/submissions/export` cannot ride `StapelClient` for two
independent reasons: the body is a CSV **file**, and the continuation cursor
rides the **`X-Forms-Next-Before` response header**, which `StapelClient.request`
does not surface at all. So `api/export.ts` speaks `fetch` directly — the same
hand-authored carve-out docs-react's `api/content.ts` and recordings-react's
`uploadRecordingBlob` use, and the one legal home of `fetch` under
`stapel/no-raw-fetch`.

The cursor is passed back **verbatim**. It is Z-suffixed rather than isoformat
because a bare `+00:00` in a query string decodes to a space, which made the
second page a silent 400 during the backend build; re-formatting it here would
reintroduce exactly that.

**v1 limitation, stated:** the bearer-refresh and verification-403 seams of
`createStapelClient` do NOT run on this raw surface. A 401 here throws like any
other error status instead of triggering a refresh-and-retry. `credentials` and
`defaultHeaders` from the runtime ARE forwarded, so cookie-mode hosts work
unchanged. Closing this properly is a core change (a response-returning
primitive on `StapelClient`), not a per-module workaround.

## Why the builder's config declarations are a mirror, not a fetch

`stapel_attributes.config_form` declares every feature type's admin config form
as data — `FormField(name, kind, label_key, required, default, params)` — so a
builder needs no per-type UI. But its own docstring records how that data
reaches a client: *"Emitted server-side onto the admin page via the widget (**no
endpoint**)."* There is no REST surface for `form_declarations()`, in
stapel-attributes or among stapel-forms' 13 paths.

So `widgets/configForms.ts` mirrors the upstream declarations in TypeScript.
The property §8 asked for is preserved — the builder iterates a table, and no
kind gets a bespoke hand-written form — but the table can drift from upstream
until an endpoint exists. The drift is bounded by `test/builder.test.tsx`, which
pins every quirk that would otherwise rot silently: `hex_color.allowCustom`
defaulting FALSE where int/float/string default TRUE (LN-B15), `header.style`
defaulting to `"h2"` which matches neither option (LN-B01), `select.uiStyle` at
the engine's `"dropdown"`, `select.maxSelected` with NO default because absent
means unlimited, and the camelCase-only key rule.

Filed as a spec delta.

## Deviations from the spec's sketch, with reasons

1. **`date` renders a native input, not antd's `DatePicker`.** `DatePicker`
   speaks Dayjs; adopting it would add a runtime dependency for one widget and
   insert a format-guessing step where the native control already yields the ISO
   string the attributes date type parses. `precision` picks the input type.
2. **Two kinds ship builder-less** (§12 risk 5, applied): `convertible_unit`
   declares no upstream config form at all, and `hierarchical_select`'s only
   field is an unrepresentable tree editor. Both render and submit normally.
   Two individual config FIELDS are also v1-unrepresentable (`date.options`,
   anything `hierarchical_options`) and are marked `unsupported` so the builder
   states what it is not showing rather than presenting a partial form as
   complete.
3. **The submit-blocked key is `forms.submit.blocked.unsupported_kind`**, not
   the spec's illustrative `forms.unsupported_kind` — every other blocked reason
   in this pair is `forms.<surface>.blocked.<why>`, and one key in a different
   shape is a key somebody will mistype.
4. **`error.400.feature_*` copy is hand-carried in `i18n/keys.ts`.**
   `stapel_attributes.errors` registers that catalogue with core, but
   stapel-forms' published `docs/errors.json` does not contain it — 63 keys, 42
   core-owned and 21 forms-owned, not one `feature_*` among them — while
   `services.py:278` puts exactly one of those codes at the top level of a
   per-field submit refusal. Without the hand-carried copy the errors a
   respondent is most likely to see would render as raw keys. Deleted the moment
   the backend snapshot includes them. Filed as a spec delta.
5. **The client-side mirror emits the SERVER's error keys.** A "too long" caught
   locally and one caught by the server render the same sentence in the same
   language. Pair-invented copy for the local half would give one problem two
   wordings and become a lie the moment the backend's rule moved.

## Seams

| Seam | Call | Beats |
|---|---|---|
| Field widget | `registerFormFieldWidget(kind, C)` | the skin's builtin |
| Skin slot | `registerFormsSkinComponent(slot, C)` | the skin's own part |
| Theme | regenerate the token JSON | everything, with zero code |
| Client | `clients={{ forms: runtime.client }}` | the default client |
| i18n | register a bundle last | any pair copy |

## Query keys and invalidation

Everything under `["forms"]`. Admin mutations invalidate the module ROOT rather
than guessing which entries moved — `rotateLink` changes the very `public_id`
the anonymous read is cached under, so a targeted invalidation would leave a
stale schema under a token that no longer resolves.

`useSubmitForm` invalidates nothing (an anonymous respondent holds no admin
cache) and does not retry (a resubmit is not idempotent — a retried POST the
server actually received is a duplicate row in somebody's spreadsheet).

## Session gating

Every admin read is gated on `useActiveSessionReady`. `usePublicForm` is
deliberately NOT — core's own doc comment carves out "a public GET", and gating
it would make an embedded form on a marketing page wait for a login bootstrap it
has no stake in.

## Live counts

Refetch only. A `forms:ws:<workspace_id>` Signal stream is reserved naming for
when the stapel-realtime substrate lands; forms does not build a socket, and
that is a lint boundary rather than an unfinished feature.
