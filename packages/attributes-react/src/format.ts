/**
 * DISPLAY — the read-only half of every value type.
 *
 * A storefront renders an attribute far more often than it edits one: a card
 * shows badges, a detail page shows the whole spec table, a title carries the
 * `show_at_title` values. Formatting therefore lives HERE, in the main entry,
 * React-free and antd-free, so a card can format a value without pulling a
 * skin into its bundle. `<FeatureBadges>`/`<FeatureValueList>` in `/default`
 * are renderers over this function, not a second implementation of it.
 *
 * It mirrors each type's `format_value(config, dao)` (`stapel_attributes
 * .types.*.type`), with the one honest difference the browser forces:
 * `date` formats with the VIEWER's locale and time zone, where the engine
 * formats with the server's — the same instant, written the way the person
 * reading it writes dates.
 *
 * Unsupported types do not vanish. `formatFeatureValue` returns `undefined`
 * for a type it cannot read, and the caller says so; a silent empty cell
 * where a spec line belongs is the display twin of a dropped mandatory field.
 */
import type { FeatureDef, FeatureValueDto } from "./types.js";
import { featureConfig, featureType } from "./types.js";
import { isBlank } from "./validate.js";

/** The types this module can render, sorted — the display half of the
 * builtin set, and asserted equal to the editor half in `contract.test.ts`
 * (a type you can fill in but cannot read back is a half-shipped type). */
export const FORMATTABLE_TYPES: readonly string[] = [
  "bool",
  "convertible_unit",
  "date",
  "float",
  "header",
  "hex_color",
  "hierarchical_select",
  "int",
  "select",
  "string",
];

/** Copy the formatter needs from the host's translator — one function, so a
 * caller outside React (a meta-tag builder, a title composer) can pass a
 * plain lookup instead of standing up a provider. */
export interface FormatOptions {
  /** Resolve an option label / boolean caption. Option labels are translation
   * keys when the config says `translatable_options` (the default). */
  readonly t?: (key: string) => string;
  /** BCP-47 tag for `date`. Defaults to the runtime's own locale. */
  readonly locale?: string;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function translate(options: FormatOptions | undefined, key: string): string {
  const t = options?.t;
  if (t === undefined) return key;
  const resolved = t(key);
  // A translator that does not know a key conventionally returns the key —
  // which is still the most informative thing available, so it stands.
  return resolved.length > 0 ? resolved : key;
}

/** `{value → label}` for an options-bearing config, in either option shape. */
function labelOf(
  config: Readonly<Record<string, unknown>>,
  value: unknown,
  options: FormatOptions | undefined
): string {
  const raw = config["options"];
  if (Array.isArray(raw)) {
    for (const option of raw) {
      if (option !== null && typeof option === "object") {
        const entry = option as { value?: unknown; label?: unknown };
        if (entry.value === value && typeof entry.label === "string" && entry.label.length > 0) {
          return config["translatable_options"] === false
            ? entry.label
            : translate(options, entry.label);
        }
      }
    }
  }
  return str(value);
}

function formatNumber(
  config: Readonly<Record<string, unknown>>,
  value: unknown,
  defaultPrecision: number
): string | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const precision = config["precision"];
  const digits = typeof precision === "number" && precision >= 0 ? precision : defaultPrecision;
  const body = digits > 0 ? parsed.toFixed(digits) : String(Math.trunc(parsed));
  const prefix = str(config["prefix"]);
  const postfix = str(config["postfix"]);
  return `${prefix}${body}${postfix ? ` ${postfix}` : ""}`;
}

/** `precision` → the `Intl` fields the engine's own `strftime` would show. */
function formatTimestamp(
  seconds: number,
  precision: string,
  locale: string | undefined
): string {
  const date = new Date(seconds * 1000);
  switch (precision) {
    case "year":
      return new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
    case "month":
      return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(date);
    case "datetime":
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    default:
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
  }
}

/**
 * A submitted value, as a person reads it — or `undefined` when there is
 * nothing to show (blank) or nothing this build can read (an unknown type).
 * The two cases are distinguished by {@link isBlank}, so a caller can say
 * "not specified" for one and name the type for the other.
 */
export function formatFeatureValue(
  feature: FeatureDef,
  dto: FeatureValueDto | undefined,
  options?: FormatOptions
): string | undefined {
  const type = featureType(feature);
  if (type === "header" || dto === undefined || isBlank(dto.value)) return undefined;
  const config = featureConfig(feature);
  const value = dto.value;

  switch (type) {
    case "string":
      return `${str(config["prefix"])}${str(value)}${
        str(config["postfix"]) ? ` ${str(config["postfix"])}` : ""
      }`;
    case "int":
      return formatNumber(config, value, 0);
    case "float":
      return formatNumber(config, value, 2);
    case "bool": {
      const on = value === true || value === 1 || value === "true";
      const label = str(config[on ? "trueLabel" : "falseLabel"]);
      if (label.length > 0) return translate(options, label);
      return on ? "✓" : "—";
    }
    case "select": {
      const items = Array.isArray(value) ? value : [value];
      return items.map((item) => labelOf(config, item, options)).join(", ");
    }
    case "hierarchical_select": {
      const path = Array.isArray(value) ? value : [value];
      return path.map((step) => str(step)).join(" / ");
    }
    case "date": {
      const seconds =
        typeof value === "number"
          ? Math.trunc(value)
          : typeof value === "string" && /^-?\d+$/.test(value.trim())
            ? Number.parseInt(value.trim(), 10)
            : undefined;
      if (seconds === undefined) return undefined;
      return formatTimestamp(seconds, str(config["precision"]) || "date", options?.locale);
    }
    case "hex_color": {
      if (value === null || typeof value !== "object") return undefined;
      const entry = value as { hex?: unknown; simple?: unknown; label?: unknown };
      if (typeof entry.label === "string" && entry.label.length > 0) {
        return translate(options, entry.label);
      }
      return str(entry.simple) || str(entry.hex) || undefined;
    }
    case "convertible_unit": {
      const parsed = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(parsed)) return undefined;
      const digits = typeof config["precision"] === "number" ? config["precision"] : 2;
      const unit = str(dto["unit"]) || str(config["unit_m"]) || str(config["unit_i"]);
      const body = `${str(config["prefix"])}${parsed.toFixed(digits)}`;
      return unit ? `${body} ${unit}` : body;
    }
    default:
      return undefined;
  }
}

/** The `#RRGGBB` a `hex_color` value carries, when it carries one — the swatch
 * a display skin paints beside the label. */
export function hexColorSwatch(dto: FeatureValueDto | undefined): string | undefined {
  const value = dto?.value;
  if (value === null || value === undefined || typeof value !== "object") return undefined;
  const hex = (value as { hex?: unknown }).hex;
  return typeof hex === "string" && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(hex.trim())
    ? hex.trim()
    : undefined;
}
