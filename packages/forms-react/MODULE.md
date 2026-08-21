# @stapel/forms-react — module guide

The human companion to the generated `llms.txt` (agent context) and
`manifest.json` (machine catalog). `README.md` is the how-to; this is the
why-it-is-shaped-this-way.

Built against **stapel-forms 0.2.0** (contract pin
`d66a1fb048feebebebaf98ec971fb41ab60f820b`), which closed both upstream asks
this pair filed against 0.1.0 — so two workarounds were deleted rather than
carried. See "What 0.2.0 deleted" below.

## Layers

- **api/** — `createFormsApi(client)`, one method per endpoint a JS client may
  call (18 operations over 14 paths), over the generated `components["schemas"]` from this pair's own
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
- **widgets/** — the field-widget registry and the client-side validation
  mirror. Main entry, not `/default`: a host building its own renderer uses the
  same seam the skin does. (The config-form declarations used to live here too,
  as `configForms.ts`; they come off the wire now.)
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

## What 0.2.0 deleted

**`widgets/configForms.ts` — the pinned TypeScript mirror — is gone.**
stapel-forms 0.2.0 serves `stapel_attributes.config_form()` at
`GET /forms/api/v1/field-kinds`, so the declaration is the single source of
truth again: a type registered through `EXTRA_TYPES` shows up in the builder
with no client release, and there is no table left to drift. The builder reads
it through `useFieldKinds`.

Three things about that route are easy to get wrong and are pinned by
`test/contract.test.ts`: **no `admin/` prefix**, **no trailing slash** (unlike
the two anonymous routes, which require one), and `?workspace_id=` is
**required**. It carries `forms.manage`, not `forms.view` — the catalogue names
host types whose slugs are internal vocabulary, and a principal who cannot build
a form has no use for the builder's dictionary.

Reading the real declarations also corrected a detail the mirror had wrong:
widget params (`step`, `placeholder`, inline `options`) live **under
`spec.params`**, not flattened onto the spec. `ConfigField` reads them from
there now.

**The hand-carried `error.400.feature_*` English is gone.** 0.2.0's
`docs/errors.json` grew 63 → 75 keys, the 12 new ones owned by
`stapel_attributes`, so the family arrives through `gen:errors` like every other
backend code. The self-deleting test that asserted the registry omitted them is
deleted with it; its inverse now asserts the family IS generated, so nobody
re-adds a hand copy.

## Why the ru/es bundles are `Partial`

`stapel_attributes` ships English only — it has no `translations/` directory at
all — so its 12 keys can appear in NO locale catalog, and demanding them made
the ru/es bundles unbuildable while stapel-forms' own catalog was perfectly
correct. `scripts/gen-errors.mjs` gained a general knob for exactly this shape
(a module inheriting an L1 library's keys):
`ERRORS_LOCALE_EXEMPT_OWNERS=stapel_attributes` for this pair.

Exempted keys are not required in a locale catalog and are left OUT of that
locale's generated bundle, which widens its type to
`Partial<Record<FormsErrorCode, string>>` — so the gap is visible to TypeScript
instead of silently falling back to English. The pair's own `i18n/ru.ts` /
`i18n/es.ts` layer authored strings for all 12 over the generated bundle.
English is unaffected: it comes from the registry artifact, which is
authoritative for every owner.

This is opt-in per pair, so a module that DOES own a key and dropped it from its
catalog still goes red. Upstream localization is logged as stapel-forms
MODULE.md §12.6; when it lands, drop the env knob and the authored strings.

## Deviations from the spec's sketch, with reasons

1. **`date` renders a native input, not antd's `DatePicker`.** `DatePicker`
   speaks Dayjs; adopting it would add a runtime dependency for one widget and
   insert a format-guessing step where the native control already yields the ISO
   string the attributes date type parses. `precision` picks the input type.
2. **Builder-less is now a SERVER signal, not a pair opinion** (§12 risk 5,
   applied). Two distinct facts arrive from `/field-kinds` and the bag reports
   them separately so a skin can word them differently:
   `registered: false` (the host allowlisted a kind the attributes registry
   does not carry) and `fields: []` (registered, but declares no config form —
   how `convertible_unit` arrives). Either way the field stays LISTED,
   reorderable and removable, and authorable through the draft PUT: a builder
   that dropped an unknown kind would silently drop the field from a stored
   schema. Separately, two of upstream's 13 config WIDGETS are not implemented
   in this skin (`hierarchical_options`, `timestamp_array`); those individual
   rows say so, and the rest of the kind stays editable.
3. **The submit-blocked key is `forms.submit.blocked.unsupported_kind`**, not
   the spec's illustrative `forms.unsupported_kind` — every other blocked reason
   in this pair is `forms.<surface>.blocked.<why>`, and one key in a different
   shape is a key somebody will mistype.
4. **Error params are NOT narrowed to the artifact's declared list.** The
   registry declares only the slots a message interpolates
   (`feature_mandatory_missing` declares `["feature"]`), but the runtime also
   sets `field`, `slug` and `ref_value` — and `params.field` is precisely what
   routes a refusal onto a control. Typing `params` to the declared list would
   make the pair's own field-error routing a type error against a payload the
   server really sends.
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
