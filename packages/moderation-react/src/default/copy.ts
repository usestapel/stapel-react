/**
 * Refusal → sentence. One table, so the same 409 cannot mean one thing in the
 * sheet and another in the console.
 *
 * Every function here answers `undefined` for anything it does not RECOGNISE,
 * and the caller then renders `<ErrorAlert thrown={error}/>` — the shared
 * substrate folds the envelope through core's dialect and shows the backend's
 * own translated sentence. That is the important half of the contract: an
 * unnamed refusal must degrade to the server's words, never to this pair's
 * guess about what went wrong.
 */
import { useI18n, useT } from "@stapel/core";
import {
  MODERATION_I18N_KEYS,
  reasonDescriptionKey,
  reasonLabelKey,
  ruleDescriptionKey,
} from "../i18n/keys.js";
import {
  isAlreadyAppealed,
  isAlreadyReported,
  isAppealAlreadyDecided,
  isCannotReport,
  isCaseNotResolved,
  isCaseResolved,
  isClaimedByAnother,
  isDescriptionRequired,
  isEvidenceInvalid,
  isNotAppellant,
  isNotClaimant,
  isOwnContent,
  isReasonNotApplicable,
  isSameActor,
  isStepUp,
  isTargetNotFound,
  isThrottled,
  isUnknownTargetType,
} from "../model/refusals.js";

/** The report intake's named refusals. */
export function reportRefusalKey(error: unknown): string | undefined {
  if (isOwnContent(error)) return MODERATION_I18N_KEYS.reportOwnContent;
  if (isAlreadyReported(error)) return MODERATION_I18N_KEYS.reportAlreadyReported;
  if (isCannotReport(error)) return MODERATION_I18N_KEYS.reportCannotReport;
  if (isTargetNotFound(error)) return MODERATION_I18N_KEYS.reportTargetGone;
  if (isThrottled(error)) return MODERATION_I18N_KEYS.reportThrottled;
  if (isDescriptionRequired(error)) {
    return MODERATION_I18N_KEYS.reportDescriptionRequired;
  }
  if (isReasonNotApplicable(error)) return MODERATION_I18N_KEYS.reportReasonStale;
  if (isUnknownTargetType(error)) {
    return MODERATION_I18N_KEYS.reportUnknownTargetType;
  }
  if (isEvidenceInvalid(error)) return MODERATION_I18N_KEYS.reportEvidenceInvalid;
  return undefined;
}

/** The appellant's side. */
export function appealRefusalKey(error: unknown): string | undefined {
  if (isAlreadyAppealed(error)) return MODERATION_I18N_KEYS.appealAlreadyAppealed;
  if (isCaseNotResolved(error)) return MODERATION_I18N_KEYS.appealCaseNotResolved;
  if (isNotAppellant(error)) return MODERATION_I18N_KEYS.appealNotAppellant;
  return undefined;
}

/** The console's triage refusals. */
export function caseRefusalKey(error: unknown): string | undefined {
  if (isStepUp(error)) return MODERATION_I18N_KEYS.stepUpNeeded;
  if (isClaimedByAnother(error)) return MODERATION_I18N_KEYS.caseClaimedByAnother;
  if (isNotClaimant(error)) return MODERATION_I18N_KEYS.caseNotClaimant;
  if (isCaseResolved(error)) return MODERATION_I18N_KEYS.caseBlockedResolved;
  return undefined;
}

/** The appeal queue's two, which share a screen and mean opposite things. */
export function appealResolveRefusalKey(error: unknown): string | undefined {
  if (isSameActor(error)) return MODERATION_I18N_KEYS.appealQueueSameActor;
  if (isAppealAlreadyDecided(error)) {
    return MODERATION_I18N_KEYS.appealQueueAlreadyDecided;
  }
  if (isStepUp(error)) return MODERATION_I18N_KEYS.stepUpNeeded;
  return undefined;
}

// ── deployment-defined vocabulary ──────────────────────────────────────────
//
// A reason code is NOT a closed enum. `registry.py` lets a deployment add,
// override or remove reasons at runtime and hands the client an i18n KEY for
// each (`label_key` / `description_key`, defaulting to
// `moderation.reason.<code>.label`). This pair ships copy for the eleven
// built-ins and the three system reasons and cannot ship copy for somebody
// else's. So the lookup is a CHAIN — the backend's key, then the pair's own
// default shape, then the raw code — and it stops at the first key the bundle
// actually answers. Falling through to `t(key)` regardless would print
// `moderation.reason.crypto_shill.label` on a moderator's screen, which is the
// raw-key defect the i18n discipline exists to prevent; the code is at least a
// word a person can act on.

/** Resolve a data-supplied i18n key, or fall back. See the note above. */
export interface PolicyText {
  readonly reasonLabel: (reason: {
    readonly code: string;
    readonly label_key?: string;
  }) => string;
  readonly reasonDescription: (reason: {
    readonly code: string;
    readonly description_key?: string;
  }) => string;
  readonly ruleDescription: (rule: {
    readonly code: string;
    readonly description_key?: string;
  }) => string;
}

export function usePolicyText(): PolicyText {
  const engine = useI18n();
  const t = useT();
  const known = (key: string): boolean =>
    key !== "" &&
    Object.prototype.hasOwnProperty.call(engine.getBundle(), key);
  const chain = (given: string | undefined, own: string, code: string): string => {
    if (given !== undefined && known(given)) return t(given);
    if (known(own)) return t(own);
    return code;
  };
  return {
    reasonLabel: (reason) =>
      chain(reason.label_key, reasonLabelKey(reason.code), reason.code),
    reasonDescription: (reason) =>
      chain(
        reason.description_key,
        reasonDescriptionKey(reason.code),
        reason.code
      ),
    ruleDescription: (rule) =>
      chain(rule.description_key, ruleDescriptionKey(rule.code), rule.code),
  };
}
