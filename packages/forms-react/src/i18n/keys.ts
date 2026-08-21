import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { formsErrorBundleEn } from "./generated/errors.gen.js";

/**
 * forms-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's
 * i18n engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for the backend error codes (generated) and the pair's
 * own UI keys. All UI keys live under the `forms.` namespace.
 *
 * ── What is NOT an i18n key here ───────────────────────────────────────────
 *
 * A form's FIELD LABELS are admin-authored content carried in the schema
 * (`FeatureDef.name`), not keys. They render verbatim in whatever language
 * the admin typed them. Multi-language form CONTENT is a v2 fork (spec §10) —
 * translating a customer's question text is a different problem from
 * translating the pair's chrome, and pretending otherwise would put
 * user-generated strings through a bundle that can never contain them.
 */
export const FORMS_I18N_KEYS = {
  unknownError: "forms.error.unknown",

  // ── fill: load + refusal states ──────────────────────────────────────────
  fillLoading: "forms.fill.loading",
  fillRetry: "forms.fill.retry",
  fillLoadFailed: "forms.fill.load_failed",
  fillNotFound: "forms.fill.not_found",
  fillClosed: "forms.fill.closed",
  fillSuperseded: "forms.fill.superseded",
  fillUnsupportedField: "forms.fill.unsupported_field",
  fillRequired: "forms.fill.required",
  fillSubmit: "forms.fill.submit",
  fillSubmitting: "forms.fill.submitting",
  fillThanks: "forms.fill.thanks",
  fillOptionalHint: "forms.fill.optional_hint",
  fillBoolYes: "forms.fill.bool_yes",
  fillBoolNo: "forms.fill.bool_no",
  fillSelectPlaceholder: "forms.fill.select_placeholder",
  fillUnlimited: "forms.fill.unlimited",

  // ── fill: why the submit button is off ───────────────────────────────────
  submitBlockedDone: "forms.submit.blocked.done",
  submitBlockedInFlight: "forms.submit.blocked.in_flight",
  submitBlockedUnsupported: "forms.submit.blocked.unsupported_kind",

  // ── builder ──────────────────────────────────────────────────────────────
  builderTitle: "forms.builder.title",
  builderAddField: "forms.builder.add_field",
  builderRemoveField: "forms.builder.remove_field",
  builderMoveUp: "forms.builder.move_up",
  builderMoveDown: "forms.builder.move_down",
  builderFieldSlug: "forms.builder.field_slug",
  builderFieldLabel: "forms.builder.field_label",
  builderFieldRequired: "forms.builder.field_required",
  builderFieldKind: "forms.builder.field_kind",
  builderSave: "forms.builder.save",
  builderPublish: "forms.builder.publish",
  builderSaving: "forms.builder.blocked.saving",
  builderPublishing: "forms.builder.blocked.publishing",
  builderNoChanges: "forms.builder.blocked.no_changes",
  builderEmptySchema: "forms.builder.blocked.empty_schema",
  builderUnsavedDraft: "forms.builder.blocked.unsaved_draft",
  builderBuilderLess: "forms.builder.builder_less",
  builderUnsupportedConfig: "forms.builder.unsupported_config",
  builderEmpty: "forms.builder.empty",
  builderMetaTitle: "forms.builder.meta_title",
  builderMetaDescription: "forms.builder.meta_description",
  builderMetaSubmitLabel: "forms.builder.meta_submit_label",
  builderMetaConfirmation: "forms.builder.meta_confirmation",
  builderStateOpen: "forms.builder.state_open",
  builderStateClosed: "forms.builder.state_closed",
  builderStateDraft: "forms.builder.state_draft",
  builderRotateLink: "forms.builder.rotate_link",
  builderPublicLink: "forms.builder.public_link",

  // ── responses ────────────────────────────────────────────────────────────
  responsesTitle: "forms.responses.title",
  responsesEmpty: "forms.responses.empty",
  responsesLoadFailed: "forms.responses.load_failed",
  responsesSubmittedAt: "forms.responses.submitted_at",
  responsesRespondent: "forms.responses.respondent",
  responsesAnonymous: "forms.responses.anonymous",
  responsesVersion: "forms.responses.version",
  responsesAllVersions: "forms.responses.all_versions",
  responsesNext: "forms.responses.next",
  responsesPrev: "forms.responses.prev",
  responsesAtEnd: "forms.responses.blocked.at_end",
  responsesAtStart: "forms.responses.blocked.at_start",
  responsesDelete: "forms.responses.delete",
  responsesDeleteConfirm: "forms.responses.delete_confirm",
  responsesResend: "forms.responses.resend",
  responsesResendSent: "forms.responses.resend_sent",
  responsesResendOverride: "forms.responses.resend_override",
  responsesResendOverrideHint: "forms.responses.resend_override_hint",
  responsesExport: "forms.responses.export",
  responsesExporting: "forms.responses.exporting",
  responsesErased: "forms.responses.erased",
  responsesDetail: "forms.responses.detail",
  responsesClose: "forms.responses.close",

  // ── form list ────────────────────────────────────────────────────────────
  listTitle: "forms.list.title",
  listEmpty: "forms.list.empty",
  listLoadFailed: "forms.list.load_failed",
  listCreate: "forms.list.create",
  listNewTitle: "forms.list.new_title",
  listSubmissionCount: "forms.list.submission_count",
} as const;

export type FormsI18nKey =
  (typeof FORMS_I18N_KEYS)[keyof typeof FORMS_I18N_KEYS];

/**
 * English copy for the `error.400.feature_*` family — the per-field refusals
 * `stapel_attributes` raises and stapel-forms forwards.
 *
 * WHY THESE ARE HAND-CARRIED AND NOT GENERATED. `stapel_attributes.errors`
 * registers this catalogue with core (`register_service_errors`), but
 * stapel-forms' published `docs/errors.json` does not contain it: the
 * codegen snapshot holds 63 keys, 42 core-owned and 21 forms-owned, and not
 * one `feature_*` among them — while `services.py:278` puts exactly one of
 * these codes at the top level of a per-field submit refusal. So the
 * generated bundle cannot cover the very errors a respondent is most likely
 * to see. Rather than let them render as raw keys, the pair ships the
 * upstream's own en strings verbatim (source:
 * `stapel_attributes/errors.py::ATTRIBUTES_ERRORS`) and the ru/es mirrors
 * beside them.
 *
 * This is a stopgap with a stated end: once stapel-forms' error registry
 * snapshot includes the attributes catalogue, these keys arrive through
 * `gen:errors` like every other backend code and this block is deleted. A
 * spec delta is filed. The mirrored client-side validation in
 * `widgets/validate.ts` deliberately raises the SAME codes, so both halves
 * render one sentence.
 */
const FEATURE_ERRORS_EN: Readonly<Record<string, string>> = {
  "error.400.feature_below_minimum": "Value is below minimum for {feature}",
  "error.400.feature_above_maximum": "Value is above maximum for {feature}",
  "error.400.feature_not_in_options":
    "Value is not in allowed options for {feature}",
  "error.400.feature_invalid_type": "Invalid type for {feature}",
  "error.400.feature_invalid_format": "Invalid format for {feature}",
  "error.400.feature_mandatory_missing": "Mandatory feature {feature} is required",
  "error.400.feature_unknown_type": "Unknown feature type for {feature}",
  "error.400.feature_not_allowed": "Feature {feature} is not allowed here",
  "error.400.feature_unknown": "Unknown feature {feature}",
  "error.400.feature_invalid_config": "Invalid config for {feature}",
};

/** The `error.400.feature_*` codes this pair carries copy for. Exported so
 * the locale bundles can be checked complete over it. */
export const FEATURE_ERROR_KEYS: readonly string[] =
  Object.keys(FEATURE_ERRORS_EN).sort();

/**
 * English fallback bundle for forms-react UI keys + backend error codes.
 * The generated `formsErrorBundleEn` (from stapel-forms's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. The
 * attributes family follows, then the pair's own copy.
 */
export const formsI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...formsErrorBundleEn,
  // The per-field family the generated snapshot does not carry (see above).
  ...FEATURE_ERRORS_EN,

  // forms-react UI
  "forms.error.unknown": "Something went wrong. Please try again.",

  "forms.fill.loading": "Loading the form…",
  "forms.fill.retry": "Try again",
  "forms.fill.load_failed":
    "We could not load this form. This is a problem on our side, not with your link.",
  "forms.fill.not_found": "This form link is not valid.",
  "forms.fill.closed": "This form is closed and is no longer accepting responses.",
  "forms.fill.superseded":
    "The form changed while you were filling it in. Please review your answers and submit again.",
  "forms.fill.unsupported_field":
    "This field type ({kind}) cannot be shown in this version of the app.",
  "forms.fill.required": "Required",
  "forms.fill.submit": "Submit",
  "forms.fill.submitting": "Submitting…",
  "forms.fill.thanks": "Thank you — your response has been recorded.",
  "forms.fill.optional_hint": "Optional",
  "forms.fill.bool_yes": "Yes",
  "forms.fill.bool_no": "No",
  "forms.fill.select_placeholder": "Choose…",
  "forms.fill.unlimited": "Unlimited",

  "forms.submit.blocked.done": "You have already submitted this form.",
  "forms.submit.blocked.in_flight": "Submitting your response…",
  "forms.submit.blocked.unsupported_kind":
    "This form uses a field type this app cannot show ({kinds}), so it cannot be submitted safely.",

  "forms.builder.title": "Form builder",
  "forms.builder.add_field": "Add field",
  "forms.builder.remove_field": "Remove field",
  "forms.builder.move_up": "Move up",
  "forms.builder.move_down": "Move down",
  "forms.builder.field_slug": "Key",
  "forms.builder.field_label": "Label",
  "forms.builder.field_required": "Required",
  "forms.builder.field_kind": "Type",
  "forms.builder.save": "Save draft",
  "forms.builder.publish": "Publish",
  "forms.builder.blocked.saving": "Saving the draft…",
  "forms.builder.blocked.publishing": "Publishing…",
  "forms.builder.blocked.no_changes": "Nothing has changed since the last save.",
  "forms.builder.blocked.empty_schema": "Add at least one field before publishing.",
  "forms.builder.blocked.unsaved_draft":
    "Save the draft first — publishing would release the previously saved version.",
  "forms.builder.builder_less":
    "This field type has no editable options here. Its configuration is authored through the draft API.",
  "forms.builder.unsupported_config":
    "Some options of this field ({keys}) cannot be edited here yet.",
  "forms.builder.empty": "This form has no fields yet.",
  "forms.builder.meta_title": "Form title",
  "forms.builder.meta_description": "Description",
  "forms.builder.meta_submit_label": "Submit button text",
  "forms.builder.meta_confirmation": "Confirmation message",
  "forms.builder.state_open": "Open",
  "forms.builder.state_closed": "Closed",
  "forms.builder.state_draft": "Draft",
  "forms.builder.rotate_link": "Rotate public link",
  "forms.builder.public_link": "Public link",

  "forms.responses.title": "Responses",
  "forms.responses.empty": "No responses yet.",
  "forms.responses.load_failed": "We could not load the responses.",
  "forms.responses.submitted_at": "Submitted",
  "forms.responses.respondent": "Respondent",
  "forms.responses.anonymous": "Anonymous",
  "forms.responses.version": "Version",
  "forms.responses.all_versions": "All versions",
  "forms.responses.next": "Next",
  "forms.responses.prev": "Previous",
  "forms.responses.blocked.at_end": "This is the last page.",
  "forms.responses.blocked.at_start": "This is the first page.",
  "forms.responses.delete": "Delete",
  "forms.responses.delete_confirm": "Delete this response permanently?",
  "forms.responses.resend": "Resend",
  "forms.responses.resend_sent": "Sent to {count} destination(s).",
  "forms.responses.resend_override": "Send to specific addresses instead",
  "forms.responses.resend_override_hint":
    "These replace the form's configured recipients for this one send.",
  "forms.responses.export": "Export CSV",
  "forms.responses.exporting": "Exporting… ({pages} page(s))",
  "forms.responses.erased": "Erased",
  "forms.responses.detail": "Response detail",
  "forms.responses.close": "Close",

  "forms.list.title": "Forms",
  "forms.list.empty": "No forms in this workspace yet.",
  "forms.list.load_failed": "We could not load the forms.",
  "forms.list.create": "New form",
  "forms.list.new_title": "Untitled form",
  "forms.list.submission_count": "{count} response(s)",
};

/**
 * Register forms-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`); a later
 * `loadLocale` from stapel-translate can layer localized overrides on top.
 *
 * MERGE-PRIORITY CONVENTION (i18n-shipping.md §3): registration order is
 * override priority — later wins per key. A HOST bundle registered AFTER this
 * call overrides any pair text without a fork. The `ru`/`es` locales ship as
 * the `./i18n/ru` and `./i18n/es` subpaths so a host that does not need them
 * never carries the strings.
 */
export function registerFormsI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, formsI18nBundleEn);
}
