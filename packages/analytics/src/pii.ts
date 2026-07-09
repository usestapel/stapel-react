import type { PiiGuardMode } from "@stapel/core";

/**
 * PII guard heuristics (analytics-standard §1.4): prop VALUES that look
 * like emails or phone numbers are redacted ("strip"), kept with a warning
 * ("warn"), or passed through ("off"). Applies to track/page props and
 * identify traits. Keys are not judged — only values.
 */

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}/;
const PHONE_SHAPE_RE = /^\+?[\d\s\-().]{7,}$/;

export function looksLikePii(value: string): boolean {
  if (EMAIL_RE.test(value)) return true;
  const trimmed = value.trim();
  if (!PHONE_SHAPE_RE.test(trimmed)) return false;
  return trimmed.replace(/\D/g, "").length >= 7;
}

export const PII_REDACTED = "[redacted]";

function sanitizeValue(
  value: unknown,
  mode: PiiGuardMode,
  hit: { found: boolean }
): unknown {
  if (typeof value === "string" && looksLikePii(value)) {
    hit.found = true;
    return mode === "strip" ? PII_REDACTED : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, mode, hit));
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = sanitizeValue(nested, mode, hit);
    }
    return result;
  }
  return value;
}

/**
 * Guard a props/traits object. Warns once per event name (per facade
 * instance) via the caller-owned `warned` set.
 */
export function guardPii(
  eventName: string,
  props: Record<string, unknown>,
  mode: PiiGuardMode,
  warned: Set<string>
): Record<string, unknown> {
  if (mode === "off") return props;
  const hit = { found: false };
  const guarded = sanitizeValue(props, mode, hit) as Record<string, unknown>;
  if (hit.found && !warned.has(eventName)) {
    warned.add(eventName);
    console.warn(
      `[stapel analytics] PII-like value in props of "${eventName}" — ` +
        (mode === "strip" ? "redacted" : "kept (piiGuard: warn)") +
        ". PII in analytics props is banned (analytics-standard §1.4)."
    );
  }
  return guarded;
}
