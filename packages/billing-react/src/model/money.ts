/**
 * The pair's FORMATTERS: money, counted credits, and deadlines.
 *
 * A price, a credit count and a date are DATA, not copy. They carry no
 * translator-authored sentence, so they need no i18n key — they need `Intl`
 * and the host's locale, which is what every function here is. Copy that
 * WRAPS them ("{credits} credits expire on {date}") stays in `i18n/keys.ts`
 * where a translator can reach it.
 *
 * ── Why this module exists at all ─────────────────────────────────────────
 *
 * The visual pass found the wallet printing its balance as `1240 USD` — an
 * integer beside a raw ISO 4217 code, in a monospace debug chip — while
 * `formatMoney` sat two modules away in `pricing.ts`, used only by the shop.
 * The defect class (VC-A8, "raw machine values on the glass") is fleet-wide,
 * so the fix is a named module every surface of this pair reaches for, not a
 * second call site.
 *
 * `@stapel/core`'s i18n engine has no money/date formatter today (it owns
 * plurals — `tPlural` — and nothing else numeric), so these live here. They
 * are candidates for core, or for the coming `@stapel/currencies-react`;
 * `SCRATCH/wave-b/REQUESTS-billing-react.md` records that.
 *
 * ── Credits are NOT money ─────────────────────────────────────────────────
 *
 * A credit is a counted unit with its own plural rules; a price is an amount
 * of a currency. Rendering a balance through a currency formatter is what
 * produced `1240 USD` in the first place. {@link formatCreditCount} groups
 * the digits and stops there — the WORD "credits" comes from a plural i18n
 * family (`tPlural`), because "1 credit" versus "2 credits" — and the four
 * distinct forms Russian uses for the same noun — is language, not
 * arithmetic.
 */

/**
 * A price in minor units as money — `$1,240.00`. `Intl` localizes from the
 * host's own locale, so a catalogue price cannot go stale in a catalogue.
 */
export function formatMoney(
  locale: string,
  currency: string,
  cents: number
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * A per-credit rate as money. Widened to four fraction digits on purpose: at
 * two, every offer in a credit shop rounds to the same "$0.01" and the
 * comparison the shop exists to show disappears.
 */
export function formatPerCredit(
  locale: string,
  currency: string,
  cents: number
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cents / 100);
}

/**
 * A credit count with the locale's own digit grouping — `1,240` / `1 240`.
 * No unit word: that is a plural family (`tPlural`), not a number format.
 */
export function formatCreditCount(locale: string, credits: number): string {
  return new Intl.NumberFormat(locale).format(credits);
}

/**
 * A signed credit delta — `+500` / `−120` — for a ledger row, where the
 * SIGN is the column's whole content and a bare `500` beside a bare `120`
 * says nothing. Uses the locale's own minus glyph via `signDisplay`.
 */
export function formatCreditDelta(locale: string, credits: number): string {
  return new Intl.NumberFormat(locale, { signDisplay: "exceptZero" }).format(
    credits
  );
}

/**
 * An ISO 8601 instant as a plain local date. An unparseable value yields the
 * empty string rather than "Invalid Date" on a customer's screen.
 */
export function formatExpiryDate(locale: string, iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(parsed);
}

/**
 * An ISO 8601 instant as a date AND a time — the resolution a ledger row
 * needs, because two charges on the same day are otherwise indistinguishable.
 */
export function formatTimestamp(locale: string, iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

/**
 * Whole days from `now` until `iso`, rounded toward zero, or `null` when the
 * instant is unparseable.
 *
 * Deliberately NOT a duration in hours: a deadline a customer plans around
 * is counted in days, and "in 23 hours" reads as urgent for something that
 * is in fact tomorrow. Past deadlines come back negative — the caller
 * decides whether that is "expired" (a lot the server still lists) or a
 * clock skew it should say nothing about.
 */
export function daysUntil(iso: string, now: number = Date.now()): number | null {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  const dayMs = 86_400_000;
  return Math.trunc((parsed - now) / dayMs);
}

/**
 * A deadline as the phrase a person plans around — "in 8 days", "tomorrow",
 * "today" — through `Intl.RelativeTimeFormat`, which owns those words in
 * every locale so no pair has to catalogue them.
 *
 * Returns `null` when the instant is unparseable OR when the environment has
 * no `RelativeTimeFormat` (an old webview): the caller then shows the
 * absolute date alone, which is always correct, rather than a fabricated
 * English phrase. The absolute date is shown BESIDE this in every surface
 * anyway — a relative phrase on its own is unverifiable, and this one is
 * attached to money.
 */
export function formatDeadlineRelative(
  locale: string,
  iso: string,
  now: number = Date.now()
): string | null {
  const days = daysUntil(iso, now);
  if (days === null) return null;
  if (typeof Intl.RelativeTimeFormat !== "function") return null;
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    days,
    "day"
  );
}
