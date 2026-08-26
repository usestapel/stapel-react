/**
 * Turning wire values into things a person reads.
 *
 * Two rules, both of them about not publishing a second answer:
 *
 *  - **format, never compute.** Every instant on this surface
 *    (`next_attempt_at`, `last_attempt_at`, `disabled_at`,
 *    `last_delivery_at`) is stamped by the server on the server's clock, and
 *    the retry ladder that produced it is the server's. A browser that turned
 *    `next_attempt_at` into "in 2 minutes" would be guessing with a device
 *    clock, and would be wrong first on exactly the machine whose clock is
 *    already wrong.
 *  - **an unparseable instant renders as itself.** `Intl` on a `NaN` date
 *    throws in some engines and prints `Invalid Date` in others; on a log
 *    somebody is reading to find out what broke, the raw wire value is at
 *    least the truth the server sent.
 */
import type { DeliveryTarget } from "../api/types.js";
import {
  DELIVERY_CUSTOM,
  DELIVERY_NOTIFICATION,
  DELIVERY_WEBHOOK,
  DELIVERY_WS,
} from "./deliveryTypes.js";

/** An instant with a time — the delivery log's unit. */
export function formatInstant(iso: string, locale: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(at);
  } catch {
    return iso;
  }
}

/** A date without a time — for "auto-disabled on …". */
export function formatDate(iso: string, locale: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(at);
  } catch {
    return iso;
  }
}

/** `null`/`undefined` instants are the common case — a rule that never fired
 * has no `last_delivery_at` — so the fallback is a caller-supplied dash, not
 * the string "null". */
export function formatOptionalInstant(
  iso: string | null | undefined,
  locale: string,
  absent: string
): string {
  return iso == null || iso.length === 0 ? absent : formatInstant(iso, locale);
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

/**
 * One line that says WHERE a rule delivers, per delivery type.
 *
 * A webhook is summarised by its HOST, not its full URL: the list is scanned,
 * a signed URL can be hundreds of characters, and the host is the part that
 * answers "is this the staging receiver or the production one?". The full URL
 * is one row-open away, in the sheet that edits it.
 */
export function targetSummary(
  deliveryType: string,
  target: DeliveryTarget
): string {
  switch (deliveryType) {
    case DELIVERY_WEBHOOK: {
      const url = text(target["url"]);
      if (url === undefined) return "";
      try {
        return new URL(url).host;
      } catch {
        return url;
      }
    }
    case DELIVERY_NOTIFICATION: {
      const kind = text(target["notification_type"]) ?? "";
      const to =
        text(target["email"]) ??
        text(target["phone"]) ??
        text(target["telegram_chat_id"]) ??
        text(target["user_id"]);
      return to === undefined ? kind : `${kind} → ${to}`;
    }
    case DELIVERY_WS:
      return text(target["stream"]) ?? "";
    case DELIVERY_CUSTOM:
      return text(target["path"]) ?? "";
    default: {
      // A host-registered type: show the target as it is rather than nothing.
      const first = Object.entries(target).find(
        ([, value]) => text(value) !== undefined
      );
      return first === undefined ? "" : `${first[0]}: ${String(first[1])}`;
    }
  }
}

/** Pretty-print a payload/envelope for the `<pre>` in a detail sheet. */
export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

/**
 * The envelope the receiver got, rebuilt from the delivery row.
 *
 * The module does not store the serialized body it POSTed — it stores the
 * matched `payload` and the identifiers, and `transport.py` assembles the
 * envelope at send time from exactly these fields. Rebuilding it here is
 * therefore a reconstruction and not a recording, which is why the detail
 * sheet labels it as "the envelope a replay would send" rather than "the
 * request we sent".
 */
export function deliveryEnvelope(row: {
  readonly id: string;
  readonly event_type: string;
  readonly event_id: string;
  readonly subscription_id: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly created_at?: string | null;
}): Record<string, unknown> {
  return {
    id: row.id,
    type: row.event_type,
    event_id: row.event_id,
    subscription_id: row.subscription_id,
    created_at: row.created_at ?? null,
    data: row.payload,
  };
}

/**
 * The headers a receiver sees, as `transport.py` sets them. Rebuilt for the
 * same reason as the envelope, and marked the same way on screen.
 * The signature line is deliberately NOT reconstructed: it is an HMAC over the
 * body with a secret this client does not have, and a fabricated one on a
 * debugging screen is worse than none at all.
 */
export function deliveryHeaders(row: {
  readonly id: string;
  readonly event_type: string;
  readonly event_id: string;
  readonly attempts: number;
}): readonly (readonly [string, string])[] {
  return [
    ["X-Stapel-Delivery", row.id],
    ["X-Stapel-Event", row.event_type],
    ["X-Stapel-Event-Id", row.event_id],
    ["X-Stapel-Attempt", String(row.attempts)],
  ];
}
