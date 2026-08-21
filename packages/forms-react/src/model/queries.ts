import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  FormRow,
  FormState,
  FormVersion,
  PublicForm,
  Submission,
  SubmissionListParams,
} from "../api/types.js";
import { useFormsApi } from "./context.js";
import { formsQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the forms API (frontend-standard §2 — read hooks). Keys are
 * namespaced (see `formsQueryKeys`).
 *
 * SESSION GATING, and the one hook that is deliberately NOT gated. Every
 * ADMIN read is gated on {@link useActiveSessionReady} (owner-diagnosed live
 * incident, 2026-07-17): a list hook with no natural `enabled` condition is
 * exactly the shape that raced a still-bootstrapping session.
 * {@link usePublicForm} is the documented exception core's own doc comment
 * carves out ("or be unconditionally safe pre-session, e.g. a public GET"):
 * the endpoint is anonymous, and gating it would make an embedded form on a
 * marketing page wait for a login bootstrap it has no stake in — a form that
 * renders late for a visitor who will never sign in.
 */

/**
 * The active schema behind a public link — the anonymous read `<StapelForm>`
 * and `<FormFill>` are built on.
 *
 * `retry: false`: the refusals here are VERDICTS, not blips
 * (`error.404.forms_not_found`, `error.410.forms_closed`), and retrying a 404
 * three times only delays the moment the skin can say which one it was. A
 * genuine outage is retried by the person, through the bag's `refetch`.
 */
export function usePublicForm(
  publicId: string
): UseQueryResult<PublicForm, StapelApiError> {
  const api = useFormsApi();
  return useQuery({
    queryKey: formsQueryKeys.publicForm(publicId),
    queryFn: () => api.getPublicForm(publicId),
    enabled: publicId.length > 0,
    retry: false,
  });
}

/** The workspace's forms, optionally filtered by state. `forms.view`. */
export function useForms(
  workspaceId: string,
  state?: FormState
): UseQueryResult<readonly FormRow[], StapelApiError> {
  const api = useFormsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: formsQueryKeys.forms(workspaceId, state),
    queryFn: () => api.listForms(workspaceId, state),
    enabled: sessionReady && workspaceId.length > 0,
  });
}

/** One form, as its workspace's admins see it. `forms.view`. */
export function useForm(
  workspaceId: string,
  formId: string
): UseQueryResult<FormRow, StapelApiError> {
  const api = useFormsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: formsQueryKeys.form(workspaceId, formId),
    queryFn: () => api.getForm(workspaceId, formId),
    enabled: sessionReady && workspaceId.length > 0 && formId.length > 0,
  });
}

/**
 * Every published version of a form. `forms.view`.
 *
 * This is what makes per-version column sets possible in `<ResponsesTable>`:
 * a submission records WHICH schema it answered, so the reviewer's columns
 * come from that version rather than from today's fields.
 */
export function useFormVersions(
  workspaceId: string,
  formId: string
): UseQueryResult<readonly FormVersion[], StapelApiError> {
  const api = useFormsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: formsQueryKeys.versions(workspaceId, formId),
    queryFn: () => api.listVersions(workspaceId, formId),
    enabled: sessionReady && workspaceId.length > 0 && formId.length > 0,
  });
}

/**
 * One keyset page of responses. `forms.responses.view`.
 *
 * Keyset, not offset: `before` is the previous page's last `submitted_at`.
 * Each cursor is its own cache entry (see `formsQueryKeys.submissions`), which
 * is what makes paging back instant instead of a re-fetch.
 */
export function useSubmissions(
  params: SubmissionListParams
): UseQueryResult<readonly Submission[], StapelApiError> {
  const api = useFormsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: formsQueryKeys.submissions(params),
    queryFn: () => api.listSubmissions(params),
    enabled:
      sessionReady && params.workspaceId.length > 0 && params.formId.length > 0,
  });
}

/** One response in full. `forms.responses.view`. */
export function useSubmission(
  workspaceId: string,
  submissionId: string
): UseQueryResult<Submission, StapelApiError> {
  const api = useFormsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: formsQueryKeys.submission(workspaceId, submissionId),
    queryFn: () => api.getSubmission(workspaceId, submissionId),
    enabled: sessionReady && workspaceId.length > 0 && submissionId.length > 0,
  });
}
