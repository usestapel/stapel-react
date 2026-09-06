/**
 * Wire types for the stapel-moderation HTTP contract — **derived from the
 * generated OpenAPI surface** (frontend-standard §2/§3), never hand-maintained.
 * The single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-moderation's OWN `docs/schema.json`).
 *
 * ── Two documented corrections, and one that is no longer needed ───────────
 *
 * 1. **The vocabularies.** Every `state` / `decision` / `kind` / `source` is a
 *    Django `TextChoices` on the backend and a bare `CharField` in DRF, so the
 *    schema types them `string`. The presenter aliases below re-type exactly
 *    those fields against `api/enums.ts`, which is pinned to `models.py` by
 *    `test/contract.test.ts`. Widening back to `string` would let a console ship
 *    with `"needs-review"` in a radio group and compile.
 * 2. **`policy.reasons` / `policy.rules`** are `{[k: string]: unknown}[]` in
 *    the schema (drf-spectacular cannot see inside a dict built in a service).
 *    `services.policy_disclosure` (services.py:1373-1437) builds them field by
 *    field, so the shapes are known and are declared here.
 *
 * NOT needed any more: the `content` graft. Backend 0.3.0 made `content` a
 * declared field of `CaseDetailPresenterDTO` with a real `ContentDTO`
 * component, so the case card is typed from the contract like anything else —
 * the hand-written `CaseDetail & { content: ContentDTO }` this pair was
 * specced to carry is gone before it was ever written.
 */
import type { components } from "./generated/schema.js";
import type {
  AppealState,
  CaseEventKind,
  CaseOrigin,
  CaseState,
  Decision,
  ErrorClass,
  SanctionKind,
  SanctionState,
  VerdictSource,
} from "./enums.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/**
 * One queue row.
 *
 * Since backend 0.7.0 the row also carries the dead-letter stamps — `dlq_at`,
 * `last_error_class`, `last_error`, `escalated_at` — precisely so the DLQ tab
 * can group and sort without opening every card.
 */
export type Case = Omit<
  Schemas["CasePresenterDTO"],
  "state" | "origin" | "last_decision" | "last_error_class"
> & {
  readonly state: CaseState;
  readonly origin: CaseOrigin;
  /** `""` until a verdict exists — the backend defaults it to the empty
   * string rather than omitting it, and an empty string is not a decision. */
  readonly last_decision?: Decision | "";
  /** `""` on every case that never failed a screening. `services.error_class_of`
   * clamps the wire value to {@link ErrorClass}, which is what makes it safe to
   * group a tab by and to label a metric with. */
  readonly last_error_class?: ErrorClass | "";
};

/** One complaint, as a moderator sees it. */
export type Report = Schemas["ReportPresenterDTO"];

/** One append-only decision. */
export type Verdict = Omit<
  Schemas["VerdictPresenterDTO"],
  "decision" | "source"
> & {
  readonly decision: Decision;
  readonly source: VerdictSource;
};

/** One account-level consequence. */
export type Sanction = Omit<Schemas["SanctionPresenterDTO"], "kind" | "state"> & {
  readonly kind: SanctionKind;
  readonly state: SanctionState;
};

/** One appeal (DSA Art. 20). */
export type Appeal = Omit<Schemas["AppealPresenterDTO"], "state"> & {
  readonly state: AppealState;
};

/** One audit row. `actor_id: null` means the system acted. */
export type CaseEvent = Omit<
  Schemas["CaseEventPresenterDTO"],
  "kind" | "from_state" | "to_state"
> & {
  readonly kind: CaseEventKind;
  /** `""` on the row that created the case — there was no previous state. */
  readonly from_state: CaseState | "";
  readonly to_state: CaseState | "";
};

/**
 * The target's live content, read at the moment the card was opened.
 *
 * `available: false` is a RENDERED state carrying `error`, not a failed
 * request: a moderator must never be handed an empty card that looks like
 * empty content (`ContentDTO`, backend 0.3.0).
 */
export type Content = Schemas["ContentDTO"];

/**
 * The whole case card.
 *
 * Since backend 0.7.2 the card carries the same dead-letter stamps as the queue
 * row — `dlq_at`, `last_error_class`, `last_error`, `escalated_at` — so a case
 * reached by a deep link, with no row behind it, can say what broke without
 * reading its own audit trail for it.
 */
export type CaseDetail = Omit<
  Schemas["CaseDetailPresenterDTO"],
  | "state"
  | "origin"
  | "last_error_class"
  | "reports"
  | "verdicts"
  | "sanctions"
  | "appeals"
  | "content"
> & {
  readonly state: CaseState;
  readonly origin: CaseOrigin;
  /** Same closed vocabulary, same clamp (`services.error_class_of`) and same
   * `""` default as {@link Case.last_error_class} — one field, two presenters. */
  readonly last_error_class?: ErrorClass | "";
  readonly reports: readonly Report[];
  readonly verdicts: readonly Verdict[];
  readonly sanctions: readonly Sanction[];
  readonly appeals: readonly Appeal[];
  readonly content: Content;
};

/** The answer to an accepted complaint. `case_ref` is a short quotable prefix,
 * deliberately not the case id (the reporter may not read the case). */
export type ReportResult = Schemas["ReportResultDTO"];

/** The 202 answer to a rescan: the case is back in `screening`. */
export type RescanResult = Schemas["RescanResultDTO"];

/** Queue counters for the console header (DSA Art. 24(1)). */
export type Stats = Schemas["StatsDTO"];

/**
 * One reason in the public policy disclosure.
 *
 * `label_key` and `description_key` are i18n KEYS the backend hands out
 * (`registry.py:291-294`, defaulting to `moderation.reason.<code>.label` /
 * `.description`) — this pair ships the texts for the built-in eleven and the
 * three system reasons, and a deployment's own reason is a key its own bundle
 * answers.
 */
export interface PolicyReason {
  readonly code: string;
  readonly severity: number;
  readonly requires_description: boolean;
  readonly label_key: string;
  readonly description_key: string;
  /** The terms-of-use clause quoted in the statement of reasons (Art. 17(3)).
   * `""` until the product writes one. */
  readonly policy_clause: string;
}

/** One deterministic screening rule, as disclosed. */
export interface PolicyRule {
  readonly code: string;
  readonly decision: string;
  readonly severity: number;
  readonly description_key: string;
}

/** What the deployment's automation actually does (Art. 15(1)(e)). */
export interface PolicyAutomatedMeans {
  readonly enabled: boolean;
  readonly stages: readonly string[];
  readonly model_size: string;
  readonly confidence_floor: number;
  /** What happens when the screener cannot answer — `"hold"` by default. */
  readonly on_unavailable: string;
}

/** The human-review claims, computed rather than asserted. */
export interface PolicyHumanReview {
  readonly always_available: boolean;
  /** Seconds after which a stale queued case is auto-resolved, or `null`
   * when the host set no number (the honest default: nothing expires). */
  readonly auto_resolve_after_seconds: number | null;
  readonly appeal_requires_different_actor: boolean;
}

/** `GET policy` — the DSA Art. 15 disclosure, the module's only public route. */
export interface PolicyDisclosure {
  readonly lang: string;
  readonly reasons: readonly PolicyReason[];
  readonly rules: readonly PolicyRule[];
  readonly automated_means: PolicyAutomatedMeans;
  readonly human_review: PolicyHumanReview;
}
