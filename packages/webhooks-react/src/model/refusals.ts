/**
 * The refusals this pair has to tell apart, and the reason every one of them
 * is read by CODE and never by status.
 *
 * | status | code                            | what it actually means                |
 * |--------|---------------------------------|---------------------------------------|
 * | 400    | `webhooks_unknown_event`        | no installed module emits that event  |
 * | 400    | `webhooks_unknown_delivery`     | that delivery type is not registered  |
 * | 400    | `webhooks_invalid_target`       | the target does not fit the type      |
 * | 400    | `webhooks_insecure_target`      | a webhook target must be **https**    |
 * | 400    | `webhooks_invalid_filter`       | the predicate is not evaluable        |
 * | 400    | `webhooks_not_signed_type`      | this type has no secret to rotate     |
 * | 403    | `webhooks_forbidden`            | not your subscription                 |
 * | 404    | `webhooks_subscription_not_found` | no such rule                        |
 * | 404    | `webhooks_delivery_not_found`   | no such delivery                      |
 * | 409    | `webhooks_not_replayable`       | only a DEAD letter can be replayed    |
 * | 409    | `webhooks_subscription_cap`     | you are at the per-owner maximum      |
 * | 503    | `mandate_unavailable`           | we could not CHECK your workspace     |
 *
 * Three of the 400s share a status and want three different sentences on the
 * same form: `insecure_target` is fixed by typing `https`, `invalid_target` by
 * filling a different field, `unknown_event` by picking from the catalogue. A
 * screen that branched on `400` would say "validation error" to all three.
 *
 * ── The 503 is the one this module could not have had before ──────────────
 *
 * Every route is `HasWorkspaceMandateIfScoped` (`views.py` — MODULE.md claimed
 * `IsNotAnonymousUser` until backend 0.1.1, BACKEND-GAP W-9). In a tenant
 * deployment that gate answers **503 `error.503.mandate_unavailable`** when the
 * mandate source is unreachable: the request was fine, the person has done
 * nothing wrong, and the answer is "we cannot check right now — try again",
 * not "you may not". {@link isMandateUnavailable} is why every screen in this
 * pair can say that instead of drawing a red operations failure over a
 * developer-settings tab.
 */
import { isErrorCode, toFlowError } from "@stapel/core";
import type { FlowError } from "@stapel/core";

// ── writing a rule ──────────────────────────────────────────────────────────
/** No installed module emits this event. Carries `{event_type}`. A **400**. */
export const WEBHOOKS_ERROR_UNKNOWN_EVENT = "error.400.webhooks_unknown_event";
/** The delivery type is outside the effective registry. `{delivery}`. **400**. */
export const WEBHOOKS_ERROR_UNKNOWN_DELIVERY =
  "error.400.webhooks_unknown_delivery";
/** The target lacks a key this delivery type requires. A **400**. */
export const WEBHOOKS_ERROR_INVALID_TARGET = "error.400.webhooks_invalid_target";
/** A webhook target that is not https — the SSRF/plaintext guard. A **400**. */
export const WEBHOOKS_ERROR_INSECURE_TARGET =
  "error.400.webhooks_insecure_target";
/** The predicate is not one this module will evaluate. A **400**. */
export const WEBHOOKS_ERROR_INVALID_FILTER = "error.400.webhooks_invalid_filter";
/** This delivery carries no signature, so it has no secret to rotate. **400**. */
export const WEBHOOKS_ERROR_NOT_SIGNED_TYPE =
  "error.400.webhooks_not_signed_type";
/** You already have the maximum number of subscriptions. A **409**. */
export const WEBHOOKS_ERROR_SUBSCRIPTION_CAP =
  "error.409.webhooks_subscription_cap";

// ── reading and replaying ───────────────────────────────────────────────────
/** Somebody else's subscription. A **403**. */
export const WEBHOOKS_ERROR_FORBIDDEN = "error.403.webhooks_forbidden";
/** No rule with that id. A **404**. */
export const WEBHOOKS_ERROR_SUBSCRIPTION_NOT_FOUND =
  "error.404.webhooks_subscription_not_found";
/** No delivery with that id. A **404**. */
export const WEBHOOKS_ERROR_DELIVERY_NOT_FOUND =
  "error.404.webhooks_delivery_not_found";
/** Only a dead-lettered delivery can be replayed. A **409**. */
export const WEBHOOKS_ERROR_NOT_REPLAYABLE = "error.409.webhooks_not_replayable";

// ── the deployment, not the person ──────────────────────────────────────────
/**
 * The workspace mandate could not be verified. Core's cross-cutting key,
 * raised here by `HasWorkspaceMandateIfScoped` on **every** route of this
 * module — so it is the one refusal that can arrive in place of any answer.
 */
export const WEBHOOKS_ERROR_MANDATE_UNAVAILABLE =
  "error.503.mandate_unavailable";

/** Fold any thrown value into this pair's error dialect. */
export function toWebhooksError(error: unknown): FlowError {
  return toFlowError(error, "webhooks.error.unknown");
}

const is = (error: unknown, code: string): boolean =>
  isErrorCode(toWebhooksError(error), code);

/** No installed module emits the chosen event. */
export function isUnknownEvent(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_UNKNOWN_EVENT);
}

/** The delivery type is not registered on this deployment. */
export function isUnknownDelivery(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_UNKNOWN_DELIVERY);
}

/** The target does not fit the delivery type — a FIELD problem. */
export function isInvalidTarget(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_INVALID_TARGET);
}

/**
 * The webhook target is not https.
 *
 * Distinct from {@link isInvalidTarget} — same status, different fix: the URL
 * is present and well-formed, it is the SCHEME that is refused, and telling
 * somebody their target is "invalid" when the answer is "type https" is how a
 * form gets abandoned.
 */
export function isInsecureTarget(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_INSECURE_TARGET);
}

/** The backend refused the predicate. The client validates first; this is
 * the answer for a grammar the client's copy of the rules did not catch. */
export function isInvalidFilter(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_INVALID_FILTER);
}

/** Rotation asked of a delivery type that is never signed. */
export function isNotSignedType(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_NOT_SIGNED_TYPE);
}

/** At the per-owner ceiling. Nothing to retry — something must be removed. */
export function isSubscriptionCap(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_SUBSCRIPTION_CAP);
}

/** Not your subscription. */
export function isWebhooksForbidden(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_FORBIDDEN);
}

/** No rule with that id (it may have been removed in another tab). */
export function isSubscriptionNotFound(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_SUBSCRIPTION_NOT_FOUND);
}

/** No delivery with that id — retention may already have swept it. */
export function isDeliveryNotFound(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_DELIVERY_NOT_FOUND);
}

/** The row moved out of `dead` between the render and the click. */
export function isNotReplayable(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_NOT_REPLAYABLE);
}

/**
 * "We could not check your workspace access right now."
 *
 * The named refusal for the 503 every route of this module can answer. It is
 * NOT a permission failure and NOT a bug in the request: rendered as either,
 * it tells a developer their integration settings are broken when the truth is
 * that a mandate source blinked.
 */
export function isMandateUnavailable(error: unknown): boolean {
  return is(error, WEBHOOKS_ERROR_MANDATE_UNAVAILABLE);
}
