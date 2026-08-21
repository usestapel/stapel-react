/**
 * Namespaced TanStack Query keys (frontend-standard §2 — namespaced keys).
 * Everything under the `"forms"` root so a host can invalidate the whole
 * module or match a single resource. Explicit tuple return types satisfy
 * `--isolatedDeclarations`. One entry per read-operation.
 *
 * Invalidation shape: a schema-shifting mutation (draft, publish, rotate-link)
 * invalidates the form AND its public read — the public key is keyed by
 * `public_id`, which `rotateLink` changes, so the root is invalidated instead
 * of a stale id. A response mutation (delete, resend) invalidates the
 * submission list, and delete also the form (its `submission_count` moved).
 */
import type { SubmissionListParams } from "../api/types.js";

const ROOT = "forms" as const;

export const formsQueryKeys: {
  readonly all: readonly ["forms"];
  /** The anonymous schema read, keyed by the public token — NOT by the row
   * id, which an anonymous respondent never learns. */
  publicForm(publicId: string): readonly ["forms", "public", string];
  /** The builder's field-kind catalogue. Workspace-scoped because the
   * endpoint is — a deployment's registered types are not global knowledge. */
  fieldKinds(workspaceId: string): readonly ["forms", "field-kinds", string];
  forms(
    workspaceId: string,
    state?: string
  ): readonly ["forms", "list", string, string | null];
  form(workspaceId: string, formId: string): readonly ["forms", "form", string, string];
  versions(
    workspaceId: string,
    formId: string
  ): readonly ["forms", "versions", string, string];
  submissions(
    params: SubmissionListParams
  ): readonly ["forms", "submissions", SubmissionListParams];
  submission(
    workspaceId: string,
    submissionId: string
  ): readonly ["forms", "submission", string, string];
} = {
  all: [ROOT],
  publicForm: (publicId) => [ROOT, "public", publicId],
  fieldKinds: (workspaceId) => [ROOT, "field-kinds", workspaceId],
  // `state` is part of the key (a filtered list is a different read surface,
  // not the same list) and normalized to `null` so an absent filter and an
  // explicit `undefined` cannot cache twice.
  forms: (workspaceId, state) => [ROOT, "list", workspaceId, state ?? null],
  form: (workspaceId, formId) => [ROOT, "form", workspaceId, formId],
  versions: (workspaceId, formId) => [ROOT, "versions", workspaceId, formId],
  // The params object rides the key: a version filter and a page size are
  // distinct reads. `before` is deliberately included — keyset pages are
  // cached per cursor, which is what makes "back" instant.
  submissions: (params) => [ROOT, "submissions", params],
  submission: (workspaceId, submissionId) => [
    ROOT,
    "submission",
    workspaceId,
    submissionId,
  ],
};
