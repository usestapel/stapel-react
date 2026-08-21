/**
 * `@stapel/forms-react` — the headless React pair for stapel-forms
 * (frontend-standard §2). Business + state only, zero visual opinion; the
 * antd skin lives behind the `./default` subpath so a host that renders its
 * own visuals never carries it.
 *
 * ── The one-liner the owner asked for ──────────────────────────────────────
 *
 * ```tsx
 * const runtime = createFormsRuntime({ baseUrl: "/forms/api/v1/" });
 * <FormsProvider runtime={runtime}>
 *   <StapelForm publicId="k3J…x9" />   // from @stapel/forms-react/default
 * </FormsProvider>
 * ```
 *
 * No session, no workspace id, no auth client: the two public routes are
 * anonymous, so a marketing page can embed a form and nothing else.
 *
 * Layers: api → model → flows → headless → i18n. Generated surfaces (the
 * typed schema, the error map, the manifest, llms.txt) are produced by the
 * monorepo `gen:*` drivers from stapel-forms's own `docs/` artifacts and
 * stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createFormsApi } from "./api/formsApi.js";
export type { FormsApi, FormsApiOptions } from "./api/formsApi.js";
export type { Schemas } from "./api/types.js";
export type {
  BuiltinFieldKind,
  FormCreateRequest,
  FormFieldDef,
  FormPatchRequest,
  FormRow,
  FormSchema,
  FormSchemaMeta,
  FormSettings,
  FormState,
  FormVersion,
  PublicForm,
  PublishResult,
  ResendRequest,
  ResendResult,
  Submission,
  SubmissionListParams,
  SubmitRequest,
  SubmitResult,
} from "./api/types.js";
export { BUILTIN_FIELD_KINDS as ALLOWED_FIELD_KINDS } from "./api/types.js";

/** The CSV export's raw transport — a header cursor and a file body are two
 * things core's JSON client cannot carry (see `api/export.ts`). */
export {
  concatCsvPages,
  exportSubmissionsCsv,
  FORMS_NEXT_BEFORE_HEADER,
} from "./api/export.js";
export type { CsvExportPage, FormsRawTransport } from "./api/export.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { FORMS_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  FormsFlowId,
  FormsFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context, hooks) ───────────────────────
export { createFormsRuntime } from "./model/runtime.js";
export type {
  FormsRuntime,
  CreateFormsRuntimeOptions,
} from "./model/runtime.js";
export {
  FormsRuntimeContext,
  useFormsRuntime,
  useFormsApi,
  useFormsAnalytics,
} from "./model/context.js";
export { formsQueryKeys } from "./model/queryKeys.js";

export {
  useForm,
  useForms,
  useFormVersions,
  usePublicForm,
  useSubmission,
  useSubmissions,
} from "./model/queries.js";

export {
  useCreateForm,
  useCsvExport,
  useDeleteForm,
  useDeleteSubmission,
  usePublishForm,
  useResendSubmission,
  useRotateLink,
  useSaveDraft,
  useSetFormState,
  useSubmitForm,
  useUpdateForm,
} from "./model/mutations.js";
export type {
  CsvExportBag,
  FormRef,
  ResendVariables,
  SaveDraftVariables,
  SetFormStateVariables,
  SubmissionRef,
  SubmitVariables,
  UpdateFormVariables,
} from "./model/mutations.js";

// ── widgets (the open seam) ──────────────────────────────────────────────────
export {
  registerFormFieldWidget,
  unregisterFormFieldWidget,
  resolveFormFieldWidget,
  registeredFormFieldKinds,
} from "./widgets/registry.js";
export type {
  FormFieldWidget,
  FormFieldWidgetProps,
} from "./widgets/registry.js";

export {
  BUILDER_KINDS,
  FIELD_KIND_CONFIG_FORMS,
  configFormFor,
  defaultConfigFor,
  isBuilderSupportedKind,
} from "./widgets/configForms.js";
export type {
  ConfigFieldKind,
  ConfigFieldSpec,
  ConfigSelectOption,
  KindConfigForm,
} from "./widgets/configForms.js";

export {
  FEATURE_ERROR_CODES,
  isBlank,
  optionValues,
  validateAnswers,
  validateFieldValue,
} from "./widgets/validate.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { FormsProvider } from "./headless/FormsProvider.js";
export { FormFill } from "./headless/FormFill.js";
export type { FormFillBag } from "./headless/FormFill.js";
export { FormBuilder } from "./headless/FormBuilder.js";
export type { BuilderField, FormBuilderBag } from "./headless/FormBuilder.js";
export { ResponsesTable } from "./headless/ResponsesTable.js";
export type {
  ResponseColumn,
  ResponsesTableBag,
  ResponsesView,
} from "./headless/ResponsesTable.js";
export { FormList } from "./headless/FormList.js";
export type { FormListBag } from "./headless/FormList.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  FEATURE_ERROR_KEYS,
  FORMS_I18N_KEYS,
  formsI18nBundleEn,
  registerFormsI18n,
} from "./i18n/keys.js";
export type { FormsI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  FORMS_ERRORS,
  FORMS_ERROR_CODES,
  formsErrorBundleEn,
  explainFormsError,
} from "./i18n/errorsMap.js";
export type {
  FormsErrorCode,
  FormsErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
