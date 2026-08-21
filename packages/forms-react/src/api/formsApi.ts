import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import { createExportTransport, exportSubmissionsCsv } from "./export.js";
import type {
  CsvExportPage,
  FormsApiOptions,
  FormsRawTransport,
} from "./export.js";
import type {
  FormCreateRequest,
  FormPatchRequest,
  FormRow,
  FormSchema,
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
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors auth-react and
 * profiles-react): the simplest SPA rule is to always send
 * `X-Requested-With: XMLHttpRequest` on mutating requests. Header-token clients
 * ignore it; it is harmless there, so every mutation carries it.
 *
 * The two ANONYMOUS routes carry it too. They are unauthenticated, so there is
 * no session for a cross-site POST to ride — but a host that mounts the form on
 * a cookie-authenticated origin gets Django's CSRF middleware in the path
 * anyway, and a header a server ignores costs nothing next to a submit that
 * 403s only in production.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/** URL-safe path segment. `public_id` is a non-enumerable token straight from
 * the host's props, so it is encoded rather than trusted. */
function seg(value: string): string {
  return encodeURIComponent(value);
}

/** Every admin route is workspace-scoped by an explicit query parameter — the
 * module never infers the workspace from the session. */
function ws(workspaceId: string): { workspace_id: string } {
  return { workspace_id: workspaceId };
}

/**
 * The pair's typed operation surface — one method per stapel-forms endpoint a
 * JS client may call, bound to the injected {@link StapelClient} (the
 * per-module override seam of frontend-standard §7.2). Paths are relative to
 * the runtime's `baseUrl` (e.g. `/forms/api/v1/`).
 *
 * Two families, and the split matters:
 *
 *  - **public** (`getPublicForm`, `submit`) — ANONYMOUS. No capability, no
 *    workspace id, no session. A render-only host page needs nothing but
 *    `createFormsRuntime({baseUrl})`; this is the standalone-embed property.
 *  - **admin** — every one is `IsNotAnonymousUser` + `authorize()` +
 *    `workspace_id`, gated on `forms.view` / `forms.manage` /
 *    `forms.responses.view` / `forms.responses.manage`.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2 (task `core-typed-ops`); until then they are hand-authored here (the ONE
 * legal home of path strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface FormsApi {
  readonly client: StapelClient;

  // ── public, anonymous ──────────────────────────────────────────────────────

  /**
   * The active schema behind a public link. Refuses with
   * `error.404.forms_not_found` (no such link / rotated / soft-deleted) or
   * `error.410.forms_closed` — two DIFFERENT sentences a skin must not merge,
   * and neither of which is "no form here" when the network is what failed.
   */
  getPublicForm(publicId: string): Promise<PublicForm>;

  /**
   * Submit answers. `answers` values are bare scalars keyed by slug; a `select`
   * answer normalizes to a list server-side, so the caller need not wrap it.
   *
   * The refusals a renderer must tell apart: `409
   * error.409.forms_version_superseded` (the schema moved under the
   * respondent — refetch and preserve compatible values), `409
   * error.409.forms_submission_cap`, `410 error.410.forms_closed`, `413
   * error.413.forms_body_too_large`, `429` throttle, and the per-field
   * `error.400.feature_*` family whose `params.field` names the offending slug.
   */
  submit(publicId: string, body: SubmitRequest): Promise<SubmitResult>;

  // ── admin: forms ───────────────────────────────────────────────────────────

  /** The workspace's forms. `forms.view`. */
  listForms(workspaceId: string, state?: FormState): Promise<readonly FormRow[]>;
  /** One form. `forms.view`. */
  getForm(workspaceId: string, formId: string): Promise<FormRow>;
  /** Create a form (state starts `draft`). `forms.manage`. */
  createForm(body: FormCreateRequest): Promise<FormRow>;
  /** Retitle / re-target a form. `forms.manage`. */
  patchForm(
    workspaceId: string,
    formId: string,
    body: FormPatchRequest
  ): Promise<FormRow>;
  /** Soft-delete. `forms.manage`. */
  deleteForm(workspaceId: string, formId: string): Promise<void>;

  /** Replace the builder's scratchpad. `forms.manage`. */
  putDraft(
    workspaceId: string,
    formId: string,
    schema: FormSchema
  ): Promise<FormRow>;
  /**
   * Freeze the draft into the next immutable version. `forms.manage`.
   * Refuses an empty schema, a duplicate slug, a kind outside `FIELD_KINDS`,
   * a field count over the cap, and — backend delta note 1 — a config key the
   * type's dataclass does not know (`error.400.forms_invalid_schema` with
   * `params.key`), because a dropped key is a constraint that silently does
   * not exist.
   */
  publish(workspaceId: string, formId: string): Promise<PublishResult>;
  /** Open / close / return to draft. `forms.manage`. */
  setState(
    workspaceId: string,
    formId: string,
    state: FormState
  ): Promise<FormRow>;
  /** Mint a new `public_id`, retiring the old link. `forms.manage`. */
  rotateLink(workspaceId: string, formId: string): Promise<FormRow>;
  /** Every published version, for the responses view's column sets.
   * `forms.view`. */
  listVersions(
    workspaceId: string,
    formId: string
  ): Promise<readonly FormVersion[]>;

  // ── admin: responses ───────────────────────────────────────────────────────

  /** One keyset page of responses. `forms.responses.view`. */
  listSubmissions(params: SubmissionListParams): Promise<readonly Submission[]>;
  /** One response. `forms.responses.view`. */
  getSubmission(workspaceId: string, submissionId: string): Promise<Submission>;
  /** Erase one response. `forms.responses.manage`. */
  deleteSubmission(workspaceId: string, submissionId: string): Promise<void>;
  /**
   * Re-deliver one response through the form's notification targets.
   * `forms.responses.manage`. An explicit destination override REPLACES the
   * configured targets (backend delta note 7). Admin-initiated, so it is NOT
   * subject to `NOTIFY_COOLDOWN_SECONDS`.
   */
  resendSubmission(
    workspaceId: string,
    submissionId: string,
    body?: ResendRequest
  ): Promise<ResendResult>;

  /**
   * One page of the CSV export, plus the continuation cursor. `forms.responses.view`.
   * Rides the raw transport, not the JSON client — see `api/export.ts`.
   */
  exportSubmissions(params: {
    readonly workspaceId: string;
    readonly formId: string;
    readonly before?: string;
    readonly version?: number;
    readonly signal?: AbortSignal;
  }): Promise<CsvExportPage>;
}

/** Raw-transport binding forwarded from the runtime (declared in
 * `api/export.ts`, which owns the surface that consumes it). */
export type { FormsApiOptions } from "./export.js";

export function createFormsApi(
  client: StapelClient,
  options: FormsApiOptions = {}
): FormsApi {
  const transport: FormsRawTransport = createExportTransport(
    client.baseUrl,
    options
  );

  return {
    client,

    // ── public ───────────────────────────────────────────────────────────────
    getPublicForm: (publicId) => client.get(`/public/${seg(publicId)}/`),

    submit: (publicId, body) =>
      client.post(
        `/public/${seg(publicId)}/submissions/`,
        body satisfies SubmitRequest,
        mutating()
      ),

    // ── admin: forms ─────────────────────────────────────────────────────────
    listForms: (workspaceId, state) =>
      client.get("/forms", {
        query: { ...ws(workspaceId), ...(state !== undefined ? { state } : {}) },
      }),

    getForm: (workspaceId, formId) =>
      client.get(`/forms/${seg(formId)}`, { query: ws(workspaceId) }),

    createForm: (body) =>
      client.post("/forms", body satisfies FormCreateRequest, mutating()),

    patchForm: (workspaceId, formId, body) =>
      client.patch(
        `/forms/${seg(formId)}`,
        body satisfies FormPatchRequest,
        mutating({ query: ws(workspaceId) })
      ),

    deleteForm: (workspaceId, formId) =>
      client.delete(`/forms/${seg(formId)}`, mutating({ query: ws(workspaceId) })),

    putDraft: (workspaceId, formId, schema) =>
      client.put(
        `/forms/${seg(formId)}/draft`,
        { schema },
        mutating({ query: ws(workspaceId) })
      ),

    publish: (workspaceId, formId) =>
      client.post(
        `/forms/${seg(formId)}/publish`,
        undefined,
        mutating({ query: ws(workspaceId) })
      ),

    setState: (workspaceId, formId, state) =>
      client.post(
        `/forms/${seg(formId)}/state`,
        { state },
        mutating({ query: ws(workspaceId) })
      ),

    rotateLink: (workspaceId, formId) =>
      client.post(
        `/forms/${seg(formId)}/rotate-link`,
        undefined,
        mutating({ query: ws(workspaceId) })
      ),

    listVersions: (workspaceId, formId) =>
      client.get(`/forms/${seg(formId)}/versions`, { query: ws(workspaceId) }),

    // ── admin: responses ─────────────────────────────────────────────────────
    listSubmissions: (params) =>
      client.get(`/forms/${seg(params.formId)}/submissions`, {
        query: {
          ...ws(params.workspaceId),
          ...(params.before !== undefined ? { before: params.before } : {}),
          ...(params.limit !== undefined ? { limit: params.limit } : {}),
          ...(params.version !== undefined ? { version: params.version } : {}),
        },
      }),

    getSubmission: (workspaceId, submissionId) =>
      client.get(`/submissions/${seg(submissionId)}`, { query: ws(workspaceId) }),

    deleteSubmission: (workspaceId, submissionId) =>
      client.delete(
        `/submissions/${seg(submissionId)}`,
        mutating({ query: ws(workspaceId) })
      ),

    resendSubmission: (workspaceId, submissionId, body) =>
      client.post(
        `/submissions/${seg(submissionId)}/resend`,
        body ?? {},
        mutating({ query: ws(workspaceId) })
      ),

    exportSubmissions: (params) => exportSubmissionsCsv(transport, params),
  };
}
