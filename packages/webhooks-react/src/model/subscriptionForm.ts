import { useCallback, useMemo, useState } from "react";
import { actionAvailable, actionBlocked, firstBlock } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { DeliveryTarget, Subscription } from "../api/types.js";
import type { CreateSubscriptionBody } from "../api/webhooksApi.js";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";
import {
  DELIVERY_WEBHOOK,
  targetKeysFor,
  validateTarget,
} from "./deliveryTypes.js";
import type { TargetProblem } from "./deliveryTypes.js";
import { validateFilterText } from "./filter.js";
import type { FilterMessageKeys, FilterProblem } from "./filter.js";
import { formatJson } from "./format.js";

/** The i18n keys the filter validator reports through, bound once. */
export const FILTER_MESSAGE_KEYS: FilterMessageKeys = {
  notJson: WEBHOOKS_I18N_KEYS.filterNotJson,
  notObject: WEBHOOKS_I18N_KEYS.filterNotObject,
  tooDeep: WEBHOOKS_I18N_KEYS.filterTooDeep,
  badKey: WEBHOOKS_I18N_KEYS.filterBadKey,
  badPath: WEBHOOKS_I18N_KEYS.filterBadPath,
  unknownGroupOp: WEBHOOKS_I18N_KEYS.filterUnknownGroupOp,
  groupNeedsList: WEBHOOKS_I18N_KEYS.filterGroupNeedsList,
  emptyMatcher: WEBHOOKS_I18N_KEYS.filterEmptyMatcher,
  unknownFieldOp: WEBHOOKS_I18N_KEYS.filterUnknownFieldOp,
  opNeedsList: WEBHOOKS_I18N_KEYS.filterOpNeedsList,
  opNeedsBoolean: WEBHOOKS_I18N_KEYS.filterOpNeedsBoolean,
  opNeedsString: WEBHOOKS_I18N_KEYS.filterOpNeedsString,
  opNeedsNumber: WEBHOOKS_I18N_KEYS.filterOpNeedsNumber,
};

/** The target keys this delivery type wants, and what is wrong with them. */
export interface SubscriptionFormFields {
  readonly eventType: string;
  readonly delivery: string;
  readonly target: DeliveryTarget;
  readonly filterText: string;
  readonly description: string;
}

/** What {@link useSubscriptionForm} reports. */
export interface SubscriptionFormBag {
  readonly fields: SubscriptionFormFields;
  /** The target field names to draw, in the order the backend needs them. */
  readonly targetKeys: readonly string[];
  readonly setEventType: (event: string) => void;
  /** Switching delivery type CLEARS the target — see the note below. */
  readonly setDelivery: (delivery: string) => void;
  readonly setTargetField: (key: string, value: string) => void;
  readonly setFilterText: (text: string) => void;
  readonly setDescription: (description: string) => void;
  /** The filter's first problem, live, or `undefined` while it parses. */
  readonly filterProblem: FilterProblem | undefined;
  /** The target's first problem, live. */
  readonly targetProblem: TargetProblem | undefined;
  /** Available only when every half of the rule is answerable. */
  readonly submit: ActionAvailability;
  /** The create body — `undefined` unless {@link submit} is available. */
  readonly body: CreateSubscriptionBody | undefined;
  /** The PATCH body for an edit — only the fields that changed. */
  readonly patch: Record<string, unknown>;
  readonly reset: () => void;
}

const EMPTY_TARGET: DeliveryTarget = {};

function initialFields(initial?: Subscription): SubscriptionFormFields {
  return {
    eventType: initial?.event_type ?? "",
    delivery: initial?.delivery ?? DELIVERY_WEBHOOK,
    target: initial?.target ?? EMPTY_TARGET,
    filterText:
      initial === undefined || Object.keys(initial.filter).length === 0
        ? ""
        : formatJson(initial.filter),
    description: initial?.description ?? "",
  };
}

/**
 * The subscription form's state machine — the client half of `subscribeFlow`.
 *
 * ── Every refusal this can prevent, it prevents ───────────────────────────
 *
 * Four of the backend's six create refusals are decidable in the browser:
 * a target missing a required key (`invalid_target`), a webhook target that is
 * not https (`insecure_target`), a predicate outside the grammar
 * (`invalid_filter`), and an unnamed event (`unknown_event`, decidable against
 * the catalogue the picker already read). Each one is a round trip that ends
 * in a sentence with no position in it, so each one is answered beside the
 * field instead. The two that are NOT decidable here — the per-owner cap and a
 * delivery type a host removed at runtime — arrive as refusals and are named
 * by `model/refusals.ts`.
 *
 * ── Changing the delivery type clears the target ──────────────────────────
 *
 * `{url}` and `{notification_type, email}` are not the same shape and share no
 * key. Carrying values across the switch would leave a `url` in the body of a
 * `ws` subscription — accepted by nothing, and invisible in a form that has
 * stopped drawing that field. So the switch resets it, which is the one
 * destructive thing this form does and the only one a person expects.
 */
export function useSubscriptionForm(
  initial?: Subscription
): SubscriptionFormBag {
  const [fields, setFields] = useState<SubscriptionFormFields>(() =>
    initialFields(initial)
  );

  const targetKeys = useMemo(
    () => targetKeysFor(fields.delivery),
    [fields.delivery]
  );

  const filterResult = useMemo(
    () => validateFilterText(fields.filterText, FILTER_MESSAGE_KEYS),
    [fields.filterText]
  );

  const targetProblem = useMemo(
    () =>
      validateTarget(fields.delivery, fields.target, {
        missing: WEBHOOKS_I18N_KEYS.targetMissing,
        recipient: WEBHOOKS_I18N_KEYS.targetNoRecipient,
        insecure: WEBHOOKS_I18N_KEYS.targetInsecure,
      }),
    [fields.delivery, fields.target]
  );

  const filterProblem = filterResult.ok ? undefined : filterResult.problem;

  const submit = firstBlock(
    fields.eventType.trim().length === 0
      ? actionBlocked(WEBHOOKS_I18N_KEYS.formNeedsEvent)
      : actionAvailable(),
    fields.delivery.trim().length === 0
      ? actionBlocked(WEBHOOKS_I18N_KEYS.formNeedsDelivery)
      : actionAvailable(),
    targetProblem !== undefined
      ? actionBlocked(targetProblem.code, targetProblem.params)
      : actionAvailable(),
    filterProblem !== undefined
      ? actionBlocked(filterProblem.code, filterProblem.params)
      : actionAvailable()
  );

  const filterValue = filterResult.ok ? filterResult.value : undefined;

  const body: CreateSubscriptionBody | undefined = submit.available
    ? {
        eventType: fields.eventType,
        delivery: fields.delivery,
        target: fields.target,
        ...(filterValue !== undefined ? { filter: filterValue } : {}),
        ...(fields.description.trim().length > 0
          ? { description: fields.description }
          : {}),
      }
    : undefined;

  // An edit sends only what MOVED. A PATCH carrying every field would write
  // the values already on the row — an edit in the audit trail that edited
  // nothing, and a `target` overwrite racing another tab's change.
  const patch = useMemo<Record<string, unknown>>(() => {
    if (initial === undefined) return {};
    const out: Record<string, unknown> = {};
    if (fields.eventType !== initial.event_type) out["event_type"] = fields.eventType;
    if (fields.delivery !== initial.delivery) out["delivery"] = fields.delivery;
    if (formatJson(fields.target) !== formatJson(initial.target)) {
      out["target"] = fields.target;
    }
    if (filterResult.ok) {
      const next = filterResult.value ?? {};
      if (formatJson(next) !== formatJson(initial.filter)) out["filter"] = next;
    }
    if (fields.description !== initial.description) {
      out["description"] = fields.description;
    }
    return out;
  }, [fields, initial, filterResult]);

  const setDelivery = useCallback((delivery: string) => {
    setFields((current) => ({ ...current, delivery, target: EMPTY_TARGET }));
  }, []);

  return {
    fields,
    targetKeys,
    setEventType: (eventType) =>
      setFields((current) => ({ ...current, eventType })),
    setDelivery,
    setTargetField: (key, value) =>
      setFields((current) => ({
        ...current,
        target: { ...current.target, [key]: value },
      })),
    setFilterText: (filterText) =>
      setFields((current) => ({ ...current, filterText })),
    setDescription: (description) =>
      setFields((current) => ({ ...current, description })),
    filterProblem,
    targetProblem,
    submit,
    body,
    patch,
    reset: () => setFields(initialFields(initial)),
  };
}
