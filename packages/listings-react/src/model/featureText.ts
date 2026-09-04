/**
 * A stored feature value as a person READS it — with its unit, and with its
 * digits grouped the way the reader's locale groups them.
 *
 * ── What was on screen ────────────────────────────────────────────────────
 *
 * Measured on the live listing page: "Power 173", "Mileage 20000", "Engine
 * volume 2.0". Three defects in three rows:
 *
 *  - **no unit.** 173 what. 20000 what. A spec row whose value is a bare
 *    number is a row a buyer has to guess at, and mileage is the single
 *    number a used-car buyer decides on;
 *  - **no digit grouping.** `20000` is read digit by digit; "20 000" is read
 *    at a glance. `formatFeatureValue`'s integer branch is `String(value)`
 *    (attributes-react `src/format.ts:196`), deliberately — it mirrors the
 *    engine's own `str(value)` — and the engine renders for a machine-read
 *    API, not for a spec table;
 *  - **the wrong decimal mark.** `2.0` in a Russian storefront. The engine
 *    writes `toFixed`, which is invariant by construction.
 *
 * ── Where the unit comes from ─────────────────────────────────────────────
 *
 * There is NO generic `unit` key anywhere in this fleet's feature contract —
 * not on `FeatureDef` (`stapel-attributes/base.py:154-208`), not on
 * `IntConfig`/`FloatConfig` (`attributes-react/src/generated/featureDef.ts:163`),
 * not on the stored DAO. The unit of an `int`/`float` IS its `postfix`, free
 * text on the type's config, with `postfix1000` as the abbreviated unit the
 * engine switches to at a thousand. `convertible_unit` is the one type with
 * real unit semantics (`unitType`/`unit_m`/`unit_i`), and its own formatter
 * already appends the resolved code — so this module leaves it alone.
 *
 * So "render the unit from the definition" means: read `postfix`. It reaches
 * a display surface two ways, and `model/features.ts` now tries both — the
 * stored row's own config first (`dto_to_dao` copies `postfix` at write
 * time), then the CATEGORY's definition of the same slug, which is the path
 * that repairs every listing published before a catalogue gained its units.
 *
 * ── Why the whole formatter is not delegated ──────────────────────────────
 *
 * `formatFeatureValue` is the fleet's one formatter and stays it: every type
 * but `int` and `float` goes straight through it, untouched. The two numeric
 * types are intercepted because the change is not a different ANSWER, it is
 * the same answer typeset — same value, same precision rule, same
 * `postfix1000` switch at a thousand, same translated unit, with the digits
 * run through `Intl.NumberFormat` instead of `String()`.
 */
import type { FeatureDef, FeatureValueDto, FormatOptions } from "@stapel/attributes-react";
import { featureConfig, featureType, formatFeatureValue } from "@stapel/attributes-react";

/** The engine's own defaults (`types/int/type.py`, `types/float/type.py`). */
const DEFAULT_DIGITS: Readonly<Record<"int" | "float", number>> = {
  int: 1,
  float: 2,
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * A config string the engine declares to be a translation key, resolved.
 *
 * `prefix`/`postfix`/`postfix1000` are collected by upstream's
 * `get_translation_keys` unconditionally, so they go through the host's
 * catalogue exactly as `formatFeatureValue` sends them — a Russian storefront
 * was reading "L" and "each" off its own spec table before that landed, and
 * this path must not reintroduce it.
 */
function translated(options: FormatOptions | undefined, raw: unknown): string {
  const text = str(raw);
  if (text.length === 0) return "";
  const t = options?.t;
  if (t === undefined) return text;
  const resolved = t(text);
  return resolved.length > 0 ? resolved : text;
}

/**
 * The unit a numeric feature is measured in, as the reader sees it — or `""`.
 *
 * `postfix1000` when the engine's own thousand switch applies, `postfix`
 * otherwise, so the unit and the number can never disagree about scale.
 */
export function featureUnit(
  feature: FeatureDef,
  dto: FeatureValueDto | undefined,
  options?: FormatOptions
): string {
  const type = featureType(feature);
  if (type !== "int" && type !== "float") return "";
  const config = featureConfig(feature);
  const parsed = Number(dto?.value);
  const big = str(config["postfix1000"]).length > 0 && Number.isFinite(parsed) && Math.abs(parsed) >= 1000;
  return translated(options, config[big ? "postfix1000" : "postfix"]);
}

/**
 * `Intl.NumberFormat` for one value, or `undefined` when the runtime has no
 * `Intl` for this locale to offer.
 *
 * A bad BCP-47 tag throws `RangeError`, and a spec table that renders nothing
 * because a host passed `"en_US"` would be a worse outcome than an ungrouped
 * number — so the caller falls back rather than the page failing.
 */
function grouped(value: number, digits: number, locale: string | undefined): string | undefined {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return undefined;
  }
}

/**
 * The one numeric row, typeset — see the module header for what each piece
 * is repairing.
 *
 * Returns `undefined` for a value that is not a number, so the caller falls
 * back to the shared formatter and an unreadable row keeps saying so.
 */
function formatNumeric(
  feature: FeatureDef,
  dto: FeatureValueDto,
  kind: "int" | "float",
  options: FormatOptions | undefined
): string | undefined {
  // `Number(null)` is 0 and `Number("")` is 0, so a blank row would render as
  // a confident zero. The shared formatter's own `isBlank` gate is upstream of
  // this branch and must be restated here rather than assumed.
  const raw = dto.value;
  if (raw === null || raw === undefined || raw === "") return undefined;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  const config = featureConfig(feature);
  const precision = config["precision"];
  const digits =
    typeof precision === "number" && precision >= 0 ? precision : DEFAULT_DIGITS[kind];

  const prefix = translated(options, config["prefix"]);
  const postfix1000 = str(config["postfix1000"]);

  // The engine switches unit AND scale at exactly a thousand
  // (`format_value`: `value / 1000`, trailing zeros stripped, `postfix1000`
  // as the unit). Grouping a scaled number is harmless and keeps one code
  // path; the trailing-zero strip is the engine's, done on the plain digits
  // before the locale ever sees them, because "1.50" and "1,5" are the same
  // decision made in two places.
  if (postfix1000.length > 0 && Math.abs(parsed) >= 1000) {
    const scaled = Number((parsed / 1000).toFixed(digits));
    const body =
      grouped(scaled, decimalsOf(scaled, digits), options?.locale) ?? String(scaled);
    return join(prefix, body, translated(options, postfix1000));
  }

  // `precision` drives ONLY the scaled branch of an int — the engine's plain
  // branch is `str(value)`, and an integer never grows a decimal tail
  // whatever the config says (D26: a live category shipped `precision: 1` on
  // a year field and the card read "2024.0").
  const value = kind === "int" ? Math.trunc(parsed) : parsed;
  const fraction = kind === "int" ? 0 : digits;
  const body = grouped(value, fraction, options?.locale) ?? value.toFixed(fraction);
  return join(prefix, body, translated(options, config["postfix"]));
}

/** How many decimals a scaled value actually has, capped at the configured
 * precision — the engine's `.rstrip('0').rstrip('.')`, expressed as a count
 * so `Intl` can do the rendering. */
function decimalsOf(value: number, cap: number): number {
  const tail = value.toFixed(cap).split(".")[1] ?? "";
  return tail.replace(/0+$/, "").length;
}

/** `prefix` + body + unit, with the single space the engine puts between a
 * number and its unit and no space at all where there is no unit. */
function join(prefix: string, body: string, unit: string): string {
  return unit.length > 0 ? `${prefix}${body} ${unit}` : `${prefix}${body}`;
}

/**
 * A stored value as a spec row prints it: `formatFeatureValue` for every type
 * but the two numeric ones, which are typeset here instead.
 *
 * Signature-compatible with `formatFeatureValue` on purpose — a surface
 * swaps one for the other and nothing else changes.
 */
export function formatSpecValue(
  feature: FeatureDef,
  dto: FeatureValueDto | undefined,
  options?: FormatOptions
): string | undefined {
  const type = featureType(feature);
  if (dto !== undefined && (type === "int" || type === "float")) {
    const typeset = formatNumeric(feature, dto, type, options);
    if (typeset !== undefined) return typeset;
  }
  return formatFeatureValue(feature, dto, options);
}
