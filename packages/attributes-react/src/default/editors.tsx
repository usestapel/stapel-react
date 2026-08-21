/**
 * The antd BUILTIN value editors — one per value type `stapel_attributes`
 * ships (`types/`: ten of them).
 *
 * ── Where these sit in the resolution ladder ───────────────────────────────
 *
 *   explicit `registerValueEditor(type, …)`   ← a host's, always wins
 *   → this table                               ← the skin's default
 *   → `<UnsupportedValueEditor/>`              ← loud, never silent
 *
 * ── These are NOT forms-react's widgets, and the differences are the point ─
 *
 * Both packages draw "the ten types", and it would be easy to assume one is a
 * copy of the other. They are not: forms-react keys on `FormField.kind` (the
 * admin CONFIG form) while this keys on `config.type` (the VALUE), and three
 * of the ten have a genuinely different value shape on this axis:
 *
 *  - **`date` is a Unix timestamp (integer)**, not an ISO string
 *    (`types/date/dto.py`: `value: Optional[int]  # Unix timestamp`, and
 *    `validate_dto` refuses a non-int outright). The control is still a
 *    native input — dayjs for one widget is not worth a runtime dependency —
 *    but it converts in both directions.
 *  - **`hex_color` is an OBJECT** `{simple, hex?, label?}` where `simple` is
 *    REQUIRED and drawn from a closed vocabulary of eighteen colour
 *    categories (`types/hex_color/constants.py`). A bare `#RRGGBB` string
 *    fails validation, so the editor is a category picker with an optional
 *    exact-colour swatch, not a bare `ColorPicker`.
 *  - **`select` is always a LIST**, even when `maxSelected: 1`
 *    (`types/select/dto.py`: `value: List[str]`). A single choice is a
 *    one-element array, and `Segmented`'s scalar is wrapped on the way out.
 *
 * `convertible_unit` is the fourth object-valued type (`{value, unit}`), and
 * the editor must NOT convert anything itself: the server converts the number
 * from the submitted unit into the family's base unit before validating.
 */
import { useMemo } from "react";
import type { ReactElement } from "react";
import {
  Cascader,
  ColorPicker,
  Flex,
  Input,
  InputNumber,
  Segmented,
  Select,
  Switch,
  Typography,
} from "antd";
import { useT } from "@stapel/core";
import type { ValueEditor, ValueEditorProps } from "../registry.js";
import { featureConfig, featureName } from "../types.js";
import type { FeatureConfig } from "../types.js";
import { SIMPLE_COLORS } from "../validate.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";

/** At or below this many choices a single-select renders as a `Segmented` —
 * the profiles-react / forms-react threshold, kept identical on purpose. */
const SEGMENTED_MAX_OPTIONS = 4;

/**
 * antd's `status` prop under `exactOptionalPropertyTypes` does not accept
 * `undefined` — it wants the key ABSENT. Spread this instead of passing
 * `status={error ? "error" : undefined}`.
 */
function errorStatus(error: unknown): { status: "error" } | Record<string, never> {
  return error ? { status: "error" } : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function numberish(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function configOf(props: ValueEditorProps): FeatureConfig {
  return featureConfig(props.feature);
}

/** `{value, label}` choices from either option shape the engine allows, with
 * labels resolved through the host's catalogue when `translatable_options`
 * is on (its default). */
function useChoices(
  config: FeatureConfig
): readonly { value: string; label: string }[] {
  const t = useT();
  return useMemo(() => {
    const raw = config["options"];
    if (!Array.isArray(raw)) return [];
    const translatable = config["translatable_options"] !== false;
    return raw.map((option) => {
      if (option !== null && typeof option === "object") {
        const entry = option as { value?: unknown; label?: unknown };
        const value = str(entry.value);
        const label = str(entry.label) || value;
        return { value, label: translatable && label !== value ? t(label) : label };
      }
      return { value: str(option), label: str(option) };
    });
  }, [config, t]);
}

// ── string ───────────────────────────────────────────────────────────────────

/** `string` → `Input`, or `Input.TextArea` when `config.multiline` is set. */
const StringEditor: ValueEditor = (props: ValueEditorProps) => {
  const cfg = configOf(props);
  const placeholder = str(cfg["placeholder"]);
  // `config.maxLength` is deliberately NOT passed to the control as a hard
  // cap: the engine counts Unicode CODE POINTS and the DOM's `maxlength`
  // counts UTF-16 code units, so a hard cap would stop a person two emoji
  // short of the real limit with no explanation. The mirror reports the
  // actual limit, in the actual unit, when it is actually exceeded.
  const common = {
    id: props.id,
    value: str(props.value),
    disabled: props.disabled === true,
    ...errorStatus(props.error),
    ...(placeholder.length > 0 ? { placeholder } : {}),
  };
  return cfg["multiline"] === true ? (
    <Input.TextArea
      {...common}
      autoSize={{ minRows: 3, maxRows: 8 }}
      onChange={(event) => props.onChange(event.target.value)}
    />
  ) : (
    <Input {...common} onChange={(event) => props.onChange(event.target.value)} />
  );
};

// ── int / float ──────────────────────────────────────────────────────────────

function makeNumberEditor(isInt: boolean): ValueEditor {
  const Editor = (props: ValueEditorProps): ReactElement => {
    const cfg = configOf(props);
    const min = numberish(cfg["min"]);
    const max = numberish(cfg["max"]);
    // `int`'s `precision` is a DISPLAY hint upstream (it defaults to 1 and
    // means "significant step", not "decimal places"), so an integer control
    // pins 0 decimals rather than reading it — reading it would let an `int`
    // field accept `1.0` and then silently truncate server-side.
    const precision = isInt ? 0 : numberish(cfg["precision"]);
    const placeholder = str(cfg["placeholder"]);
    return (
      <InputNumber
        id={props.id}
        style={{ width: "100%" }}
        value={numberish(props.value) ?? null}
        disabled={props.disabled === true}
        {...errorStatus(props.error)}
        {...(min !== undefined ? { min } : {})}
        {...(max !== undefined ? { max } : {})}
        {...(precision !== undefined ? { precision } : {})}
        {...(isInt ? { step: 1 } : {})}
        {...(placeholder.length > 0 ? { placeholder } : {})}
        {...(str(cfg["prefix"]).length > 0 ? { prefix: str(cfg["prefix"]) } : {})}
        {...(str(cfg["postfix"]).length > 0 ? { suffix: str(cfg["postfix"]) } : {})}
        onChange={(next) => props.onChange(next ?? undefined)}
      />
    );
  };
  Editor.displayName = isInt ? "IntValueEditor" : "FloatValueEditor";
  return Editor;
}

// ── bool ─────────────────────────────────────────────────────────────────────

const BoolEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const on = props.value === true;
  const trueLabel = str(cfg["trueLabel"]) || t(ATTRIBUTES_I18N_KEYS.boolYes);
  const falseLabel = str(cfg["falseLabel"]) || t(ATTRIBUTES_I18N_KEYS.boolNo);
  return (
    <Flex align="center" gap={8}>
      <Switch
        id={props.id}
        checked={on}
        disabled={props.disabled === true}
        onChange={(checked) => props.onChange(checked)}
      />
      <Typography.Text type="secondary">{on ? trueLabel : falseLabel}</Typography.Text>
    </Flex>
  );
};

// ── select ───────────────────────────────────────────────────────────────────

/**
 * `select` → `Segmented` for a small single choice, `Select` otherwise.
 *
 * The value is a LIST on both branches. `maxSelected` absent means UNLIMITED
 * (the engine's own default); reading an absent key as 1 would silently turn
 * every unconfigured select into a single-choice control.
 */
const SelectEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const choices = useChoices(cfg);
  const maxSelected = numberish(cfg["maxSelected"]);
  const multiple = maxSelected === undefined || maxSelected > 1;
  const current = Array.isArray(props.value) ? props.value.map(str) : [];

  if (
    !multiple &&
    cfg["uiStyle"] !== "dropdown" &&
    choices.length > 0 &&
    choices.length <= SEGMENTED_MAX_OPTIONS
  ) {
    return (
      <Segmented<string>
        id={props.id}
        // antd renders a `radiogroup` div, which a `<label for>` cannot name
        // — so the accessible name comes from the feature itself. Without
        // this the control is announced as "segmented control" and the row's
        // label reaches nothing.
        aria-label={featureName(props.feature)}
        options={[...choices]}
        value={current[0] ?? ""}
        disabled={props.disabled === true}
        onChange={(next) => props.onChange(next.length > 0 ? [next] : undefined)}
      />
    );
  }

  return (
    <Select
      id={props.id}
      style={{ width: "100%" }}
      options={[...choices]}
      disabled={props.disabled === true}
      {...errorStatus(props.error)}
      placeholder={t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)}
      mode="multiple"
      {...(maxSelected !== undefined ? { maxCount: maxSelected } : {})}
      value={current}
      onChange={(next: readonly string[]) =>
        props.onChange(next.length > 0 ? [...next] : undefined)
      }
    />
  );
};

// ── date ─────────────────────────────────────────────────────────────────────

/** `precision` → the native input type whose value converts cleanly to and
 * from the Unix timestamp the engine stores. */
const DATE_INPUT_TYPE: Readonly<Record<string, string>> = {
  month: "month",
  date: "date",
  datetime: "datetime-local",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Unix seconds → the string a native input of this precision displays,
 * in the VIEWER's time zone (which is what the person typed it in). */
export function timestampToInputValue(seconds: number, precision: string): string {
  const d = new Date(seconds * 1000);
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (precision === "month") return ymd.slice(0, 7);
  if (precision === "datetime") return `${ymd}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return ymd;
}

/**
 * The inverse. Takes no `precision`: a native input's value already says
 * which shape it is (`2010`, `2010-06`, `2010-06-15`, `2010-06-15T14:30`), so
 * reading the config here would only create a way for the two to disagree.
 *
 * Returns `undefined` for an empty or unparseable input rather than 0 — `0`
 * is 1970, a real timestamp, and the one value that must never be produced by
 * "the person cleared the field".
 */
export function inputValueToTimestamp(text: string): number | undefined {
  if (text.length === 0) return undefined;
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?(?:T(\d{2}):(\d{2}))?$/.exec(text);
  if (match === null) return undefined;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    month === undefined ? 0 : Number(month) - 1,
    day === undefined ? 1 : Number(day),
    hour === undefined ? 0 : Number(hour),
    minute === undefined ? 0 : Number(minute)
  );
  const seconds = Math.floor(date.getTime() / 1000);
  return Number.isFinite(seconds) ? seconds : undefined;
}

const DateEditor: ValueEditor = (props: ValueEditorProps) => {
  const cfg = configOf(props);
  const precision = str(cfg["precision"]) || "date";
  const current = numberish(props.value);

  // "Year only" is a number, not a date: a date input would force a month and
  // a day the admin explicitly said they do not want. The value on the wire
  // is still a timestamp — January 1st of that year, local time.
  if (precision === "year") {
    return (
      <InputNumber
        id={props.id}
        style={{ width: "100%" }}
        value={current === undefined ? null : new Date(current * 1000).getFullYear()}
        disabled={props.disabled === true}
        {...errorStatus(props.error)}
        step={1}
        precision={0}
        onChange={(next) =>
          props.onChange(
            next === null || next === undefined
              ? undefined
              : Math.floor(new Date(next, 0, 1).getTime() / 1000)
          )
        }
      />
    );
  }

  const min = numberish(cfg["minDate"]);
  const max = numberish(cfg["maxDate"]);
  return (
    <Input
      id={props.id}
      type={DATE_INPUT_TYPE[precision] ?? "date"}
      value={current === undefined ? "" : timestampToInputValue(current, precision)}
      disabled={props.disabled === true}
      {...errorStatus(props.error)}
      {...(min !== undefined ? { min: timestampToInputValue(min, precision) } : {})}
      {...(max !== undefined ? { max: timestampToInputValue(max, precision) } : {})}
      onChange={(event) =>
        props.onChange(inputValueToTimestamp(event.target.value))
      }
    />
  );
};

// ── header ───────────────────────────────────────────────────────────────────

/**
 * `header` → a caption, and NOT a control.
 *
 * It never calls `onChange`: the engine regenerates a header's DAO from its
 * config and the batch validator skips headers entirely, so a header that
 * could hold a value would only ever produce a refused submit.
 * `config.style` is `l` (larger) or `m`.
 */
const HeaderEditor: ValueEditor = (props: ValueEditorProps) => {
  const level = str(configOf(props)["style"]) === "m" ? 4 : 3;
  return (
    <Typography.Title level={level} style={{ marginBottom: 0 }}>
      {featureName(props.feature)}
    </Typography.Title>
  );
};

// ── hex_color ────────────────────────────────────────────────────────────────

/**
 * `hex_color` → a colour CATEGORY picker, plus an exact swatch when the config
 * allows a custom colour.
 *
 * The value is `{simple, hex?}`. `simple` is required and must be one of the
 * engine's eighteen categories; when the config lists options, `simple` must
 * additionally be one of THOSE unless `allowCustom`. `hex` is optional and
 * only meaningful as a refinement of the category — which is why the picker
 * comes first and the swatch second, rather than the other way round.
 */
const HexColorEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const current =
    props.value !== null && typeof props.value === "object"
      ? (props.value as { simple?: unknown; hex?: unknown })
      : {};
  const simple = str(current.simple);
  const hex = str(current.hex);
  const allowCustom = cfg["allowCustom"] === true;

  const options = useMemo(() => {
    const raw = cfg["options"];
    const declared = Array.isArray(raw)
      ? raw
          .map((option) =>
            option !== null && typeof option === "object"
              ? str((option as { simple?: unknown }).simple)
              : str(option)
          )
          .filter((code) => code.length > 0)
      : [];
    const source = declared.length > 0 && !allowCustom ? declared : SIMPLE_COLORS;
    return source.map((code) => ({ value: code, label: code }));
  }, [cfg, allowCustom]);

  const emit = (nextSimple: string, nextHex: string): void => {
    if (nextSimple.length === 0) {
      props.onChange(undefined);
      return;
    }
    props.onChange({ simple: nextSimple, ...(nextHex.length > 0 ? { hex: nextHex } : {}) });
  };

  return (
    <Flex gap={8} align="center">
      <Select
        id={props.id}
        style={{ flex: 1 }}
        options={options}
        disabled={props.disabled === true}
        {...errorStatus(props.error)}
        placeholder={t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)}
        {...(simple.length > 0 ? { value: simple } : {})}
        onChange={(next: string) => emit(next, hex)}
      />
      {allowCustom && (
        // antd's ColorPicker renders no labelable control and accepts no
        // `id`, so it is the SECONDARY control here and the labelled one is
        // the category select above.
        <ColorPicker
          disabled={props.disabled === true}
          format="hex"
          {...(hex.length > 0 ? { value: hex } : {})}
          onChange={(color) => emit(simple, color.toHexString())}
          showText
        />
      )}
    </Flex>
  );
};

// ── hierarchical_select ──────────────────────────────────────────────────────

interface CascaderOption {
  readonly value: string;
  readonly label: string;
  readonly children?: readonly CascaderOption[];
}

function toCascaderOptions(
  raw: unknown,
  t: (key: string) => string,
  translatable: boolean
): readonly CascaderOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((option) => {
    if (option === null || typeof option !== "object") {
      return { value: str(option), label: str(option) };
    }
    const entry = option as { value?: unknown; label?: unknown; children?: unknown };
    const value = str(entry.value);
    const rawLabel = str(entry.label) || value;
    const children = toCascaderOptions(entry.children, t, translatable);
    return {
      value,
      label: translatable && rawLabel !== value ? t(rawLabel) : rawLabel,
      ...(children.length > 0 ? { children } : {}),
    };
  });
}

/** `hierarchical_select` → `Cascader`. The answer is the path array of
 * `value`s from root to the chosen node, which is exactly what the engine
 * stores and validates level by level. */
const HierarchicalSelectEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const options = useMemo(
    () => toCascaderOptions(cfg["options"], t, cfg["translatable_options"] !== false),
    [cfg, t]
  );
  const value = Array.isArray(props.value) ? props.value.map(str) : undefined;
  return (
    <Cascader
      id={props.id}
      style={{ width: "100%" }}
      options={options as never}
      disabled={props.disabled === true}
      {...errorStatus(props.error)}
      placeholder={t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)}
      changeOnSelect
      {...(value ? { value } : {})}
      onChange={(next: unknown) =>
        props.onChange(Array.isArray(next) && next.length > 0 ? next.map(str) : undefined)
      }
    />
  );
};

// ── convertible_unit ─────────────────────────────────────────────────────────

/**
 * `convertible_unit` → a number beside the unit it is expressed in.
 *
 * The wire DTO is `{type, value, unit}`: the number AS TYPED, tagged with
 * which of the config's `unit_m` (metric) / `unit_i` (imperial) codes it is
 * in. The server converts to the family's base unit before validating, so
 * the editor must send the unit and must NOT convert anything itself — the
 * conversion table lives in Python.
 */
const ConvertibleUnitEditor: ValueEditor = (props: ValueEditorProps) => {
  const cfg = configOf(props);
  const units = [str(cfg["unit_m"]), str(cfg["unit_i"])].filter((code) => code.length > 0);
  const current =
    props.value !== null && typeof props.value === "object"
      ? (props.value as { value?: unknown; unit?: unknown })
      : {};
  const unit = str(current.unit) || units[0] || "";
  const amount = numberish(current.value);
  const precision = numberish(cfg["precision"]);

  const emit = (nextAmount: number | undefined, nextUnit: string): void => {
    if (nextAmount === undefined) {
      props.onChange(undefined);
      return;
    }
    props.onChange({
      value: nextAmount,
      ...(nextUnit.length > 0 ? { unit: nextUnit } : {}),
    });
  };

  return (
    <Flex gap={8}>
      <InputNumber
        id={props.id}
        style={{ flex: 1 }}
        value={amount ?? null}
        disabled={props.disabled === true}
        {...errorStatus(props.error)}
        {...(precision !== undefined ? { precision } : {})}
        {...(str(cfg["prefix"]).length > 0 ? { prefix: str(cfg["prefix"]) } : {})}
        onChange={(next) => emit(next ?? undefined, unit)}
      />
      {units.length > 0 && (
        <Select
          style={{ width: 96 }}
          disabled={props.disabled === true}
          {...errorStatus(props.error)}
          value={unit}
          options={units.map((code) => ({ value: code, label: code }))}
          onChange={(next: string) => emit(amount, next)}
        />
      )}
    </Flex>
  );
};

/**
 * The skin's builtin editor per value type — the second rung of the ladder.
 * A type absent from this table has no default drawing and reaches
 * `<UnsupportedValueEditor/>`.
 */
export const BUILTIN_VALUE_EDITORS: Readonly<Record<string, ValueEditor>> = {
  string: StringEditor,
  int: makeNumberEditor(true),
  float: makeNumberEditor(false),
  bool: BoolEditor,
  select: SelectEditor,
  date: DateEditor,
  header: HeaderEditor,
  hex_color: HexColorEditor,
  hierarchical_select: HierarchicalSelectEditor,
  convertible_unit: ConvertibleUnitEditor,
};

/** The types this skin can draw — handed to `unsupportedTypes` so the
 * headless half can judge renderability without importing the skin. */
export const BUILTIN_VALUE_EDITOR_TYPES: readonly string[] =
  Object.keys(BUILTIN_VALUE_EDITORS).sort();
