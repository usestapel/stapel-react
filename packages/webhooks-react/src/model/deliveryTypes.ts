/**
 * The built-in delivery types and the shape of the target each one needs.
 *
 * ── Why this table exists at all ──────────────────────────────────────────
 *
 * `GET event-catalog` returns `delivery_types` as a list of NAMES and nothing
 * else (BACKEND-GAP W-5: `required_target_keys` / `any_of_target_keys` /
 * `signed` live in `registry.py` and are not served). A form that only knew
 * the names could offer one free-text box and let the server say "the target
 * does not fit this delivery type" — a 400 that names neither the missing key
 * nor the type it belongs to. So the four built-ins are mirrored here, field
 * by field, from `registry.py`'s `BUILTIN_DELIVERY_TYPES`.
 *
 * ── And why it is a FALLBACK, not the source of truth ─────────────────────
 *
 * The registry is a merge-registry: a host adds types through
 * `STAPEL_WEBHOOKS["DELIVERY_TYPES"]` and can REMOVE a built-in with a spec of
 * `None` (closing `custom` is the documented way to let end users create
 * subscriptions safely). So the picker offers what the CATALOGUE lists, and
 * this table only supplies the field hints for the names it recognises. A type
 * the deployment added and this package has never heard of gets a generic
 * key/value target editor rather than being hidden — hiding it would make a
 * host's own extension invisible in its own settings screen.
 */

/** What a delivery type needs in its `target`, and whether it is signed. */
export interface DeliveryTypeSpec {
  /** Registry name, as it goes on the wire. */
  readonly name: string;
  /** Keys the target MUST carry (`required_target_keys`). */
  readonly requiredTargetKeys: readonly string[];
  /** At least one of these must be present, when non-empty (`any_of_target_keys`). */
  readonly anyOfTargetKeys: readonly string[];
  /** Whether deliveries are HMAC-signed — i.e. whether there is a secret. */
  readonly signed: boolean;
  /** Whether the delivery leaves the deployment (SSRF guard, payload cap). */
  readonly external: boolean;
}

/** `webhook` — HTTP POST to a caller-supplied URL, HMAC-signed. */
export const DELIVERY_WEBHOOK = "webhook";
/** `notification` — email/push/SMS through the notifications module. */
export const DELIVERY_NOTIFICATION = "notification";
/** `ws` — an ephemeral frame on a realtime stream. */
export const DELIVERY_WS = "ws";
/** `custom` — an in-process dotted-path handler in the app layer. */
export const DELIVERY_CUSTOM = "custom";

/** `registry.py` `BUILTIN_DELIVERY_TYPES`, mirrored (see the module doc). */
export const BUILTIN_DELIVERY_TYPES: Readonly<
  Record<string, DeliveryTypeSpec>
> = {
  [DELIVERY_WEBHOOK]: {
    name: DELIVERY_WEBHOOK,
    requiredTargetKeys: ["url"],
    anyOfTargetKeys: [],
    signed: true,
    external: true,
  },
  [DELIVERY_NOTIFICATION]: {
    name: DELIVERY_NOTIFICATION,
    requiredTargetKeys: ["notification_type"],
    // The backend refuses a notification that addresses nobody at
    // SUBSCRIPTION time rather than at delivery time — so the form does too.
    anyOfTargetKeys: ["user_id", "email", "phone", "telegram_chat_id"],
    signed: false,
    external: false,
  },
  [DELIVERY_WS]: {
    name: DELIVERY_WS,
    requiredTargetKeys: ["stream"],
    anyOfTargetKeys: [],
    signed: false,
    external: false,
  },
  [DELIVERY_CUSTOM]: {
    name: DELIVERY_CUSTOM,
    requiredTargetKeys: ["path"],
    anyOfTargetKeys: [],
    signed: false,
    external: false,
  },
};

/** The spec for a name, or `undefined` for a host-registered type. */
export function deliveryTypeSpec(name: string): DeliveryTypeSpec | undefined {
  return BUILTIN_DELIVERY_TYPES[name];
}

/**
 * Does a subscription of this type have a signing secret to rotate?
 *
 * `undefined` (a host-registered type this package does not know) is treated
 * as UNSIGNED for the purpose of offering rotation, and the rotate control is
 * gated with that as its stated reason rather than being offered and refused
 * with a 400 the person cannot act on.
 */
export function isSignedDelivery(name: string): boolean {
  return deliveryTypeSpec(name)?.signed ?? false;
}

/** Every target key a form should draw for this type, required ones first. */
export function targetKeysFor(name: string): readonly string[] {
  const spec = deliveryTypeSpec(name);
  if (spec === undefined) return [];
  return [...spec.requiredTargetKeys, ...spec.anyOfTargetKeys];
}

/** A target that is missing a required key, or addresses nobody. */
export interface TargetProblem {
  /** i18n key naming what is wrong. */
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
}

const nonEmpty = (value: unknown): boolean =>
  value !== undefined && value !== null && String(value).trim().length > 0;

/**
 * Check a target against its type's declared keys, BEFORE the request.
 *
 * The one rule with teeth that the wire cannot express: `webhook` targets must
 * be `https`. The backend refuses `http` with its own code
 * (`webhooks_insecure_target`); saying so beside the field is the difference
 * between a person fixing a scheme and a person filing a bug.
 */
export function validateTarget(
  deliveryType: string,
  target: Readonly<Record<string, unknown>>,
  keys: {
    readonly missing: string;
    readonly recipient: string;
    readonly insecure: string;
  }
): TargetProblem | undefined {
  const spec = deliveryTypeSpec(deliveryType);
  if (spec === undefined) return undefined;

  for (const key of spec.requiredTargetKeys) {
    if (!nonEmpty(target[key])) {
      return { code: keys.missing, params: { field: key } };
    }
  }
  if (
    spec.anyOfTargetKeys.length > 0 &&
    !spec.anyOfTargetKeys.some((key) => nonEmpty(target[key]))
  ) {
    return { code: keys.recipient, params: {} };
  }
  if (spec.external && typeof target["url"] === "string") {
    const url = target["url"].trim();
    if (!url.toLowerCase().startsWith("https://")) {
      return { code: keys.insecure, params: {} };
    }
  }
  return undefined;
}
