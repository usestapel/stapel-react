import type { StapelClient } from "@stapel/core";
import type {
  AppealOutcome,
  Decision,
  SanctionKind,
  SanctionState,
} from "./enums.js";
import type {
  Appeal,
  Case,
  CaseDetail,
  CaseEvent,
  PolicyDisclosure,
  Report,
  ReportResult,
  RescanResult,
  Sanction,
  Stats,
  Verdict,
} from "./types.js";

/**
 * The pair's typed operation surface, bound to the injected {@link StapelClient}
 * (the per-module override seam of frontend-standard §7.2). Paths are relative
 * to the runtime's `baseUrl` (`/moderation/api/v1/`).
 *
 * ── THE TRAILING SLASH IS LOAD-BEARING ────────────────────────────────────
 *
 * `urls_v1.py:32-53` registers the three USER routes with a trailing slash
 * (`reports/`, `appeals/`) and every CONSOLE route without one (`cases`,
 * `stats`, `sanctions`, `appeals/queue`, …). Django's `APPEND_SLASH` only
 * rescues a GET, and only with a redirect that drops the body — so a POST to
 * `reports` (no slash) is a 404 and a POST to `cases/x/verdict/` (added slash)
 * is a 404. The split is not decorative: it is audience-ordered, user routes
 * first. `test/pair.test.ts` pins every path string.
 *
 * All eighteen operations of the contract are here; none is omitted.
 */
export interface ModerationApi {
  readonly client: StapelClient;

  // ── user surface ─────────────────────────────────────────────────────────

  /**
   * The DSA Art. 15 disclosure. The module's ONLY anonymous route, so the
   * report sheet can show a visitor what the rules are before asking them to
   * sign in. `targetType` narrows the reasons to the ones that apply.
   */
  policy(
    params?: {
      readonly targetType?: string;
      readonly lang?: string;
    },
    options?: RequestExtras
  ): Promise<PolicyDisclosure>;

  /** File a complaint (Art. 16(2)). `POST reports/` — WITH the slash. */
  submitReport(body: SubmitReportBody): Promise<ReportResult>;

  /**
   * The complaints this account filed. A bare array, keyset-paged: pass the
   * last row's `created_at` as `before` for the next page.
   *
   * The backend deliberately returns NO outcome per report — a reporter is
   * told by notification, not by a status column — so nothing here can be
   * rendered as "your report was rejected".
   */
  myReports(page?: KeysetPage, options?: RequestExtras): Promise<readonly Report[]>;

  /** Appeal a decision about your own content (Art. 20). `POST appeals/`. */
  submitAppeal(body: SubmitAppealBody): Promise<Appeal>;

  /** The appeals this account filed, keyset-paged. */
  myAppeals(page?: KeysetPage, options?: RequestExtras): Promise<readonly Appeal[]>;

  // ── moderator console ────────────────────────────────────────────────────

  /** One keyset page of the cross-target queue. `GET cases` — no slash. */
  cases(filters?: CaseFilters, options?: RequestExtras): Promise<readonly Case[]>;

  /** One case card, with the target's content read live. */
  caseDetail(caseId: string, options?: RequestExtras): Promise<CaseDetail>;

  /** Take the lease. Answers 409 `moderation_case_claimed` if somebody else
   * holds it — the console shows who, and until when. */
  claim(caseId: string): Promise<Case>;

  /**
   * Hand the lease back. Since backend 0.3.0 a named moderator may only
   * release their OWN live lease (409 `moderation_not_claimant` otherwise) —
   * before that, a second console tab could hand back somebody else's work.
   */
  release(caseId: string): Promise<Case>;

  /** Re-run the automatic stage. 202: the case is in `screening` again. */
  rescan(caseId: string): Promise<RescanResult>;

  /** Decide, optionally with the consequence in the same act. */
  verdict(caseId: string, body: VerdictBody): Promise<Verdict>;

  /** The case's audit trail. Unbounded — the console collapses it by default. */
  caseEvents(caseId: string, options?: RequestExtras): Promise<readonly CaseEvent[]>;

  /** Queue counters for the console header. */
  stats(options?: RequestExtras): Promise<Stats>;

  /** Sanctions, filterable by subject and state. `GET sanctions` — no slash. */
  sanctions(
    filters?: SanctionFilters,
    options?: RequestExtras
  ): Promise<readonly Sanction[]>;

  /** Issue a sanction outside a verdict. HIGH clearance + step-up. */
  issueSanction(body: IssueSanctionBody): Promise<Sanction>;

  /** Revoke an active sanction early. */
  liftSanction(sanctionId: string, note?: string): Promise<Sanction>;

  /** The appeal queue — a DIFFERENT moderator than the one who decided. */
  appealQueue(
    filters?: AppealQueueFilters,
    options?: RequestExtras
  ): Promise<readonly Appeal[]>;

  /** Decide an appeal. An overturn reopens and re-decides the case. */
  resolveAppeal(appealId: string, body: ResolveAppealBody): Promise<Appeal>;
}

/** Per-call extras every read accepts (TanStack hands the query's signal in). */
export interface RequestExtras {
  readonly signal?: AbortSignal;
}

/** The paging half every list endpoint shares (`KeysetQuerySerializer`). */
export interface KeysetPage {
  /** The previous page's last `created_at`, as an ISO instant. */
  readonly before?: string;
  /** 1..`MAX_PAGE_SIZE` (the backend clamps; it never errors on a big one). */
  readonly limit?: number;
}

/** `POST reports/` (Art. 16(2)). */
export interface SubmitReportBody {
  readonly targetType: string;
  /** The host's opaque id for the thing. Never parsed by the module. */
  readonly targetKey: string;
  readonly reasonCode: string;
  readonly description?: string;
  /** The Art. 16(2)(d) declaration. Defaults to `false` on the wire: a
   * checkbox nobody ticked is a checkbox nobody ticked. */
  readonly goodFaith?: boolean;
  /** Where the answer goes when the reporter has no account. */
  readonly contactEmail?: string;
  /** The opaque tenant/area partition. */
  readonly scopeKey?: string;
  /**
   * The reporter's own snapshot of a target NOBODY serves (an evidence-based
   * target type — backend 0.2.0). Refused on a type that serves its own
   * content, and refused rather than truncated over `MAX_EVIDENCE_BYTES`.
   */
  readonly evidence?: Readonly<Record<string, unknown>>;
}

/** `POST appeals/`. */
export interface SubmitAppealBody {
  readonly caseId: string;
  readonly body: string;
  /** The sanction being appealed, when the appeal is about the consequence
   * rather than the decision. */
  readonly sanctionId?: string;
}

/** `GET cases` query (`CaseQuerySerializer`). */
export interface CaseFilters extends KeysetPage {
  readonly state?: string;
  readonly targetType?: string;
  readonly reasonCode?: string;
  readonly scopeKey?: string;
  readonly severityMin?: number;
  readonly subjectUserId?: string;
}

/** The optional sanction attached to a verdict (`SanctionRequest`). */
export interface VerdictSanction {
  readonly kind: SanctionKind;
  /** Omit for the kind's ladder default; `null` is not a thing the wire
   * accepts, so "indefinite" is expressed by omitting the field. */
  readonly durationSeconds?: number;
  readonly scope?: string;
  readonly reasonCode?: string;
  readonly note?: string;
}

/** `POST cases/{id}/verdict`. */
export interface VerdictBody {
  readonly decision: Decision;
  readonly reasonCode?: string;
  readonly note?: string;
  readonly sanction?: VerdictSanction;
}

/** `GET sanctions` query. */
export interface SanctionFilters extends KeysetPage {
  readonly subjectUserId?: string;
  readonly state?: SanctionState | "";
}

/** `POST sanctions` — a sanction issued outside a verdict. */
export interface IssueSanctionBody {
  readonly subjectUserId: string;
  readonly kind: SanctionKind;
  readonly reasonCode?: string;
  readonly note?: string;
  readonly durationSeconds?: number;
  readonly scope?: string;
  /** Absent = the service opens a `manual` case, so the sanction still has
   * exactly one audit trail behind it. */
  readonly caseId?: string;
  readonly targetType?: string;
  readonly targetKey?: string;
}

/** `GET appeals/queue` query. */
export interface AppealQueueFilters extends KeysetPage {
  readonly state?: string;
}

/** `POST appeals/{id}/resolve`. */
export interface ResolveAppealBody {
  readonly outcome: AppealOutcome;
  readonly note?: string;
  readonly reasonCode?: string;
}

const signalOf = (options?: RequestExtras): { signal?: AbortSignal } =>
  options?.signal !== undefined ? { signal: options.signal } : {};

/** Drop `undefined` entries so an unset filter contributes no query key at
 * all — "no filter" and "an empty filter" must not produce different URLs. */
function query(
  entries: Readonly<Record<string, string | number | boolean | undefined>>
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}

/** A path segment built from a value is escaped here, always. */
const seg = (value: string): string => encodeURIComponent(value);

export function createModerationApi(client: StapelClient): ModerationApi {
  return {
    client,

    policy: (params, options) =>
      client.get("/policy", {
        query: query({
          target_type: params?.targetType,
          lang: params?.lang,
        }),
        ...signalOf(options),
      }),

    submitReport: (body) =>
      client.post("/reports/", {
        target_type: body.targetType,
        target_key: body.targetKey,
        reason_code: body.reasonCode,
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.goodFaith !== undefined ? { good_faith: body.goodFaith } : {}),
        ...(body.contactEmail !== undefined
          ? { contact_email: body.contactEmail }
          : {}),
        ...(body.scopeKey !== undefined ? { scope_key: body.scopeKey } : {}),
        ...(body.evidence !== undefined ? { evidence: body.evidence } : {}),
      }),

    myReports: (page, options) =>
      client.get("/reports/", {
        query: query({ before: page?.before, limit: page?.limit }),
        ...signalOf(options),
      }),

    submitAppeal: (body) =>
      client.post("/appeals/", {
        case_id: body.caseId,
        body: body.body,
        ...(body.sanctionId !== undefined
          ? { sanction_id: body.sanctionId }
          : {}),
      }),

    myAppeals: (page, options) =>
      client.get("/appeals/", {
        query: query({ before: page?.before, limit: page?.limit }),
        ...signalOf(options),
      }),

    cases: (filters, options) =>
      client.get("/cases", {
        query: query({
          state: filters?.state,
          target_type: filters?.targetType,
          reason_code: filters?.reasonCode,
          scope_key: filters?.scopeKey,
          severity_min: filters?.severityMin,
          subject_user_id: filters?.subjectUserId,
          before: filters?.before,
          limit: filters?.limit,
        }),
        ...signalOf(options),
      }),

    caseDetail: (caseId, options) =>
      client.get(`/cases/${seg(caseId)}`, signalOf(options)),

    claim: (caseId) => client.post(`/cases/${seg(caseId)}/claim`),
    release: (caseId) => client.post(`/cases/${seg(caseId)}/release`),
    rescan: (caseId) => client.post(`/cases/${seg(caseId)}/rescan`),

    verdict: (caseId, body) =>
      client.post(`/cases/${seg(caseId)}/verdict`, {
        decision: body.decision,
        ...(body.reasonCode !== undefined ? { reason_code: body.reasonCode } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.sanction !== undefined
          ? {
              sanction: {
                kind: body.sanction.kind,
                ...(body.sanction.durationSeconds !== undefined
                  ? { duration_seconds: body.sanction.durationSeconds }
                  : {}),
                ...(body.sanction.scope !== undefined
                  ? { scope: body.sanction.scope }
                  : {}),
                ...(body.sanction.reasonCode !== undefined
                  ? { reason_code: body.sanction.reasonCode }
                  : {}),
                ...(body.sanction.note !== undefined
                  ? { note: body.sanction.note }
                  : {}),
              },
            }
          : {}),
      }),

    caseEvents: (caseId, options) =>
      client.get(`/cases/${seg(caseId)}/events`, signalOf(options)),

    stats: (options) => client.get("/stats", signalOf(options)),

    sanctions: (filters, options) =>
      client.get("/sanctions", {
        query: query({
          subject_user_id: filters?.subjectUserId,
          state: filters?.state,
          before: filters?.before,
          limit: filters?.limit,
        }),
        ...signalOf(options),
      }),

    issueSanction: (body) =>
      client.post("/sanctions", {
        subject_user_id: body.subjectUserId,
        kind: body.kind,
        ...(body.reasonCode !== undefined ? { reason_code: body.reasonCode } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.durationSeconds !== undefined
          ? { duration_seconds: body.durationSeconds }
          : {}),
        ...(body.scope !== undefined ? { scope: body.scope } : {}),
        ...(body.caseId !== undefined ? { case_id: body.caseId } : {}),
        ...(body.targetType !== undefined ? { target_type: body.targetType } : {}),
        ...(body.targetKey !== undefined ? { target_key: body.targetKey } : {}),
      }),

    liftSanction: (sanctionId, note) =>
      client.post(`/sanctions/${seg(sanctionId)}/lift`, {
        ...(note !== undefined ? { note } : {}),
      }),

    appealQueue: (filters, options) =>
      client.get("/appeals/queue", {
        query: query({
          state: filters?.state,
          before: filters?.before,
          limit: filters?.limit,
        }),
        ...signalOf(options),
      }),

    resolveAppeal: (appealId, body) =>
      client.post(`/appeals/${seg(appealId)}/resolve`, {
        outcome: body.outcome,
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.reasonCode !== undefined ? { reason_code: body.reasonCode } : {}),
      }),
  };
}
