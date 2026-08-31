/**
 * The Money layer — the fleet's ONE money formatter and converter.
 *
 * Pure: no React, no network, no antd. Everything else in this package (and,
 * from the next changesets on, `@stapel/billing-react` and
 * `@stapel/listings-react`) renders through the two functions at the bottom of
 * this file.
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 *
 * `@stapel/listings-react`'s card printed a price as `` `${price} ${currency}` ``
 * — `1500 EUR`. No grouping, no symbol, no locale, and the same string in
 * ru/es as in en. Every other pair that ever shows an amount was one copy away
 * from doing it again, so the formatter is a package rather than a helper: one
 * import, one set of rules, one place to fix when a currency's minor units
 * change.
 *
 * ── Floats never ───────────────────────────────────────────────────────────
 *
 * The wire spells money as a decimal STRING and rates as `Decimal(20, 8)`,
 * because that is the only representation in which `0.1 + 0.2` is `0.3`. This
 * module keeps the string discipline end to end: every arithmetic step below
 * runs on `BigInt` scaled integers (an integer plus a decimal exponent), and
 * the only place a `number` appears is inside `Intl.NumberFormat`, which is
 * given a string and hands back a string.
 *
 * ── Parity with the server ─────────────────────────────────────────────────
 *
 * {@link convert} is the client-side twin of `stapel_currencies.services.convert`
 * (`services.py:44-61`) and follows it step for step: cross-rate through the
 * base currency, the base's own stored rate ignored (it is 1 by definition),
 * ROUND_HALF_UP to `CONVERSION_DECIMAL_PLACES`. `test/money.test.ts` re-runs
 * the backend's own `tests/test_convert.py` cases against it — including the
 * halfway case that separates HALF_UP from HALF_EVEN.
 *
 * A converted price is an ESTIMATE and this module never pretends otherwise:
 * the catalogue carries no timestamp (BACKEND-GAP C-2), so nothing here can
 * say how old a rate is. That is why `usePrice` renders the original beside
 * every conversion and the skins never show a converted number alone.
 */
import type { Currency } from "../api/types.js";

/**
 * A decimal number as an integer and an exponent: the value is
 * `units / 10 ** scale`. `units` carries the sign.
 */
export interface Decimal {
  readonly units: bigint;
  readonly scale: number;
}

/** Only what a decimal string may look like — no exponents, no separators. */
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Working precision for the division half of a cross-rate, in decimal places.
 *
 * The server does the same division in a `Decimal` context of 28 SIGNIFICANT
 * digits and then quantizes; 34 decimal places is more than that for every
 * amount a price can plausibly be, so the two agree before the quantize step
 * and therefore after it. It is not free precision — it is enough precision
 * that the rounding decision is made by the quantize, not by the intermediate.
 */
const DIVISION_SCALE = 34;

const pow10 = (n: number): bigint => 10n ** BigInt(n);

/**
 * Parse a decimal string. `undefined` for anything that is not one — an empty
 * field, `"1e3"`, `"1 500"`, `null` stringified by a careless caller. The
 * absence of a number is not a zero, and returning `0n` here would be the
 * money version of `data ?? []`.
 */
export function parseDecimal(text: string): Decimal | undefined {
  const trimmed = text.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) return undefined;
  const negative = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/^[+-]/, "");
  const dot = unsigned.indexOf(".");
  const digits = dot === -1 ? unsigned : unsigned.slice(0, dot) + unsigned.slice(dot + 1);
  const scale = dot === -1 ? 0 : unsigned.length - dot - 1;
  const units = BigInt(digits === "" ? "0" : digits);
  return { units: negative ? -units : units, scale };
}

/** Render a {@link Decimal} back to a plain decimal string. */
export function formatDecimal(value: Decimal): string {
  const negative = value.units < 0n;
  const digits = (negative ? -value.units : value.units).toString();
  if (value.scale === 0) return negative ? `-${digits}` : digits;
  const padded = digits.padStart(value.scale + 1, "0");
  const whole = padded.slice(0, padded.length - value.scale);
  const fraction = padded.slice(padded.length - value.scale);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Integer division rounded HALF_UP — ties go AWAY from zero, as Python's
 * `ROUND_HALF_UP` does (which is not JavaScript's `Math.round`, and not
 * banker's rounding). `divisor` must be non-zero. */
function divideHalfUp(dividend: bigint, divisor: bigint): bigint {
  const negative = dividend < 0n !== divisor < 0n;
  const a = dividend < 0n ? -dividend : dividend;
  const b = divisor < 0n ? -divisor : divisor;
  const quotient = a / b;
  const remainder = a % b;
  const rounded = remainder * 2n >= b ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/**
 * Re-scale to exactly `places` decimal places, ROUND_HALF_UP — the client-side
 * twin of the server's `Decimal.quantize(quantum, rounding=ROUND_HALF_UP)`.
 */
export function quantize(value: Decimal, places: number): Decimal {
  if (places === value.scale) return value;
  if (places > value.scale) {
    return { units: value.units * pow10(places - value.scale), scale: places };
  }
  return { units: divideHalfUp(value.units, pow10(value.scale - places)), scale: places };
}

function multiply(a: Decimal, b: Decimal): Decimal {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

/** `a / b` at {@link DIVISION_SCALE} decimal places. `undefined` when `b` is
 * zero — a stored rate of `0` is a broken catalogue row, not a price of zero. */
function divide(a: Decimal, b: Decimal): Decimal | undefined {
  if (b.units === 0n) return undefined;
  const numerator = a.units * pow10(DIVISION_SCALE + b.scale);
  const denominator = b.units * pow10(a.scale);
  return { units: divideHalfUp(numerator, denominator), scale: DIVISION_SCALE };
}

/** The catalogue as the Money layer reads it: code (UPPER-CASE) → row. */
export type CurrencyCatalog = ReadonlyMap<string, Currency>;

/** Build the lookup the Money layer works against, keyed upper-case. */
export function catalogOf(currencies: readonly Currency[]): CurrencyCatalog {
  const byCode = new Map<string, Currency>();
  for (const currency of currencies) byCode.set(currency.code.toUpperCase(), currency);
  return byCode;
}

/** The rate of `code` against the base, or `undefined` when the catalogue has
 * no usable one. The base currency is 1 BY DEFINITION — its stored `value` is
 * deliberately not read, exactly as `Currency.to_base`/`from_base` do it, so a
 * drifted base row cannot silently rescale every price on the site. */
function rateOf(code: string, catalog: CurrencyCatalog, base: string): Decimal | undefined {
  if (code === base) return { units: 1n, scale: 0 };
  const row = catalog.get(code);
  if (row === undefined) return undefined;
  if (row.value === undefined) return undefined;
  const parsed = parseDecimal(row.value);
  if (parsed === undefined || parsed.units === 0n) return undefined;
  return parsed;
}

export interface ConvertOptions {
  /** The deployment's base currency — `STAPEL_CURRENCIES["BASE_CURRENCY"]`. */
  readonly base: string;
  /** `CONVERSION_DECIMAL_PLACES` — how many places the result is quantized to. */
  readonly places: number;
}

/**
 * Convert a decimal-string amount between two currencies through the base
 * cross-rate — the client-side twin of `services.convert`.
 *
 * `undefined` (never a fabricated number) when the amount is not a decimal
 * string, when either code is missing from the catalogue, or when a rate is
 * unusable. A price whose conversion cannot be computed is shown in its own
 * currency; it is never shown converted-to-nothing.
 */
export function convert(
  amount: string,
  from: string,
  to: string,
  catalog: CurrencyCatalog,
  options: ConvertOptions
): string | undefined {
  const parsed = parseDecimal(amount);
  if (parsed === undefined) return undefined;

  const source = from.toUpperCase();
  const target = to.toUpperCase();
  const base = options.base.toUpperCase();

  // Same currency: still validate the code (converting an unknown currency to
  // itself must not silently succeed — services.py:52), then quantize.
  const sourceRate = rateOf(source, catalog, base);
  if (sourceRate === undefined) return undefined;
  if (source === target) return formatDecimal(quantize(parsed, options.places));

  const targetRate = rateOf(target, catalog, base);
  if (targetRate === undefined) return undefined;

  const inBase = source === base ? parsed : divide(parsed, sourceRate);
  if (inBase === undefined) return undefined;
  const inTarget = target === base ? inBase : multiply(inBase, targetRate);
  return formatDecimal(quantize(inTarget, options.places));
}

/**
 * What one unit of `from` is worth in `to`, as a decimal string — the number a
 * skin puts in the visible "1 USD = 92.59 RUB" line.
 *
 * Rates get more places than prices do: quantizing a rate to two places turns
 * every currency worth less than a cent into `0.00`, and a rate line that says
 * `1 HUF = 0.00 USD` is worse than no rate line.
 */
export function crossRate(
  from: string,
  to: string,
  catalog: CurrencyCatalog,
  options: ConvertOptions
): string | undefined {
  return convert("1", from, to, catalog, {
    base: options.base,
    places: Math.max(options.places, RATE_DECIMAL_PLACES),
  });
}

/** Decimal places a displayed exchange rate is quantized to. */
export const RATE_DECIMAL_PLACES = 4;

// ── Formatting ──────────────────────────────────────────────────────────────

/**
 * How the currency is spelled beside the number.
 *
 * `"symbol"` — `$1,500.00` (the default: shortest, and what a price tag is).
 * `"code"` — `USD 1,500.00` (a ledger, a rate table, two currencies whose
 * symbols collide — `$` is a dozen different currencies).
 * `"narrow"` — `$1,500.00` even where the locale would disambiguate to `US$`.
 */
export type SymbolDisplay = "symbol" | "code" | "narrow";

type IntlCurrencyDisplay = NonNullable<Intl.NumberFormatOptions["currencyDisplay"]>;

const CURRENCY_DISPLAY: Readonly<Record<SymbolDisplay, IntlCurrencyDisplay>> = {
  symbol: "symbol",
  code: "code",
  narrow: "narrowSymbol",
};

/**
 * The ISO 4217 code for "no currency". Used as a STAND-IN so an unknown or
 * non-ISO token (a host that seeded its catalogue with `PTS` or a token
 * ticker) still gets the locale's own placement, spacing and grouping, with
 * the placeholder swapped for the real token afterwards.
 */
const PLACEHOLDER_CURRENCY = "XXX";

/**
 * `Intl.NumberFormat` accepts a decimal STRING since Intl.NumberFormat V3 —
 * which is what lets this package format money without ever building a
 * `number` (`Number("9007199254740993.01")` is not that amount). TypeScript's
 * DOM lib still types `format` as `(value: number | bigint)`, so the call goes
 * through this narrowed view of the same object.
 */
interface StringCapableNumberFormat {
  format(value: string): string;
  formatToParts(value: string): Intl.NumberFormatPart[];
  resolvedOptions(): Intl.ResolvedNumberFormatOptions;
}

const asStringCapable = (formatter: Intl.NumberFormat): StringCapableNumberFormat =>
  formatter as unknown as StringCapableNumberFormat;

export interface FormatMoneyOptions {
  /** BCP-47 tag. The pair's hooks default it to the i18n engine's locale. */
  readonly locale: string;
  /** Default `"symbol"`. */
  readonly symbolDisplay?: SymbolDisplay;
  /** Override the currency's own minor units (a rate table showing 4 places,
   * a summary showing 0). Both ends move together so `1.5` never renders as
   * `1.5` in one column and `1.50` in the next. */
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
  /**
   * Whether a whole amount prints its currency's minor units. See
   * {@link FractionPolicy}. Default `"auto"`.
   */
  readonly fraction?: FractionPolicy;
  /**
   * What to print beside the number when `Intl` refuses the code (it accepts
   * only three ASCII letters). Normally the catalogue's `symbol`; falls back
   * to the code itself, never to nothing.
   */
  readonly fallbackSymbol?: string;
}

/**
 * How many decimal places a money string prints when the caller pins neither
 * end. The rule, in one sentence: **the fraction is printed when the amount
 * HAS one.**
 *
 * `"auto"` (default) — `42000.00 RUB` is `42 000 ₽` and `42000.50 RUB` is
 * `42 000,50 ₽`. A trailing `,00` on a classified's price tag is noise a
 * person has to read past on every card of every page, and no marketplace
 * prints it; but a price that really is 42 000,50 must not be rounded to a
 * different number. So the AMOUNT decides the minimum and the CURRENCY still
 * decides the maximum — `1234.567 USD` is `$1,234.57`, not `$1,234.567`.
 *
 * `"minor-units"` — always the currency's own minor units, `42 000,00 ₽`. What
 * a ledger, an invoice line or a settlement report wants: a column of amounts
 * whose decimal points line up, where a missing `,00` reads as a different
 * precision rather than as a round number.
 *
 * Neither is a rounding policy: both arms print the same VALUE, quantized by
 * `Intl` to at most the currency's minor units. An explicit
 * `minimumFractionDigits`/`maximumFractionDigits` overrides both — a rate
 * table showing four places is still a caller's call.
 */
export type FractionPolicy = "auto" | "minor-units";

/** Does this amount carry a non-zero fractional part? `1.50` does; `1.00`
 * does not, and neither does `1`. Scale alone cannot answer it — the wire
 * writes whole roubles as `"42000.00"`. */
function hasFraction(value: Decimal): boolean {
  if (value.scale === 0) return false;
  let divisor = 1n;
  for (let i = 0; i < value.scale; i += 1) divisor *= 10n;
  return value.units % divisor !== 0n;
}

function fractionOptions(
  options: FormatMoneyOptions,
  amount: Decimal
): { minimumFractionDigits?: number; maximumFractionDigits?: number } {
  const min = options.minimumFractionDigits;
  const max = options.maximumFractionDigits ?? min;
  if (min !== undefined || max !== undefined) {
    return {
      ...(min !== undefined ? { minimumFractionDigits: min } : {}),
      ...(max !== undefined ? { maximumFractionDigits: max } : {}),
    };
  }
  // Nothing pinned: the policy decides. `{}` leaves `Intl` on the currency's
  // own ISO 4217 minor units for BOTH ends, which is the `"minor-units"` arm
  // and was this function's only behaviour before the policy existed.
  if ((options.fraction ?? "auto") === "minor-units") return {};
  // `"auto"`: drop the floor to zero and leave the ceiling where the currency
  // put it. A whole amount then prints no fraction and a fractional one prints
  // every place the currency has.
  return hasFraction(amount) ? {} : { minimumFractionDigits: 0 };
}

/**
 * Format a decimal-string amount as money in `locale`.
 *
 * Locale is not decoration. `1234.5` in `USD` is `$1,234.50` in `en`,
 * `1234,50 $` in `es` and `1 234,50 $` in `ru` — different separators,
 * different grouping, and the symbol on the other side. That is the whole
 * reason a product ships this rather than a template literal.
 *
 * Never throws and never renders an empty slot:
 *  - an amount that is not a decimal string comes back verbatim (the wire said
 *    something this module does not understand; hiding it would hide the bug);
 *  - a currency code `Intl` refuses is formatted as a plain number in the same
 *    locale, with the catalogue's symbol (or the code) in the position the
 *    locale puts a currency.
 */
export function formatMoney(
  amount: string,
  code: string,
  options: FormatMoneyOptions
): string {
  const parsed = parseDecimal(amount);
  if (parsed === undefined) return amount;
  const normalized = formatDecimal(parsed);
  const display = CURRENCY_DISPLAY[options.symbolDisplay ?? "symbol"];

  try {
    const formatter = new Intl.NumberFormat(options.locale, {
      style: "currency",
      currency: code,
      currencyDisplay: display,
      ...fractionOptions(options, parsed),
    });
    if (display === "code") return asStringCapable(formatter).format(normalized);
    return withPreferredGlyph(
      asStringCapable(formatter).formatToParts(normalized),
      code,
      options.fallbackSymbol
    );
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return formatUnknownCurrency(normalized, parsed, code, options);
  }
}

/**
 * The fallback arm: format through the placeholder currency so the LOCALE
 * still decides where the token goes and how the digits are grouped, then swap
 * the placeholder for the catalogue's symbol (or the code).
 */
function formatUnknownCurrency(
  normalized: string,
  amount: Decimal,
  code: string,
  options: FormatMoneyOptions
): string {
  const token =
    options.symbolDisplay === "code"
      ? code
      : ((options.fallbackSymbol ?? "").length > 0
          ? (options.fallbackSymbol as string)
          : code);
  try {
    const formatter = new Intl.NumberFormat(options.locale, {
      style: "currency",
      currency: PLACEHOLDER_CURRENCY,
      currencyDisplay: "code",
      ...fractionOptions(options, amount),
    });
    return asStringCapable(formatter)
      .formatToParts(normalized)
      .map((part) => (part.type === "currency" ? token : part.value))
      .join("");
  } catch {
    // A locale tag so malformed that even the placeholder pass refuses it.
    // The number and its token, in that order, is still a price.
    return `${normalized} ${token}`;
  }
}

/**
 * A price tag wants a GLYPH. `Intl` only has one where the locale ships one:
 * `en-US` renders `RUB 1,500.00` for roubles while it renders `€1,500.00` for
 * euros, so the same catalogue produced `€`, `$` and a bare ISO code on one
 * screen. When `Intl` fell back to the code and the catalogue carries the real
 * glyph (`₽`), the glyph goes in — in the SLOT the locale chose, so placement,
 * spacing and grouping stay the locale's decision and only the token changes.
 *
 * Nothing is substituted when the caller asked for `"code"`, when the
 * catalogue has no symbol, or when `Intl` already found one.
 */
function withPreferredGlyph(
  parts: readonly Intl.NumberFormatPart[],
  code: string,
  fallbackSymbol: string | undefined
): string {
  const glyph = fallbackSymbol ?? "";
  if (glyph.length === 0) return parts.map((part) => part.value).join("");
  const upper = code.toUpperCase();
  return parts
    .map((part) =>
      part.type === "currency" && part.value.toUpperCase() === upper ? glyph : part.value
    )
    .join("");
}

export interface FormatRateOptions {
  /** BCP-47 tag — grouping and the decimal separator are the locale's. */
  readonly locale: string;
  /** Most decimal places to keep. Default {@link RATE_DECIMAL_PLACES}. */
  readonly maximumFractionDigits?: number;
  /** Fewest, so a column of rates keeps its decimal points aligned. Default 2. */
  readonly minimumFractionDigits?: number;
}

/**
 * A stored exchange rate, formatted for a person to read.
 *
 * The wire spells rates as `Decimal(20, 8)`, so the catalogue answers
 * `92.59000000` and `1.00000000`. Eight trailing zeros are precision the
 * column does not have and nobody reads; a rate table that prints them is
 * unscannable. This trims to at most {@link RATE_DECIMAL_PLACES} places while
 * keeping at least two, so `1.00`, `0.93` and `92.59` line up under each other
 * — and it is grouping-aware, because a rate can be `1 234,56`.
 *
 * Not `formatMoney`: a rate is a ratio, not an amount of money, and attaching
 * a currency symbol to it would claim the wrong thing.
 */
export function formatRate(value: string, options: FormatRateOptions): string {
  const parsed = parseDecimal(value);
  if (parsed === undefined) return value;
  const max = options.maximumFractionDigits ?? RATE_DECIMAL_PLACES;
  const min = Math.min(options.minimumFractionDigits ?? 2, max);
  const normalized = formatDecimal(quantize(parsed, max));
  try {
    const formatter = new Intl.NumberFormat(options.locale, {
      style: "decimal",
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
    return asStringCapable(formatter).format(normalized);
  } catch {
    return normalized;
  }
}

/**
 * The currency's minor units — 2 for `USD`, 0 for `JPY`, 3 for `KWD` —
 * `undefined` for a code `Intl` does not know. The number a form's amount
 * input should step by and validate against.
 */
export function minorUnitsOf(code: string, locale = "en"): number | undefined {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return undefined;
  }
}

/**
 * Is this text an amount this module can work with? The validator behind
 * `CurrencyField` — an empty field is not an error here (it is empty), so the
 * caller decides whether "required" applies.
 */
export function isValidAmount(text: string): boolean {
  return parseDecimal(text) !== undefined;
}
