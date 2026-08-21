# @stapel/forms-react

The frontend pair for **stapel-forms**: an admin defines a form's schema, a host
page says *"put form `<id>` here"*, and this library fetches the schema and
renders it — default skin, or your own.

Business + state in the main entry, zero visual opinion; the antd skin lives
behind `./default` so a host that renders its own visuals never carries it.
Built on `@stapel/core` (typed client + `StapelApiError` envelope, token
refresh, verification-403 interception, i18n engine, analytics seam, TanStack
Query).

## Install

```
pnpm add @stapel/forms-react @stapel/core @tanstack/react-query react
# for the default skin:
pnpm add antd @stapel/tokens-antd
```

## Put a form on a page

The whole ask, in five lines. **No session, no workspace id, no auth client** —
the two public endpoints are anonymous, so a marketing page can embed a form and
nothing else:

```tsx
import { createFormsRuntime, FormsProvider } from "@stapel/forms-react";
import { StapelForm } from "@stapel/forms-react/default";

const runtime = createFormsRuntime({ baseUrl: "/forms/api/v1/" });

export function ContactPage() {
  return (
    <FormsProvider runtime={runtime}>
      <StapelForm publicId="k3JhQ2Zt8uY1sVb7cD9xLg" />
    </FormsProvider>
  );
}
```

The handle you embed is the **`public_id`** — the same non-enumerable token the
backend serves anonymously. The pair never needs the row UUID or a workspace id
to render.

In an app that already has a session, put the forms client on core's provider
alongside the others and keep one client per module:

```tsx
<StapelProvider client={authRuntime.client} clients={{ forms: runtime.client }} i18n={i18n}>
  <FormsProvider runtime={runtime}>{app}</FormsProvider>
</StapelProvider>
```

## A failed fetch is never "no form here"

The one rule this pair is built around. A schema read has **three** outcomes and
the skin says a different thing for each:

| What happened | What the person sees |
|---|---|
| `404 error.404.forms_not_found` | "This form link is not valid." |
| `410 error.410.forms_closed` | "This form is closed and is no longer accepting responses." |
| network fault / 5xx | "We could not load this form. This is a problem on our side, not with your link." **+ a retry button** |

The bag exposes `state: LoadState<PublicForm>`, so the data is *behind* the
discriminant — there is no `.data` to read on a failed load, and the
`no-flattened-load-state` lint rule enforces it mechanically. Branch on the
verdicts with core's `hasErrorCode`.

## Headless

`<StapelForm>` is one renderer over `<FormFill>`. Write another and lose nothing:

```tsx
<FormFill publicId="k3J…x9">
  {(bag) => matchLoad(bag.state, {
    loading: () => <Spinner />,
    failed: (e) => <MyError error={e} onRetry={bag.refetch} />,
    ready: (form) => <MyFields form={form} bag={bag} />,
  })}
</FormFill>
```

The bag carries `values` / `setValue`, `fieldErrors` keyed by slug, an
`ActionAvailability` submit gate that always states *why* it is off,
`superseded`, `unsupportedKinds`, and `setCaptchaToken`.

Also headless: `<FormBuilder>`, `<ResponsesTable>`, `<FormList>`.

## Three ways to override, none of them a fork

**1. Props** — `mode`, `showTitle`, `submitLabel`.

**2. The field-widget registry.** The backend's field vocabulary is an open
registry (`stapel_attributes`), so the frontend's is too:

```tsx
registerFormFieldWidget("signature", SignaturePad);
```

Resolution is *your registration → the skin's antd builtin → an
"unsupported field" notice*. A host registration always wins. A kind nothing can
draw renders the notice **and blocks the submit** — silently skipping a
possibly-required field would fabricate an invalid submission and get the person
refused for a field they never saw.

**3. The skin-slot registry** — replace a piece of the skin itself:

```tsx
registerFormsSkinComponent("fill.submitBar", MySubmitBar);
```

Slots: `fill.fieldRow`, `fill.submitBar`, `fill.confirmation`,
`fill.unsupportedField`, `responses.cell`, `responses.toolbar`,
`builder.fieldRow`, `builder.toolbar`.

**And underneath all three: retheming.** Every `/default` surface wraps itself in
`<FormsSkinTheme>`, which reads `@stapel/tokens` through `@stapel/tokens-antd`.
Regenerate your `--stapel-*` custom properties from the token JSON and the form
follows, with zero code.

## Builtin widgets

| Kind | Widget |
|---|---|
| `string` | `Input`, or `Input.TextArea` when `config.multiline` |
| `int` / `float` | `InputNumber` (min/max/precision/prefix/postfix) |
| `bool` | `Switch` with the config's `trueLabel`/`falseLabel` |
| `select` | `Segmented` at ≤4 single choices, else `Select` (multi/tags) |
| `date` | native `<input type=date\|month\|datetime-local>`, or a year `InputNumber` |
| `header` | `Typography.Title` — a caption, never a control |
| `hex_color` | `ColorPicker` |
| `hierarchical_select` | `Cascader` |
| `convertible_unit` | `InputNumber` + a unit `Select` |

`date` deliberately uses a native input rather than antd's `DatePicker`: the
picker speaks Dayjs, which would add a runtime dependency for one widget and put
a format-guessing step between the person and a wire format the backend already
parses. Register the picker yourself if you want it.

## Captcha

The netintel tier decides whether a token is required at all, so the pair only
transports one. Render your challenge through the `captcha` prop and hand the bag
a token:

```tsx
<StapelForm
  publicId="k3J…x9"
  captcha={(bag) => <Turnstile onVerify={(t) => bag.setCaptchaToken(t)} />}
/>
```

## Admin surface

Capability-gated over REST (`forms.view`, `forms.manage`,
`forms.responses.view`, `forms.responses.manage`):

```tsx
<FormsListPane workspaceId={ws} onOpen={(form) => navigate(form.id)} />
<FormBuilderPane workspaceId={ws} formId={id} />
<ResponsesPane workspaceId={ws} formId={id} />
```

`<FormBuilderPane>` is **data-driven**: a field's options come from
`GET /field-kinds`, which serves the config declarations `stapel_attributes`
publishes per type. There is no hand-written form per kind and no mirrored table
— register a feature type upstream and it appears in the builder with no client
release.

A kind arrives *builder-less* for either of two reasons the server distinguishes:
`registered: false` (this deployment allowlisted a type the attributes registry
does not carry) or `fields: []` (registered, but it declares no config form —
`convertible_unit`). Either way the field is still listed, still renders, still
submits, and stays authorable through the draft API — a builder that dropped an
unknown kind would silently drop the field from a stored schema.

`<ResponsesPane>` draws **per-version columns** (a response records which schema
it answered, so an old row shows the questions actually asked), keyset paging,
resend, and CSV export.

### Resend overrides REPLACE

An explicit destination on a resend replaces the form's configured recipients for
that one send — "send this one to legal" must not also re-send it to everybody
who already received it.

## i18n

```tsx
registerFormsI18n(i18n);                    // en floor, always
registerFormsI18nRu(i18n);                  // from @stapel/forms-react/i18n/ru
registerFormsI18nEs(i18n);                  // from @stapel/forms-react/i18n/es
```

Registration order is override priority — a host bundle registered last wins.

**Field labels are not i18n keys.** They are admin-authored content carried in
the schema and render verbatim in whatever language the admin typed. Translating
form *content* is a separate problem from translating the pair's chrome.

## Docs

`MODULE.md` — layer map, seams, and the deliberate deviations, with reasons.
`llms.txt` / `manifest.json` — the generated agent/machine views, drift-gated
against the backend contract.
