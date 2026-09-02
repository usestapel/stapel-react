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
import { featureConfig, featureName, featureType } from "./types.js";
import { groupChildren, isBlank } from "./validate.js";

/** The types this module can render, sorted — the display half of the
 * builtin set, and asserted equal to the editor half in `contract.test.ts`
 * (a type you can fill in but cannot read back is a half-shipped type). */
export const FORMATTABLE_TYPES: readonly string[] = [
  "bool",
  "convertible_unit",
  "date",
  "float",
  "group",
  "header",
  "hex_color",
  "hierarchical_select",
  "int",
  "ref_hierarchical_select",
  "ref_select",
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

/** A config string the engine declares to be a translation key
 * (`prefix`/`postfix`/`postfix1000`/`trueLabel`/`falseLabel`), resolved — or
 * `""` when it is absent. Unlike an option label there is no
 * `translatable_options` flag on these: upstream's `get_translation_keys`
 * collects them unconditionally. */
function translateConfig(options: FormatOptions | undefined, raw: unknown): string {
  const text = str(raw);
  return text.length === 0 ? "" : translate(options, text);
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

/**
 * A `hierarchical_select` path of stored VALUES → the labels the catalogue
 * gave them, walking the option tree level by level. A step the tree does not
 * contain keeps its raw value: the stored answer is the truth, and a
 * reconfigured category must not make an old listing print a blank.
 */
function hierarchicalPathLabels(
  config: Readonly<Record<string, unknown>>,
  path: readonly unknown[],
  options: FormatOptions | undefined
): readonly string[] {
  const translatable = config["translatable_options"] !== false;
  let level: readonly unknown[] = Array.isArray(config["options"]) ? config["options"] : [];
  return path.map((step) => {
    const wanted = str(step);
    const found = level.find(
      (option) =>
        option !== null &&
        typeof option === "object" &&
        str((option as { value?: unknown }).value) === wanted
    ) as { label?: unknown; children?: unknown } | undefined;
    level = found !== undefined && Array.isArray(found.children) ? found.children : [];
    const label = str(found?.label);
    if (label.length === 0 || label === wanted) return wanted;
    return translatable ? translate(options, label) : label;
  });
}

/**
 * A vocabulary-backed value, read from the DAO's LABEL SNAPSHOT.
 *
 * `ref_select`/`ref_hierarchical_select` store term CODES; the words live in a
 * vocabulary this package cannot reach and must not need to. So `dto_to_dao`
 * snapshots `labels` beside `value` at write time (an unknown code labels as
 * itself), and display reads that — no resolver, no second request, and a
 * listing keeps printing the model it was published with even if the
 * catalogue is later re-imported.
 *
 * Where the snapshot IS: a DAO row hands `labels` either on the value
 * envelope or, once a host has split the row into `(FeatureDef, dto)` the way
 * `@stapel/listings-react`'s `featureFromDao` does, in the config. Both are
 * read, in that order.
 *
 * Fallback is the CODES, exactly as the engine falls back
 * (`labels if len(labels) == len(codes) else codes`): a partial snapshot is
 * not a partial answer, and printing three labels for four codes would
 * silently drop a term.
 */
function refLabels(
  config: Readonly<Record<string, unknown>>,
  dto: FeatureValueDto,
  codes: readonly string[]
): readonly string[] {
  const raw = dto["labels"] ?? config["labels"];
  if (!Array.isArray(raw) || raw.length !== codes.length) return codes;
  return raw.map((one) => str(one));
}

function formatNumber(
  config: Readonly<Record<string, unknown>>,
  value: unknown,
  kind: "int" | "float",
  options: FormatOptions | undefined
): string | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const precision = config["precision"];
  // The engines' own defaults (`types/int/type.py` and `types/float/type.py`:
  // `precision if … is not None else 1` / `else 2`).
  const digits =
    typeof precision === "number" && precision >= 0
      ? precision
      : kind === "int"
        ? 1
        : 2;
  // `prefix`/`postfix`/`postfix1000` are TRANSLATION KEYS upstream
  // (`types/int/type.py:get_translation_keys` collects all three), so they go
  // through the host's catalogue like an option label — a Russian storefront
  // was reading "L" and "each" in English off the spec table.
  const prefix = translateConfig(options, config["prefix"]);
  const postfix1000 = str(config["postfix1000"]);
  // The engine switches unit AND scale at exactly a thousand
  // (`format_value`: `value / 1000`, trailing zeros stripped, `postfix1000`
  // as the unit). A display that showed "1500 g" where the server writes
  // "1.5 kg" is the same value said two ways.
  if (postfix1000.length > 0 && Math.abs(parsed) >= 1000) {
    const scaled = (parsed / 1000).toFixed(digits).replace(/\.?0+$/, "");
    return `${prefix}${scaled} ${translateConfig(options, postfix1000)}`;
  }
  // `precision` drives ONLY the scaled branch of an int. The engine's plain
  // branch is `str(value)` — an integer never grows a decimal tail, whatever
  // the config says (D26: a live category shipped `precision: 1` on a year
  // field and the card read "2024.0"). A float's plain branch keeps its
  // configured decimals — that IS its contract.
  const body =
    kind === "int" ? String(Math.trunc(parsed)) : parsed.toFixed(digits);
  const postfix = translateConfig(options, config["postfix"]);
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
    case "string": {
      const prefix = translateConfig(options, config["prefix"]);
      const postfix = translateConfig(options, config["postfix"]);
      return `${prefix}${str(value)}${postfix ? ` ${postfix}` : ""}`;
    }
    case "int":
      return formatNumber(config, value, "int", options);
    case "float":
      return formatNumber(config, value, "float", options);
    case "bool": {
      const on = value === true || value === 1 || value === "true";
      const label = translateConfig(options, config[on ? "trueLabel" : "falseLabel"]);
      if (label.length > 0) return label;
      return on ? "✓" : "—";
    }
    case "select": {
      const items = Array.isArray(value) ? value : [value];
      return items.map((item) => labelOf(config, item, options)).join(", ");
    }
    case "ref_select": {
      const codes = (Array.isArray(value) ? value : [value]).map(str);
      return refLabels(config, dto, codes).join(", ");
    }
    case "ref_hierarchical_select": {
      const codes = (Array.isArray(value) ? value : [value]).map(str);
      // " / " and not ", ": the value is a PATH down the vocabulary's levels,
      // and the separator is what says so — the same one the engine uses.
      return refLabels(config, dto, codes).join(" / ");
    }
    case "hierarchical_select": {
      const path = Array.isArray(value) ? value : [value];
      // The stored value is the path of option VALUES; the labels live in the
      // config's tree. Printing the values gave a detail page reading
      // "passenger / sedan" — the storage keys, in English, whatever the
      // catalogue called them (visual class C-RAWKEY).
      return hierarchicalPathLabels(config, path, options).join(" / ");
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
    case "group": {
      // The stored value is a list of ROWS, each row an object keyed by child
      // slug whose cells are the children's own DAOs. Every cell is formatted
      // by its child's own type, so the composite adds no display rules of its
      // own — and a cell whose child the config no longer declares keeps its
      // raw value rather than printing a blank (the stored answer is the
      // truth, and a reconfigured category must not erase an old listing).
      const rows = Array.isArray(value) ? value : [];
      const children = new Map(groupChildren(config).map((child) => [child.slug, child]));
      const lines: string[] = [];
      for (const row of rows) {
        if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
        const cells: string[] = [];
        for (const [slug, cell] of Object.entries(row as Record<string, unknown>)) {
          const child = children.get(slug);
          // A stored cell is the child's own DAO (`{type, value, name, …}`);
          // a cell held by the composer is the bare value. `hex_color` and
          // `convertible_unit` are objects themselves, so the test is the
          // `value` KEY, not "is an object".
          const envelope =
            cell !== null && typeof cell === "object" && !Array.isArray(cell) && "value" in cell;
          const entry = (envelope ? cell : { type: "", value: cell }) as FeatureValueDto;
          const label = str((entry as Record<string, unknown>)["name"]) ||
            (child === undefined ? slug : featureName(child));
          const text =
            (child === undefined ? undefined : formatFeatureValue(child, entry, options)) ??
            str(entry.value);
          cells.push(`${label}: ${text}`);
        }
        if (cells.length > 0) lines.push(cells.join(", "));
      }
      return lines.length > 0 ? lines.join("; ") : undefined;
    }
    case "convertible_unit": {
      const parsed = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(parsed)) return undefined;
      const digits = typeof config["precision"] === "number" ? config["precision"] : 2;
      const unit = str(dto["unit"]) || str(config["unit_m"]) || str(config["unit_i"]);
      const body = `${translateConfig(options, config["prefix"])}${parsed.toFixed(digits)}`;
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
