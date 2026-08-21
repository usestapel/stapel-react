import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import { isStapelApiError } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import { concatCsvPages } from "../api/export.js";
import type {
  FormCreateRequest,
  FormPatchRequest,
  FormRow,
  FormSchema,
  FormState,
  PublishResult,
  ResendRequest,
  ResendResult,
  SubmitRequest,
  SubmitResult,
} from "../api/types.js";
import { useFormsApi } from "./context.js";
import { formsQueryKeys } from "./queryKeys.js";

/**
 * Write hooks (frontend-standard §2 — mutations invalidate on success).
 *
 * A forms write shifts several cached reads at once — a publish moves the
 * form's `active_version`, adds a version row, AND changes what the public
 * link serves; a rotate-link changes the very key the public read is cached
 * under — so each admin mutation invalidates the module root
 * (`formsQueryKeys.all`) rather than guessing which entries moved. Guessing
 * is how `rotateLink` would leave a stale schema cached under an id that no
 * longer resolves.
 *
 * Options are built as typed `UseMutationOptions` objects (not call-site
 * generics) so `void`/error types stay in reference position.
 */

function useInvalidateModule(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: formsQueryKeys.all });
  };
}

// ── the anonymous write ──────────────────────────────────────────────────────

/** Variables for {@link useSubmitForm}. */
export interface SubmitVariables {
  readonly publicId: string;
  readonly body: SubmitRequest;
}

/**
 * `POST /public/<public_id>/submissions/` — the anonymous submit.
 *
 * Deliberately does NOT invalidate anything: an anonymous respondent holds no
 * admin cache to refresh, and the one read they do hold (the schema) is
 * unchanged by their own submission. The 409-superseded refetch is driven by
 * `<FormFill>`, which knows to preserve the values first.
 *
 * `retry: false` — a resubmit is not idempotent. A retried POST that the
 * server actually received is a duplicate response in somebody's spreadsheet.
 */
export function useSubmitForm(): UseMutationResult<
  SubmitResult,
  StapelApiError,
  SubmitVariables
> {
  const api = useFormsApi();
  const options: UseMutationOptions<
    SubmitResult,
    StapelApiError,
    SubmitVariables
  > = {
    mutationFn: (vars) => api.submit(vars.publicId, vars.body),
    retry: false,
  };
  return useMutation(options);
}

// ── admin: the form lifecycle ────────────────────────────────────────────────

/** `POST /forms` — create a form (it starts in `draft`). `forms.manage`. */
export function useCreateForm(): UseMutationResult<
  FormRow,
  StapelApiError,
  FormCreateRequest
> {
  const api = useFormsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<FormRow, StapelApiError, FormCreateRequest> =
    {
      mutationFn: (body) => api.createForm(body),
      onSuccess: invalidate,
    };
  return useMutation(options);
}

/** Variables for {@link useUpdateForm}. */
export interface UpdateFormVariables {
  readonly workspaceId: string;
  readonly formId: string;
  readonly patch: FormPatchRequest;
}

/** `PATCH /forms/<id>` — title and notification targets. `forms.manage`. */
export function useUpdateForm(): UseMutationResult<
  FormRow,
  StapelApiError,
  UpdateFormVariables
> {
  const api = useFormsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<
    FormRow,
    StapelApiError,
    UpdateFormVariables
  > = {
    mutationFn: (vars) => api.patchForm(vars.workspaceId, vars.formId, vars.patch),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** Variables for the form-scoped mutations that take no body. */
export interface FormRef {
  readonly workspaceId: string;
  readonly formId: string;
}

/** `DELETE /forms/<id>` — soft-delete. `forms.manage`. */
export function useDeleteForm(): UseMutationResult<
  void,
  StapelApiError,
  FormRef
> {
  const api = useFormsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<void, StapelApiError, FormRef> = {
    mutationFn: (vars) => api.deleteForm(vars.workspaceId, vars.formId),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** Variables for {@link useSaveDraft}. */
export interface SaveDraftVariables extends FormRef {
  readonly schema: FormSchema;
}

/**
 * `PUT /forms/<id>/draft` — replace the builder's scratchpad. `forms.manage`.
 *
 * A draft save is NOT a publish: what respondents see does not move until
 * {@link usePublishForm} freezes the draft into the next immutable version.
 * That separation is the whole reason a live form can be edited safely.
 */
export function useSaveDraft(): UseMutationResult<
  FormRow,
  StapelApiError,
  SaveDraftVariables
> {
  const api = useFormsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<FormRow, StapelApiError, SaveDraftVariables> =
    {
      mutationFn: (vars) =>
        api.putDraft(vars.workspaceId, vars.formId, vars.schema),
      onSuccess: invalidate,
    };
  return useMutation(options);
}

/**
 * `POST /forms/<id>/publish` — freeze the draft into the next version.
 * `forms.manage`.
 *
 * Refuses a schema the engine will not accept, per-field where it can:
 * `error.400.forms_empty_schema`, `..._duplicate_slug` (`params.slug`),
 * `..._kind_not_allowed` (`params.kind`), `..._too_many_fields`, and
 * `..._invalid_schema` with `params.key` for a config key the type's
 * dataclass does not know — which is a cap that would otherwise silently not
 * exist (backend delta note 1).
 */
export function usePublishForm(): UseMutationResult<
  PublishResult,
  StapelApiError,
  FormRef
> {
  const api = useFormsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<PublishResult, StapelApiError, FormRef> = {
    mutationFn: (vars) => api.publish(vars.workspaceId, vars.formId),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** Variables for {@link useSetFormState}. */
export interface SetFormStateVariables extends FormRef {
  readonly state: FormState;
}

/** `POST /forms/<id>/state` — open / close / back to draft. `forms.manage`. */
export function useSetFormState(): UseMutationResult<
  FormRow,
  StapelApiError,
  SetFormStateVariables
> {
  const api = useFormsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<
    FormRow,
    StapelApiError,
    SetFormStateVariables
  > = {
    mutationFn: (vars) => api.setState(vars.workspaceId, vars.formId, vars.state),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/**
 * `POST /forms/<id>/rotate-link` — mint a new `public_id`. `forms.manage`.
 *
 * The old link stops resolving (a uniform `error.404.forms_not_found`, so a
 * probe cannot tell a rotated link from one that never existed). This is why
 * every admin mutation invalidates the module root: the public read is cached
 * BY the token this call replaces.
 */
export function useRotateLink(): UseMutationResult<
  FormRow,
  StapelApiError,
  FormRef
> {
  const api = useFormsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<FormRow, StapelApiError, FormRef> = {
    mutationFn: (vars) => api.rotateLink(vars.workspaceId, vars.formId),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

// ── admin: responses ─────────────────────────────────────────────────────────

/** Variables for the submission-scoped mutations. */
export interface SubmissionRef {
  readonly workspaceId: string;
  readonly submissionId: string;
}

/** `DELETE /submissions/<id>` — erase one response.
 * `forms.responses.manage`. */
export function useDeleteSubmission(): UseMutationResult<
  void,
  StapelApiError,
  SubmissionRef
> {
  const api = useFormsApi();
  const invalidate = useInvalidateModule();
  const options: UseMutationOptions<void, StapelApiError, SubmissionRef> = {
    mutationFn: (vars) =>
      api.deleteSubmission(vars.workspaceId, vars.submissionId),
    onSuccess: invalidate,
  };
  return useMutation(options);
}

/** Variables for {@link useResendSubmission}. */
export interface ResendVariables extends SubmissionRef {
  /**
   * Destination override. Given either list, the form's configured targets
   * are **replaced**, not supplemented (backend delta note 7) — "send this one
   * to legal" must not also re-send it to everybody who already received it.
   * Omit to use the form's own targets.
   */
  readonly override?: ResendRequest;
}

/**
 * `POST /submissions/<id>/resend` — re-deliver one response.
 * `forms.responses.manage`.
 *
 * Admin-initiated, so it is NOT subject to `NOTIFY_COOLDOWN_SECONDS` (that
 * cooldown suppresses respondent-triggered auto-notifies; a resend is an
 * explicit operator act). Reads no cache and invalidates none — delivery is
 * not state this pair holds.
 */
export function useResendSubmission(): UseMutationResult<
  ResendResult,
  StapelApiError,
  ResendVariables
> {
  const api = useFormsApi();
  const options: UseMutationOptions<
    ResendResult,
    StapelApiError,
    ResendVariables
  > = {
    mutationFn: (vars) =>
      api.resendSubmission(vars.workspaceId, vars.submissionId, vars.override),
    retry: false,
  };
  return useMutation(options);
}

// ── admin: CSV export ────────────────────────────────────────────────────────

/** The state of a running CSV export. */
export interface CsvExportBag {
  /** Drive the export to completion; resolves to the whole CSV text. */
  run(params: {
    readonly workspaceId: string;
    readonly formId: string;
    readonly version?: number;
  }): Promise<string>;
  readonly isExporting: boolean;
  /** Pages fetched so far — a coarse but honest progress signal for a long
   * export (the server never tells us the total). */
  readonly pagesFetched: number;
  readonly error: StapelApiError | null;
}

/**
 * The paged CSV export, driven to completion.
 *
 * The server streams a bounded page per request and hands back the
 * continuation cursor in the `X-Forms-Next-Before` response header — never in
 * the body, which is a spreadsheet (backend delta note 6). This hook follows
 * that header until it is absent, concatenates the pages keeping the header
 * row exactly once, and returns the whole CSV as text. The cursor is passed
 * back VERBATIM; re-formatting it is what made the second page a silent 400
 * during the backend build.
 *
 * The result is text, not a download: handing the caller a string keeps this
 * hook usable in a test, in a node script, and in a browser, and leaves the
 * "make it a file" decision (which is a DOM act) to the skin.
 */
export function useCsvExport(): CsvExportBag {
  const api = useFormsApi();
  const [isExporting, setExporting] = useState(false);
  const [pagesFetched, setPagesFetched] = useState(0);
  const [error, setError] = useState<StapelApiError | null>(null);

  const run = useCallback(
    async (params: {
      readonly workspaceId: string;
      readonly formId: string;
      readonly version?: number;
    }): Promise<string> => {
      setExporting(true);
      setPagesFetched(0);
      setError(null);
      const pages: string[] = [];
      let before: string | undefined;
      try {
        for (;;) {
          const page = await api.exportSubmissions({
            workspaceId: params.workspaceId,
            formId: params.formId,
            ...(params.version !== undefined ? { version: params.version } : {}),
            ...(before !== undefined ? { before } : {}),
          });
          pages.push(page.csv);
          setPagesFetched(pages.length);
          if (page.nextBefore === null) break;
          before = page.nextBefore;
        }
        return concatCsvPages(pages);
      } catch (caught) {
        // Not `caught as StapelApiError`: a network fault carries neither
        // `.code` nor `.status`, and claiming otherwise makes the skin render
        // `undefined` as a sentence. `null` means "we cannot describe it".
        setError(isStapelApiError(caught) ? caught : null);
        throw caught;
      } finally {
        setExporting(false);
      }
    },
    [api]
  );

  return { run, isExporting, pagesFetched, error };
}
