/**
 * `<StapelForm>` — the whole answer to the owner's ask: *"the host page says
 * 'put form &lt;id&gt; here', the library fetches the schema and renders it,
 * default skin or override styles."*
 *
 * ```tsx
 * const runtime = createFormsRuntime({ baseUrl: "/forms/api/v1/" });
 * <FormsProvider runtime={runtime}>
 *   <StapelForm publicId="k3J…x9" />
 * </FormsProvider>
 * ```
 *
 * Nothing else is required — no session, no workspace id, no auth client. The
 * component is a renderer over `<FormFill>`'s bag and holds no state of its
 * own, so everything it does is reachable headlessly too.
 *
 * ── LoadState is the law here, visibly ─────────────────────────────────────
 *
 * The failed arm distinguishes THREE things a lesser form collapses into one
 * blank page: "this link is not valid" (404), "this form is closed" (410),
 * and "we could not ask" (network / 5xx). Only the first two are statements
 * about the form; the third is a statement about us, and it offers a retry
 * instead of blaming the person's link. There is no code path in this file
 * that renders an empty form because a fetch failed — `matchLoad`'s three
 * required arms make writing one a compile error.
 */
import type { ReactElement, ReactNode } from "react";
import { Alert, Form, Typography } from "antd";
import {
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  hasErrorCode,
  useActionGate,
  useFormatFlowError,
  useT,
} from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { FlowError, ThemeModeProp } from "./types.js";
import { skinThemeProps } from "./types.js";
import { FormFill } from "../headless/FormFill.js";
import type { FormFillBag } from "../headless/FormFill.js";
import type { FormFieldDef } from "../api/types.js";
import { resolveFormFieldWidget } from "../widgets/registry.js";
import { BUILTIN_FIELD_KINDS, BUILTIN_FIELD_WIDGETS } from "./fields.js";
import { resolveFormsSkinComponent } from "./slots.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/** Stable per-field DOM id, so `<label for>` reaches the control. Slugs are
 * `[a-z0-9_]`-shaped by the engine, so this needs no further escaping. */
function fieldControlId(slug: string): string {
  return `forms-field-${slug}`;
}

const CODE_NOT_FOUND = "error.404.forms_not_found";
const CODE_CLOSED = "error.410.forms_closed";

/** Props of the `"fill.fieldRow"` slot. */
export interface FieldRowSlotProps {
  readonly field: FormFieldDef;
  /** DOM id of the control this row labels. */
  readonly controlId: string;
  readonly control: ReactNode;
  readonly error: FlowError | undefined;
  readonly required: boolean;
}

/** Props of the `"fill.submitBar"` slot. */
export interface SubmitBarSlotProps {
  readonly bag: FormFillBag;
  readonly label: string;
  readonly disabled: boolean;
  readonly reason: string | undefined;
  readonly detail: string | undefined;
  onSubmit(): void;
}

/** Props of the `"fill.confirmation"` slot. */
export interface ConfirmationSlotProps {
  readonly confirmation: string;
}

/** Props of the `"fill.unsupportedField"` slot. */
export interface UnsupportedFieldSlotProps {
  readonly field: FormFieldDef;
}

function UnsupportedField(props: UnsupportedFieldSlotProps): ReactElement {
  const t = useT();
  const Slot = resolveFormsSkinComponent<UnsupportedFieldSlotProps>(
    "fill.unsupportedField"
  );
  if (Slot) return <Slot {...props} />;
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="forms-unsupported-field"
      title={props.field.name ?? props.field.slug}
      description={t(FORMS_I18N_KEYS.fillUnsupportedField, {
        kind: props.field.kind,
      })}
    />
  );
}

/**
 * `Form.Item` error props for a flow error, spread so no `undefined` is
 * passed under `exactOptionalPropertyTypes` — the fleet's `useFieldError`
 * convention (auth-react `default/panels.tsx`), and the reason a server
 * `error.400.feature_*` lands ON the control that caused it: `<FormFill>`
 * keys `fieldErrors` by the refusal's own `params.field`.
 */
function useFieldError(): (
  e: FlowError | undefined
) => { validateStatus: "error"; help: string } | Record<string, never> {
  const format = useFormatFlowError();
  return (e) => (e ? { validateStatus: "error", help: format(e) } : {});
}

function FieldRow(props: FieldRowSlotProps): ReactElement {
  const fieldError = useFieldError();
  const Slot = resolveFormsSkinComponent<FieldRowSlotProps>("fill.fieldRow");
  if (Slot) return <Slot {...props} />;
  // A header is a caption: it gets no label, no colon, no required marker —
  // rendering one inside a labelled Form.Item would make a section heading
  // look like a question.
  if (props.field.kind === "header") {
    return (
      <Form.Item style={{ marginBottom: spacing[2] }}>{props.control}</Form.Item>
    );
  }
  return (
    <Form.Item
      label={props.field.name ?? props.field.slug}
      htmlFor={props.controlId}
      required={props.required}
      {...fieldError(props.error)}
    >
      {props.control}
    </Form.Item>
  );
}

function FieldControl(props: {
  field: FormFieldDef;
  bag: FormFillBag;
  controlId: string;
}): ReactElement {
  const { field, bag } = props;
  // The ladder: a host's explicit registration outranks the skin's builtin.
  const Widget =
    resolveFormFieldWidget(field.kind) ?? BUILTIN_FIELD_WIDGETS[field.kind];
  if (Widget === undefined) return <UnsupportedField field={field} />;
  return (
    <Widget
      id={props.controlId}
      field={field}
      value={bag.values[field.slug]}
      onChange={(value) => bag.setValue(field.slug, value)}
      error={bag.fieldErrors[field.slug]}
      disabled={bag.isSubmitting}
    />
  );
}

function Confirmation(props: ConfirmationSlotProps): ReactElement {
  const t = useT();
  const Slot = resolveFormsSkinComponent<ConfirmationSlotProps>(
    "fill.confirmation"
  );
  if (Slot) return <Slot {...props} />;
  return (
    <Alert
      type="success"
      showIcon
      data-testid="forms-confirmation"
      title={
        props.confirmation.length > 0
          ? props.confirmation
          : t(FORMS_I18N_KEYS.fillThanks)
      }
    />
  );
}

function SubmitBar(props: { bag: FormFillBag; label: string }): ReactElement {
  // Only the SLOT contract needs the flattened view; the default rendering
  // hands the gate itself to <GatedButton>.
  const gate = useActionGate(props.bag.submit);
  const Slot = resolveFormsSkinComponent<SubmitBarSlotProps>("fill.submitBar");
  const slotProps: SubmitBarSlotProps = {
    bag: props.bag,
    label: props.label,
    disabled: gate.disabled,
    reason: gate.reason,
    detail: gate.detail,
    onSubmit: props.bag.doSubmit,
  };
  if (Slot) return <Slot {...slotProps} />;
  // The reason is TEXT beside the button, never a tooltip: a disabled button
  // receives no pointer events in any browser, so a tooltip on it is a reason
  // nobody can read. `GatedButton` owns that rule (and the `aria-describedby`
  // wiring) once for the fleet.
  return (
    <GatedButton
      gate={props.bag.submit}
      type="primary"
      htmlType="submit"
      loading={props.bag.isSubmitting}
      data-analytics="flow"
      testId="forms-submit"
      onClick={props.bag.doSubmit}
    >
      {props.label}
    </GatedButton>
  );
}

export interface StapelFormProps extends ThemeModeProp {
  /** The non-enumerable public token the host embeds. */
  readonly publicId: string;
  /** Show the schema's `meta.title` above the fields. Default true. */
  readonly showTitle?: boolean;
  /** Override the submit button's text (otherwise `meta.submit_label`, then
   * the pair's own copy). */
  readonly submitLabel?: string;
  /**
   * Rendered above the submit bar — the interactive-captcha seam. The netintel
   * tier decides whether a token is needed at all, so this stays optional and
   * the widget calls `setCaptchaToken` when it has one.
   */
  readonly captcha?: (bag: FormFillBag) => ReactNode;
  readonly onSubmitted?: (result: { readonly confirmation: string }) => void;
}

export function StapelForm(props: StapelFormProps): ReactElement {
  const t = useT();

  return (
    <SkinTheme {...skinThemeProps(props)}>
      <FormFill
        publicId={props.publicId}
        builtinKinds={BUILTIN_FIELD_KINDS}
        {...(props.onSubmitted ? { onSubmitted: props.onSubmitted } : {})}
      >
        {(bag) => {
          if (bag.submitted !== null) {
            return <Confirmation confirmation={bag.submitted.confirmation} />;
          }
          return (
            <LoadBoundary
              state={bag.state}
              onRetry={bag.refetch}
              testId="forms-fill"
              // The three-way split. `hasErrorCode` reads the API dialect, so
              // this works whether the throw was a StapelApiError or a bare
              // envelope — and a network fault, which carries NEITHER code,
              // correctly falls through to "we could not ask".
              failed={(error) => {
                if (hasErrorCode(error, CODE_NOT_FOUND)) {
                  return (
                    <Alert
                      type="error"
                      showIcon
                      data-testid="forms-not-found"
                      title={t(FORMS_I18N_KEYS.fillNotFound)}
                    />
                  );
                }
                if (hasErrorCode(error, CODE_CLOSED)) {
                  return (
                    <Alert
                      type="info"
                      showIcon
                      data-testid="forms-closed"
                      title={t(FORMS_I18N_KEYS.fillClosed)}
                    />
                  );
                }
                return (
                  <ErrorAlert
                    testId="forms-load-failed"
                    message={t(FORMS_I18N_KEYS.fillLoadFailed)}
                    thrown={error}
                    onRetry={bag.refetch}
                  />
                );
              }}
            >
              {(form) => {
                const label =
                  props.submitLabel ??
                  form.meta.submit_label ??
                  t(FORMS_I18N_KEYS.fillSubmit);
                return (
                  <Form
                    layout="vertical"
                    data-testid="forms-form"
                    onFinish={bag.doSubmit}
                  >
                    {props.showTitle !== false &&
                      form.meta.title !== undefined && (
                        <Typography.Title level={3}>
                          {form.meta.title}
                        </Typography.Title>
                      )}
                    {form.meta.description !== undefined && (
                      <Typography.Paragraph type="secondary">
                        {form.meta.description}
                      </Typography.Paragraph>
                    )}

                    {/* A schema that changed under the person is announced, not
                        swapped in silently — they must re-read before resubmitting. */}
                    {bag.superseded && (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: spacing[4] }}
                        data-testid="forms-superseded"
                        title={t(FORMS_I18N_KEYS.fillSuperseded)}
                      />
                    )}

                    {form.fields.map((field) => (
                      <FieldRow
                        key={field.slug}
                        field={field}
                        controlId={fieldControlId(field.slug)}
                        required={field.mandatory === true}
                        error={bag.fieldErrors[field.slug]}
                        control={
                          <FieldControl
                            field={field}
                            bag={bag}
                            controlId={fieldControlId(field.slug)}
                          />
                        }
                      />
                    ))}

                    <ErrorAlert
                      testId="forms-form-error"
                      style={{ marginBottom: spacing[4] }}
                      {...(bag.formError !== null ? { thrown: bag.formError } : {})}
                    />

                    {props.captcha?.(bag)}

                    <SubmitBar bag={bag} label={label} />
                  </Form>
                );
                }}
            </LoadBoundary>
          );
        }}
      </FormFill>
    </SkinTheme>
  );
}
