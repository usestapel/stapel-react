import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { webhooksErrorBundleEn } from "./generated/errors.gen.js";

/**
 * webhooks-react's own translation KEYS (frontend-standard §4.2): components
 * never render literal strings — hosts resolve these through core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys.
 *
 * ── The filter grammar has thirteen keys, and that is the point ───────────
 *
 * The backend answers one code for every malformed predicate. This pair ports
 * the grammar (`model/filter.ts`) so the person authoring a JSON predicate in
 * a text area is told WHICH operator, at WHICH path, is wrong. That precision
 * only exists if the copy exists in every locale, which is why the filter keys
 * are as complete here as the screen keys.
 */
export const WEBHOOKS_I18N_KEYS = {
  unknownError: "webhooks.error.unknown",
  navWebhooks: "webhooks.nav.webhooks",

  // ── the settings page ────────────────────────────────────────────────────
  title: "webhooks.title",
  intro: "webhooks.intro",
  empty: "webhooks.empty",
  emptyHint: "webhooks.emptyHint",
  docs: "webhooks.docs",
  newSubscription: "webhooks.new",
  loading: "webhooks.loading",
  failed: "webhooks.failed",
  mandate: "webhooks.mandate",
  mandateHint: "webhooks.mandateHint",
  never: "webhooks.never",

  // ── the list ─────────────────────────────────────────────────────────────
  colEvent: "webhooks.col.event",
  colDelivery: "webhooks.col.delivery",
  colTarget: "webhooks.col.target",
  colActive: "webhooks.col.active",
  colStrikes: "webhooks.col.strikes",
  colLastDelivery: "webhooks.col.lastDelivery",
  colActions: "webhooks.col.actions",
  strikes: "webhooks.strikes",
  autoDisabled: "webhooks.autoDisabled",
  disabledAt: "webhooks.disabledAt",
  activeLabel: "webhooks.active.label",
  activeOn: "webhooks.active.on",
  activeOff: "webhooks.active.off",
  activeReactivatedNote: "webhooks.active.reactivatedNote",
  edit: "webhooks.edit",
  openLog: "webhooks.openLog",
  remove: "webhooks.remove",
  removeConfirm: "webhooks.removeConfirm",
  removeConfirmBody: "webhooks.removeConfirmBody",

  // ── the subscription sheet ───────────────────────────────────────────────
  formTitle: "webhooks.form.title",
  formEditTitle: "webhooks.form.editTitle",
  formEvent: "webhooks.form.event",
  formEventHint: "webhooks.form.eventHint",
  formEventPlaceholder: "webhooks.form.eventPlaceholder",
  formDelivery: "webhooks.form.delivery",
  formTarget: "webhooks.form.target",
  formUrl: "webhooks.form.url",
  formUrlHint: "webhooks.form.urlHint",
  formNotificationType: "webhooks.form.notificationType",
  formRecipient: "webhooks.form.recipient",
  formStream: "webhooks.form.stream",
  formPath: "webhooks.form.path",
  formTargetField: "webhooks.form.targetField",
  formFilter: "webhooks.form.filter",
  formFilterHint: "webhooks.form.filterHint",
  formDescription: "webhooks.form.description",
  formSubmit: "webhooks.form.submit",
  formSave: "webhooks.form.save",
  formNeedsEvent: "webhooks.form.needsEvent",
  formNeedsDelivery: "webhooks.form.needsDelivery",
  formNoChanges: "webhooks.form.noChanges",
  formUnknownDeliveryTarget: "webhooks.form.unknownDeliveryTarget",

  // ── delivery types ───────────────────────────────────────────────────────
  deliveryWebhook: "webhooks.delivery.webhook",
  deliveryNotification: "webhooks.delivery.notification",
  deliveryWs: "webhooks.delivery.ws",
  deliveryCustom: "webhooks.delivery.custom",
  deliveryUnknown: "webhooks.delivery.unknown",

  // ── target problems ──────────────────────────────────────────────────────
  targetMissing: "webhooks.target.missing",
  targetNoRecipient: "webhooks.target.noRecipient",
  targetInsecure: "webhooks.target.insecure",

  // ── filter grammar problems ──────────────────────────────────────────────
  filterNotJson: "webhooks.filter.notJson",
  filterNotObject: "webhooks.filter.notObject",
  filterTooDeep: "webhooks.filter.tooDeep",
  filterBadKey: "webhooks.filter.badKey",
  filterBadPath: "webhooks.filter.badPath",
  filterUnknownGroupOp: "webhooks.filter.unknownGroupOp",
  filterGroupNeedsList: "webhooks.filter.groupNeedsList",
  filterEmptyMatcher: "webhooks.filter.emptyMatcher",
  filterUnknownFieldOp: "webhooks.filter.unknownFieldOp",
  filterOpNeedsList: "webhooks.filter.opNeedsList",
  filterOpNeedsBoolean: "webhooks.filter.opNeedsBoolean",
  filterOpNeedsString: "webhooks.filter.opNeedsString",
  filterOpNeedsNumber: "webhooks.filter.opNeedsNumber",
  filterValid: "webhooks.filter.valid",

  // ── the secret ───────────────────────────────────────────────────────────
  secretTitle: "webhooks.secret.title",
  secretShownOnce: "webhooks.secret.shownOnce",
  secretCopy: "webhooks.secret.copy",
  secretCopied: "webhooks.secret.copied",
  secretAck: "webhooks.secret.ack",
  secretClose: "webhooks.secret.close",
  secretDocs: "webhooks.secret.docs",
  secretRotate: "webhooks.secret.rotate",
  secretRotateConfirm: "webhooks.secret.rotateConfirm",
  secretRotateConfirmBody: "webhooks.secret.rotateConfirmBody",
  secretRotateUnsigned: "webhooks.secret.rotateUnsigned",
  secretRotateUnsaved: "webhooks.secret.rotateUnsaved",
  secretPresent: "webhooks.secret.present",
  secretAbsent: "webhooks.secret.absent",

  // ── the delivery log ─────────────────────────────────────────────────────
  logTitle: "webhooks.log.title",
  logEmpty: "webhooks.log.empty",
  logEmptyHint: "webhooks.log.emptyHint",
  logRetention: "webhooks.log.retention",
  logStatus: "webhooks.log.status",
  logStatusPending: "webhooks.log.status.pending",
  logStatusRetrying: "webhooks.log.status.retrying",
  logStatusSucceeded: "webhooks.log.status.succeeded",
  logStatusDead: "webhooks.log.status.dead",
  logStatusUnknown: "webhooks.log.status.unknown",
  logStatusAll: "webhooks.log.status.all",
  logAttempts: "webhooks.log.attempts",
  logResponse: "webhooks.log.response",
  logError: "webhooks.log.error",
  logNext: "webhooks.log.next",
  logLast: "webhooks.log.last",
  logReplay: "webhooks.log.replay",
  logReplayOnlyDead: "webhooks.log.replayOnlyDead",
  logReplayed: "webhooks.log.replayed",
  logPayload: "webhooks.log.payload",
  logPolling: "webhooks.log.polling",
  logOpenDetail: "webhooks.log.openDetail",

  // ── the delivery detail sheet ────────────────────────────────────────────
  detailTitle: "webhooks.detail.title",
  detailEnvelope: "webhooks.detail.envelope",
  detailHeaders: "webhooks.detail.headers",
  detailReconstructed: "webhooks.detail.reconstructed",
  detailResponse: "webhooks.detail.response",
  detailNoResponse: "webhooks.detail.noResponse",
  detailLastError: "webhooks.detail.lastError",

  dialogDismiss: "webhooks.dialog.dismiss",
} as const;

export type WebhooksI18nKey =
  (typeof WEBHOOKS_I18N_KEYS)[keyof typeof WEBHOOKS_I18N_KEYS];

/**
 * English fallback bundle for webhooks-react UI keys + backend error codes.
 * The generated `webhooksErrorBundleEn` (from stapel-webhooks's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key.
 */
export const webhooksI18nBundleEn: I18nDictionary = {
  ...webhooksErrorBundleEn,

  "webhooks.error.unknown": "Something went wrong. Please try again.",
  "webhooks.nav.webhooks": "Webhooks",

  "webhooks.title": "Webhooks",
  "webhooks.intro":
    "Send events from this workspace to your own systems, as they happen.",
  "webhooks.empty": "No webhooks yet",
  "webhooks.emptyHint":
    "A webhook posts an event to a URL you own the moment it happens — a new listing, a completed booking — so your systems react without polling ours.",
  "webhooks.docs": "How to receive and verify events",
  "webhooks.new": "New webhook",
  "webhooks.loading": "Loading webhooks…",
  "webhooks.failed": "We could not load your webhooks.",
  "webhooks.mandate": "We could not check your workspace access",
  "webhooks.mandateHint":
    "This is on our side, not yours — nothing is misconfigured. Try again in a moment.",
  "webhooks.never": "—",

  "webhooks.col.event": "Event",
  "webhooks.col.delivery": "Delivery",
  "webhooks.col.target": "Destination",
  "webhooks.col.active": "Active",
  "webhooks.col.strikes": "Failures",
  "webhooks.col.lastDelivery": "Last delivery",
  "webhooks.col.actions": "Actions",
  "webhooks.strikes": "{count} in a row",
  "webhooks.autoDisabled":
    "Switched off automatically after repeated failed deliveries.",
  "webhooks.disabledAt": "Switched off on {date}",
  "webhooks.active.label": "Active",
  "webhooks.active.on": "Receiving events",
  "webhooks.active.off": "Not receiving events",
  "webhooks.active.reactivatedNote":
    "Turning it back on clears the failure count, so it gets the full run of retries again.",
  "webhooks.edit": "Edit",
  "webhooks.openLog": "Deliveries",
  "webhooks.remove": "Delete",
  "webhooks.removeConfirm": "Delete this webhook?",
  "webhooks.removeConfirmBody":
    "Its delivery history goes with it, including any dead letters you have not replayed. This cannot be undone.",

  "webhooks.form.title": "New webhook",
  "webhooks.form.editTitle": "Edit webhook",
  "webhooks.form.event": "Event",
  "webhooks.form.eventHint":
    "Only events the modules installed here actually emit are listed.",
  "webhooks.form.eventPlaceholder": "Pick an event",
  "webhooks.form.delivery": "Delivery",
  "webhooks.form.target": "Destination",
  "webhooks.form.url": "URL",
  "webhooks.form.urlHint": "Must be https — we will not post events over http.",
  "webhooks.form.notificationType": "Notification type",
  "webhooks.form.recipient": "Recipient",
  "webhooks.form.stream": "Stream",
  "webhooks.form.path": "Handler path",
  "webhooks.form.targetField": "{field}",
  "webhooks.form.filter": "Filter (optional)",
  "webhooks.form.filterHint":
    "A JSON predicate over the event payload. Leave it empty to receive every event of this type.",
  "webhooks.form.description": "Description",
  "webhooks.form.submit": "Create webhook",
  "webhooks.form.save": "Save changes",
  "webhooks.form.needsEvent": "Pick the event this webhook reacts to.",
  "webhooks.form.needsDelivery": "Pick how this event should be delivered.",
  "webhooks.form.noChanges": "Nothing has changed yet.",
  "webhooks.form.unknownDeliveryTarget":
    "This delivery type was added by this deployment, so its destination is edited as raw JSON.",

  "webhooks.delivery.webhook": "HTTPS request",
  "webhooks.delivery.notification": "Notification",
  "webhooks.delivery.ws": "Live stream",
  "webhooks.delivery.custom": "In-app handler",
  "webhooks.delivery.unknown": "{delivery}",

  "webhooks.target.missing": "{field} is required for this delivery type.",
  "webhooks.target.noRecipient":
    "Give a recipient: a user, an email address, a phone number or a Telegram chat.",
  "webhooks.target.insecure":
    "The URL must start with https:// — events are never posted over http.",

  "webhooks.filter.notJson": "This is not valid JSON: {detail}",
  "webhooks.filter.notObject": "A filter must be a JSON object.",
  "webhooks.filter.tooDeep": "Filters may nest at most {limit} levels deep.",
  "webhooks.filter.badKey": "A filter key must be a non-empty string.",
  "webhooks.filter.badPath": "“{path}” is not a valid payload path.",
  "webhooks.filter.unknownGroupOp":
    "“{op}” is not a grouping operator. Use $or, $and or $not.",
  "webhooks.filter.groupNeedsList": "{op} takes a non-empty list of filters.",
  "webhooks.filter.emptyMatcher": "“{path}” has an empty condition.",
  "webhooks.filter.unknownFieldOp": "“{path}”: {op} is not an operator we run.",
  "webhooks.filter.opNeedsList": "“{path}”: {op} takes a list of values.",
  "webhooks.filter.opNeedsBoolean": "“{path}”: {op} takes true or false.",
  "webhooks.filter.opNeedsString": "“{path}”: {op} takes text.",
  "webhooks.filter.opNeedsNumber": "“{path}”: {op} takes a number.",
  "webhooks.filter.valid": "Filter looks good.",

  "webhooks.secret.title": "Signing secret",
  "webhooks.secret.shownOnce":
    "This is the only time this secret is shown. Store it now — we keep only a hash and cannot show it again.",
  "webhooks.secret.copy": "Copy the signing secret",
  "webhooks.secret.copied": "Copied",
  "webhooks.secret.ack": "I have saved this secret",
  "webhooks.secret.close": "Done",
  "webhooks.secret.docs": "How to verify the signature",
  "webhooks.secret.rotate": "Rotate secret",
  "webhooks.secret.rotateConfirm": "Rotate the signing secret?",
  "webhooks.secret.rotateConfirmBody":
    "The old secret stops working immediately — there is no overlap. Every delivery is rejected until your receiver is updated with the new one, and enough rejections switch this webhook off.",
  "webhooks.secret.rotateUnsigned":
    "{delivery} deliveries are not signed, so there is no secret to rotate.",
  "webhooks.secret.rotateUnsaved": "Create the webhook first.",
  "webhooks.secret.present": "A signing secret is set.",
  "webhooks.secret.absent": "No signing secret.",

  "webhooks.log.title": "Deliveries",
  "webhooks.log.empty": "Nothing delivered yet",
  "webhooks.log.emptyHint":
    "Attempts appear here as soon as an event matches this webhook.",
  "webhooks.log.retention":
    "Successful deliveries are kept for {succeededDays} days, dead letters for {deadDays}.",
  "webhooks.log.status": "Status",
  "webhooks.log.status.pending": "Queued",
  "webhooks.log.status.retrying": "Retrying",
  "webhooks.log.status.succeeded": "Delivered",
  "webhooks.log.status.dead": "Dead letter",
  "webhooks.log.status.unknown": "Unknown ({status})",
  "webhooks.log.status.all": "Every status",
  "webhooks.log.attempts": "Attempts",
  "webhooks.log.response": "Response",
  "webhooks.log.error": "Error",
  "webhooks.log.next": "Next attempt",
  "webhooks.log.last": "Last attempt",
  "webhooks.log.replay": "Replay",
  "webhooks.log.replayOnlyDead":
    "Only a dead letter can be replayed — this one is {status}.",
  "webhooks.log.replayed": "Queued again, from the first attempt.",
  "webhooks.log.payload": "Payload",
  "webhooks.log.polling": "Checking for updates…",
  "webhooks.log.openDetail": "Open this delivery",

  "webhooks.detail.title": "Delivery",
  "webhooks.detail.envelope": "Envelope",
  "webhooks.detail.headers": "Headers",
  "webhooks.detail.reconstructed":
    "Rebuilt from the stored event — this is what a replay would send, not a recording of the original request.",
  "webhooks.detail.response": "Response status",
  "webhooks.detail.noResponse": "No response was received.",
  "webhooks.detail.lastError": "Last error",

  "webhooks.dialog.dismiss": "Close",
};

/**
 * Register webhooks-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerWebhooksI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, webhooksI18nBundleEn);
}
