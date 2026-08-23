import type { StapelClient } from "@stapel/core";
import { downloadExportArchive } from "./download.js";
import type { ExportArchive, GdprRawTransport } from "./download.js";
import type {
  AccountClosure,
  DataOwnerHealth,
  DsarKind,
  DsarState,
  DsarStatus,
  ErasureStatus,
  ExportRequest,
  ExportStatus,
} from "./types.js";

/**
 * What `POST /erasures` is called with: the subject a host has ALREADY
 * removed from its own UI.
 *
 * The pair spells the two required halves as required, because the endpoint's
 * refusal for a missing one is a bare 400 that says nothing about which. The
 * `workspaceId` is optional and means what the module means by it — the
 * partition for owners that partition by workspace — not "the workspace this
 * request came from".
 */
export interface RequestErasureBody {
  /** One of `STAPEL_GDPR["SUBJECT_TYPES"]` — host-extensible, so a plain
   * string, not a closed union this package would have to re-release. */
  readonly subjectType: string;
  /** The HOST's own id for the subject. Opaque here. */
  readonly subjectKey: string;
  readonly workspaceId?: string;
}

/**
 * What `POST /dsar` is called with, as a DISCRIMINATED UNION rather than a bag
 * of optional fields.
 *
 * The endpoint takes two genuinely different callers: a signed-in person (the
 * server reads their email off the session and IGNORES a supplied one, channel
 * `app`) and an anonymous visitor on a public /privacy form (email REQUIRED,
 * captcha token required whenever a backend is configured, channel `form`). A
 * `{ email?, captchaToken? }` bag would let a caller express "authenticated
 * with someone else's email" — which the server discards — and "anonymous with
 * no email", which it refuses with a 400 that a type can refuse for free.
 */
export type DsarSubmission =
  | {
      readonly variant: "app";
      readonly kind: DsarKind;
      /** What the subject is asking for, in their words. */
      readonly note?: string;
    }
  | {
      readonly variant: "anonymous";
      readonly kind: DsarKind;
      /** Where the answer goes. The only identity an anonymous request has. */
      readonly email: string;
      readonly note?: string;
      /**
       * The token core's tiered captcha policy expects. Optional because a
       * deployment with no captcha backend configured leaves the form open —
       * that is the HOST's decision, and a client that required a token would
       * break a legitimate configuration.
       */
      readonly captchaToken?: string;
    };

/** The staff triage PATCH. Every field is optional; sending none is a no-op. */
export interface DsarPatch {
  readonly state?: DsarState;
  readonly note?: string;
  /**
   * Matching an anonymous request to an account. The server wires the request
   * to the machine that answers it at this moment and NOT at intake, because
   * turning an unverified email into an erasure is a deletion oracle.
   */
  readonly userId?: string;
}

/**
 * The pair's typed operation surface — bound to the injected
 * {@link StapelClient} (the per-module override seam of frontend-standard
 * §7.2). Paths are relative to the runtime's `baseUrl` (`/gdpr/api/v1/`).
 *
 * ── Fifteen of the sixteen paths, and the one that is not here ────────────
 *
 * `POST /internal/export/{id}/part-ready` is a SERVICE endpoint
 * (`IsServiceRequest`): in microservices mode a data owner posts its finished
 * section to it with a service credential no browser holds. It is excluded on
 * purpose, not by omission — `manifest.json` still lists the whole contract.
 *
 * These operations will be GENERATED from schema.json operationIds by
 * gen-api v2; until then they are hand-authored here (the ONE legal home of
 * path strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface GdprApi {
  readonly client: StapelClient;

  // ── account closure (Art. 17, with the grace the product promises) ───────

  /**
   * The caller's own closure state.
   *
   * ANSWERS 404 `error.404.gdpr.no_active_closure` WHEN NOTHING IS PENDING —
   * which is the state almost every account is in. The model layer folds that
   * into `null`; nothing that renders it may treat it as a failure.
   */
  closureStatus(options?: {
    readonly signal?: AbortSignal;
  }): Promise<AccountClosure>;

  /** Start the 30-day grace. Sessions are revoked immediately, server-side. */
  initiateClosure(): Promise<AccountClosure>;

  /** Stop a closure that is still in grace. */
  cancelClosure(): Promise<AccountClosure>;

  // ── data export (Art. 15 / 20) ───────────────────────────────────────────

  /** Ask for the archive. Once per 30 days; the refusal is a 409. */
  requestExport(): Promise<ExportRequest>;

  /**
   * How far the archive got. Answers 404 `error.404.gdpr.export_not_found`
   * when none was ever requested — the same shape of "404 that is a state" as
   * the closure read.
   */
  exportStatus(options?: {
    readonly signal?: AbortSignal;
  }): Promise<ExportStatus>;

  /**
   * Spend the single-use token and take the ZIP. Raw transport — see
   * `api/download.ts` for why this one operation cannot ride the JSON client.
   */
  downloadExport(
    token: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ExportArchive>;

  // ── subject-scoped erasure (Art. 17 for the things a host deletes) ───────

  /**
   * Open an erasure for a subject the host has already soft-deleted.
   *
   * Authorization is the host's `ERASURE_AUTHORIZER` seam, defaulting to staff
   * only — so a 403 here usually means the host has not plugged its ownership
   * predicate in, and the pair says so rather than telling a person they may
   * not delete their own recording.
   */
  requestErasure(body: RequestErasureBody): Promise<ErasureStatus>;

  /** One erasure: state, per-owner receipts, processor windows. */
  erasure(
    requestId: number,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ErasureStatus>;

  /** The caller's own erasures — the "waiting to be deleted" list. */
  myErasures(options?: {
    readonly signal?: AbortSignal;
  }): Promise<readonly ErasureStatus[]>;

  // ── DSAR intake (Art. 12/15/16/17/20) ────────────────────────────────────

  /** Record a data-subject request. The acknowledgement is automatic. */
  submitDsar(submission: DsarSubmission): Promise<DsarStatus>;

  /** The staff queue. A non-staff caller is refused with a 403. */
  dsarQueue(options?: {
    readonly signal?: AbortSignal;
  }): Promise<readonly DsarStatus[]>;

  /** One request (staff). */
  dsar(
    dsarId: number,
    options?: { readonly signal?: AbortSignal }
  ): Promise<DsarStatus>;

  /** Triage: state, note, and matching an anonymous request to an account. */
  updateDsar(dsarId: number, patch: DsarPatch): Promise<DsarStatus>;

  // ── operations ───────────────────────────────────────────────────────────

  /** Which declared data owners are answering, and which have gone quiet. */
  ownersHealth(options?: {
    readonly signal?: AbortSignal;
  }): Promise<readonly DataOwnerHealth[]>;
}

/** Options the raw-bytes surface needs and the JSON client already holds. */
export interface GdprApiOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly defaultHeaders?: Record<string, string>;
}

const signalOf = (options?: {
  readonly signal?: AbortSignal;
}): { signal?: AbortSignal } =>
  options?.signal !== undefined ? { signal: options.signal } : {};

/** The wire body for one DSAR submission — the union, flattened once. */
function dsarBody(submission: DsarSubmission): Record<string, string> {
  const base: Record<string, string> = { kind: submission.kind };
  if (submission.note !== undefined) base["note"] = submission.note;
  if (submission.variant === "anonymous") {
    base["email"] = submission.email;
    if (submission.captchaToken !== undefined) {
      base["captcha_token"] = submission.captchaToken;
    }
  }
  return base;
}

export function createGdprApi(
  client: StapelClient,
  options?: GdprApiOptions
): GdprApi {
  const transport: GdprRawTransport = {
    baseUrl: client.baseUrl,
    ...(options?.fetch !== undefined ? { fetch: options.fetch } : {}),
    ...(options?.credentials !== undefined
      ? { credentials: options.credentials }
      : {}),
    ...(options?.defaultHeaders !== undefined
      ? { headers: options.defaultHeaders }
      : {}),
  };

  return {
    client,

    closureStatus: (opts) =>
      client.get("/user/account/close/status", signalOf(opts)),
    initiateClosure: () => client.post("/user/account/close"),
    cancelClosure: () => client.post("/user/account/cancel-close"),

    requestExport: () => client.post("/user/data-export/request"),
    exportStatus: (opts) =>
      client.get("/user/data-export/status", signalOf(opts)),
    downloadExport: (token, opts) =>
      downloadExportArchive(transport, token, opts),

    requestErasure: (body) =>
      client.post("/erasures", {
        subject_type: body.subjectType,
        subject_key: body.subjectKey,
        ...(body.workspaceId !== undefined
          ? { workspace_id: body.workspaceId }
          : {}),
      }),
    // The id is a database pk (an integer on the wire), but it is still
    // interpolated through encodeURIComponent: a path segment built from a
    // value is escaped here, always, so the rule holds by shape rather than
    // by an argument about this particular type.
    erasure: (requestId, opts) =>
      client.get(`/erasures/${encodeURIComponent(String(requestId))}`, signalOf(opts)),
    myErasures: (opts) => client.get("/me/erasures", signalOf(opts)),

    submitDsar: (submission) => client.post("/dsar", dsarBody(submission)),
    dsarQueue: (opts) => client.get("/dsar", signalOf(opts)),
    dsar: (dsarId, opts) =>
      client.get(`/dsar/${encodeURIComponent(String(dsarId))}`, signalOf(opts)),
    updateDsar: (dsarId, patch) =>
      client.patch(`/dsar/${encodeURIComponent(String(dsarId))}`, {
        ...(patch.state !== undefined ? { state: patch.state } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        ...(patch.userId !== undefined ? { user_id: patch.userId } : {}),
      }),

    ownersHealth: (opts) => client.get("/owners/health", signalOf(opts)),
  };
}
