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
- **headless/** — `FormFill`, `FormBuilder`, `ResponsesTable`, `FormList`,
  `FormSettingsEditor`.
- **nav/** — `navEntries`, this pair's slice of the scripted-fullstack nav
  contract (`gen:nav` → `nav-manifest.json`).
- **i18n/** — the en floor + generated backend error bundles; `ru`/`es` as
  their own subpaths so a host that does not need them carries nothing.
- **default/** — the antd skin, a separate entry point, built on the SHARED
  substrate (`@stapel/tokens-antd/skin`): `SkinTheme`, `LoadBoundary`/`LoadList`,
  `EmptyState`, `ErrorAlert`, `SkinDialog`, `SkinConfirm`, `GatedButton`. This
  pair owns no theme provider and no error alert of its own — see
  "What 0.2.0 deleted".

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

## What this pair's 0.2.0 deleted

**`default/theme.tsx` and `default/ErrorAlert.tsx` are gone**, and so are the
`FormsSkinTheme` / `ErrorAlert` exports of `@stapel/forms-react/default`
(pre-1.0 breaking = minor). Nine pairs shipped a byte-identical copy of each,
which meant every fleet-wide fix to them had to land nine times and landed in
eight — the reactive-theme bug (a runtime `data-theme` flip left mounted skins
on the old side, because `resolveThemeMode()` SAMPLES the document once per
render) is the one that made the cost obvious. Both now live once, in
`@stapel/tokens-antd/skin`, as `SkinTheme` (same `mode`/`style`/`children`,
plus a `surface` prop) and `ErrorAlert` (same call shape, plus `thrown` and
`onRetry`). Re-exporting them under the old names would have kept nine copies
of a decision alive behind an alias, so the export is dropped rather than
forwarded — a host that wrapped a composition in `<FormsSkinTheme>` imports
`<SkinTheme>` instead.

The same migration took the pair's last `Popconfirm` (→ `SkinConfirm`, so a
confirmation is a bottom sheet on a phone rather than an anchored popover) and
every bare `disabled={…}` on a reason-bearing control (→ `GatedButton`, which
renders the reason as text beside the control and wires `aria-describedby` to
it — a disabled antd button receives no pointer events, so a tooltip on one is
a reason nobody can read).

### What stapel-forms 0.2.0 deleted from this pair

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

## The workspace an admin screen acts in

Every admin route is workspace-scoped, and a ROUTE carries no workspace: a
container mounts `<FormsListPane/>` from the nav manifest with nothing but the
address, and the workspace a person is acting in is a property of the session,
not of the URL. So the scope is declared once on the runtime:

```tsx
const runtime = createFormsRuntime({ baseUrl: "/forms/api/v1/", workspaceId });
```

`useFormsWorkspaceId(explicit?)` resolves the screen's own prop first and the
runtime second, which is why `workspaceId` is OPTIONAL on `FormsListPane`,
`FormBuilderPane`, `ResponsesPane` and `FormSettingsPane` — a host driving two
workspaces on one page still passes it and still wins. With neither declared,
the screen renders a named notice and issues no request: rendering an empty
list would blame the workspace for a wiring mistake, and throwing would render
a blank route explaining nothing.

## Where a form's notifications are configured

`PATCH /forms/<id>` is the ONLY writer of `Form.settings`, and `Form.settings`
is where the destinations live (`notify_emails`, `notify_telegram_chat_ids`)
next to `retention_days`. `<FormSettingsEditor>` / `<FormSettingsPane>` is that
writer, reached from the builder's toolbar and from each list row.

Three rules it follows:

1. **The bag is patched whole.** `services.update_form` REPLACES `settings`, so
   a patch carrying only the three keys this pair drives would silently delete
   every key a host put there. The editor spreads the stored bag first.
2. **Destinations are not validated here.** The backend validates retention and
   passes the lists through; a client-side refusal of an address the server
   accepts would be a verdict this pair has no standing to give. An address
   that does not look like one is a NOTICE beside the field.
3. **The retention ceiling is not guessed.** `>= 1` is knowable here and is
   blocked here; `STAPEL_FORMS["RETENTION_DAYS"]` is a deployment setting no
   client can read, so a too-long override comes back as the server's own
   `error.400.forms_invalid_retention` with its `params.limit`.

## Live counts — polling, declared

Refetch only, and the surface **says so**. This is a decision with a date on
it, not an unfinished feature: `@stapel/realtime` has shipped, but stapel-forms
exposes no stream to consume — its MODULE.md §11 lists "realtime response feed"
as out of scope and RESERVES the name `forms:ws:<workspace_id>` for a consumer
that does not exist ("modules do not open sockets"). A socket opened here would
be this pair inventing a protocol the backend does not speak, which is exactly
the defect `@stapel/realtime` was extracted to end.

There is no `refetchInterval` either: a reviewer reads one response at a time,
and a table that silently reorders under the cursor mid-read loses their place
and can move the row they were about to delete. So freshness is an ACT —
`bag.refetch()`, surfaced by `<ResponsesPane>` as a visible control with one
sentence saying the list does not update on its own. When stapel-forms grows
the consumer, that sentence is what gets deleted.

## Nav

Three routable admin surfaces — `forms.list`, `forms.builder` (`:formId`),
`forms.responses` (`:formId`) — all `submenu` under the container-owned
`account.root`, with RELATIVE paths: an absolute `/forms` is byte-for-byte the
catalogued `forms_api_v1_forms_create` operation path, and
`stapel/no-string-paths` is right to refuse a literal a reader cannot tell
apart from an API call.

The anonymous `<StapelForm>` deliberately has **no** entry. It is embedded by a
host wherever the form belongs, addressed by a non-enumerable `public_id`, and
reachable with no session — a route for it would claim an address the shell
does not know and cannot enumerate.
