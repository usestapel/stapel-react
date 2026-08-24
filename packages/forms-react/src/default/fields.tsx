/**
 * The antd BUILTIN field widgets — one per attribute kind stapel-forms allows
 * (`STAPEL_FORMS["FIELD_KINDS"]`, ten of them).
 *
 * ── Where these sit in the resolution ladder ───────────────────────────────
 *
 *   explicit `registerFormFieldWidget(kind, …)`  ← a host's, always wins
 *   → this table                                  ← the skin's default
 *   → the unsupported-field notice                ← loud, never silent
 *
 * The host's registration outranks the skin's builtin, mirroring docs-react's
 * `DocSurface`, so "override without fork" is real and not a slogan: a host
 * that dislikes this `select` replaces it in one line and keeps every other
 * widget.
 *
 * ── Two deliberate departures from the spec's widget sketch ────────────────
 *
 * 1. **`date` uses a native `<input type=…>`, not antd's `DatePicker`.**
 *    `DatePicker` speaks Dayjs objects, which would make `dayjs` a runtime
 *    dependency of this pair for exactly one widget — and would put a
 *    format-guessing step between the person and the wire, where today the
 *    native control hands over the ISO string
 *    (`YYYY-MM-DD` / `YYYY-MM` / `YYYY-MM-DDTHH:mm`) that the attributes date
 *    type already parses. The `precision` config selects the input type, so
 *    "year only" is a number and "datetime" is a datetime-local. A host that
 *    wants the antd picker registers it — that is what the seam is for.
 *
 * 2. **`select` renders `Segmented` at ≤4 single-choice options, else
 *    `Select`** — the profiles-react `FieldRow` threshold, kept identical so
 *    the fleet's forms and its settings screens read the same way.
 *
 * Values are BARE SCALARS. The server normalizes a single `select` answer to
 * a list, so no widget wraps its own value; the one exception is
 * `convertible_unit`, whose wire DTO genuinely is an object
 * (`{type, value, unit}` — `stapel_attributes.types.convertible_unit.dto`).
 */
import { spacing } from "@stapel/tokens";
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
import type { FormFieldDef } from "../api/types.js";
import type { FormFieldWidget, FormFieldWidgetProps } from "../widgets/registry.js";
import { optionValues } from "../widgets/validate.js";
import { UNIT_SELECT_WIDTH } from "./geometry.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/** At or below this many choices a single-select renders as a `Segmented`
 * (the profiles-react threshold — kept identical on purpose). */
const SEGMENTED_MAX_OPTIONS = 4;

/**
 * antd's `status` prop under `exactOptionalPropertyTypes` does not accept
 * `undefined` — it wants the key ABSENT. Spread this instead of passing
 * `status={error ? "error" : undefined}`, which every control in this file
 * would otherwise have to spell out.
 */
function errorStatus(
  error: unknown
): { status: "error" } | Record<string, never> {
  return error ? { status: "error" } : {};
}

function config(field: FormFieldDef): Readonly<Record<string, unknown>> {
  return field.config ?? {};
}

function numberish(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

/** `{value, label}` choices for antd, from either option shape the attributes
 * types allow (bare scalars, or `{value, label}` objects). */
function choiceList(
  field: FormFieldDef
): readonly { value: string; label: string }[] {
  const raw = config(field)["options"];
  if (!Array.isArray(raw)) return [];
  return raw.map((option) => {
    if (option !== null && typeof option === "object") {
      const entry = option as { value?: unknown; label?: unknown };
      const value = str(entry.value);
      return { value, label: entry.label == null ? value : str(entry.label) };
    }
    return { value: str(option), label: str(option) };
  });
}

// ── string ───────────────────────────────────────────────────────────────────

/**
 * `string` → `Input`, or `Input.TextArea` when `config.multiline` is set
 * (stapel-attributes 0.4.6). Absent means single-line, which is what every
 * schema published before that release carries — so nothing stored needs a
 * migration and the widget needs no fallback heuristic.
 */
const StringWidget: FormFieldWidget = (props: FormFieldWidgetProps) => {
  const cfg = config(props.field);
  const maxLength = numberish(cfg["maxLength"]);
  const placeholder = str(cfg["placeholder"]);
  const common = {
    id: props.id,
    value: str(props.value),
    disabled: props.disabled,
    ...errorStatus(props.error),
    ...(maxLength !== undefined ? { maxLength } : {}),
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

function makeNumberWidget(isInt: boolean): FormFieldWidget {
  const Widget = (props: FormFieldWidgetProps): ReactElement => {
    const cfg = config(props.field);
    const min = numberish(cfg["min"]);
    const max = numberish(cfg["max"]);
    const precision = isInt ? 0 : numberish(cfg["precision"]);
    const placeholder = str(cfg["placeholder"]);
    return (
      <InputNumber
        id={props.id}
        style={{ width: "100%" }}
        value={numberish(props.value) ?? null}
        disabled={props.disabled}
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
  Widget.displayName = isInt ? "IntWidget" : "FloatWidget";
  return Widget;
}

// ── bool ─────────────────────────────────────────────────────────────────────

/** `bool` → `Switch`, labelled with the config's own `trueLabel`/`falseLabel`
 * when the admin supplied them. */
const BoolWidget: FormFieldWidget = (props: FormFieldWidgetProps) => {
  const t = useT();
  const cfg = config(props.field);
  const on = props.value === true;
  const trueLabel = str(cfg["trueLabel"]) || t(FORMS_I18N_KEYS.fillBoolYes);
  const falseLabel = str(cfg["falseLabel"]) || t(FORMS_I18N_KEYS.fillBoolNo);
  return (
    <Flex align="center" gap={spacing[2]}>
      <Switch
        id={props.id}
        checked={on}
        disabled={props.disabled}
        onChange={(checked) => props.onChange(checked)}
      />
      <Typography.Text type="secondary">
        {on ? trueLabel : falseLabel}
      </Typography.Text>
    </Flex>
  );
};

// ── select ───────────────────────────────────────────────────────────────────

/**
 * `select` → `Segmented` for a small single choice, `Select` otherwise
 * (multiple when the config allows more than one).
 *
 * `maxSelected` absent means UNLIMITED — that is the engine's own
 * `SelectConfig` default, and reading an absent key as 1 would silently turn
 * every unconfigured select into a single-choice control.
 */
const SelectWidget: FormFieldWidget = (props: FormFieldWidgetProps) => {
  const t = useT();
  const cfg = config(props.field);
  const choices = choiceList(props.field);
  const maxSelected = numberish(cfg["maxSelected"]);
  const multiple = maxSelected === undefined || maxSelected > 1;

  if (!multiple && choices.length > 0 && choices.length <= SEGMENTED_MAX_OPTIONS) {
    const current = str(Array.isArray(props.value) ? props.value[0] : props.value);
    return (
      <Segmented<string>
        id={props.id}
        options={[...choices]}
        value={current}
        disabled={props.disabled}
        {...errorStatus(props.error)}
        onChange={(next) => props.onChange(next)}
      />
    );
  }

  const value = multiple
    ? (Array.isArray(props.value) ? props.value : props.value == null ? [] : [props.value]).map(
        str
      )
    : str(Array.isArray(props.value) ? props.value[0] : props.value) || undefined;

  return (
    <Select
      id={props.id}
      style={{ width: "100%" }}
      options={[...choices]}
      disabled={props.disabled}
      {...errorStatus(props.error)}
            placeholder={t(FORMS_I18N_KEYS.fillSelectPlaceholder)}
      {...(multiple ? { mode: "multiple" as const } : {})}
      {...(multiple && maxSelected !== undefined ? { maxCount: maxSelected } : {})}
      // `allowCustom` is the engine's word for "a value outside options is
      // acceptable"; antd's word for the same affordance is a tags mode.
      {...(cfg["allowCustom"] === true && multiple
        ? { mode: "tags" as const }
        : {})}
      value={value}
      onChange={(next: unknown) => props.onChange(next)}
    />
  );
};

// ── date ─────────────────────────────────────────────────────────────────────

/** `precision` → the native input type that produces exactly the ISO string
 * the attributes date type parses. */
const DATE_INPUT_TYPE: Readonly<Record<string, string>> = {
  month: "month",
  date: "date",
  datetime: "datetime-local",
};

const DateWidget: FormFieldWidget = (props: FormFieldWidgetProps) => {
  const cfg = config(props.field);
  const precision = str(cfg["precision"]) || "date";

  // "Year only" is a number, not a date: a date input would force a month and
  // a day the admin explicitly said they do not want.
  if (precision === "year") {
    return (
      <InputNumber
        style={{ width: "100%" }}
        value={numberish(props.value) ?? null}
        disabled={props.disabled}
        {...errorStatus(props.error)}
                step={1}
        precision={0}
        onChange={(next) => props.onChange(next ?? undefined)}
      />
    );
  }

  return (
    <Input
      id={props.id}
      type={DATE_INPUT_TYPE[precision] ?? "date"}
      value={str(props.value)}
      disabled={props.disabled}
      {...errorStatus(props.error)}
            {...(str(cfg["minDate"]).length > 0 ? { min: str(cfg["minDate"]) } : {})}
      {...(str(cfg["maxDate"]).length > 0 ? { max: str(cfg["maxDate"]) } : {})}
      onChange={(event) => props.onChange(event.target.value || undefined)}
    />
  );
};

// ── header ───────────────────────────────────────────────────────────────────

/**
 * `header` → a caption, and NOT a control.
 *
 * It never calls `onChange`: the engine regenerates a header's DAO from its
 * config and stapel-forms rejects an answer to one outright (backend delta
 * note 1), so a header that could hold a value would only ever produce a
 * refused submit. `config.style` is `l` (H1) or `m` (H2) — with the upstream
 * default `"h2"` matching NEITHER (LN-B01, preserved), which is why anything
 * that is not `l` reads as H2 rather than being looked up.
 */
const HeaderWidget: FormFieldWidget = (props: FormFieldWidgetProps) => {
  const level = str(config(props.field)["style"]) === "l" ? 3 : 4;
  return (
    <Typography.Title level={level} style={{ marginBottom: 0 }}>
      {props.field.name ?? ""}
    </Typography.Title>
  );
};

// ── hex_color ────────────────────────────────────────────────────────────────

const HexColorWidget: FormFieldWidget = (props: FormFieldWidgetProps) => {
  const presets = useMemo(() => {
    const values = optionValues(props.field) ?? [];
    return values.length > 0
      ? [{ label: props.field.name ?? "", colors: values.map(str) }]
      : undefined;
  }, [props.field]);
  const current = str(props.value);
  return (
    // antd's ColorPicker renders no labelable form control and accepts no
    // `id`, so the field row's `<label for>` cannot reach it. The accessible
    // name therefore comes from the trigger's own text (`showText`), and the
    // wrapper carries the id so the label at least resolves to this region.
    <span id={props.id}>
    <ColorPicker
      disabled={props.disabled}
      format="hex"
      {...(presets ? { presets } : {})}
      {...(current.length > 0 ? { value: current } : {})}
      onChange={(color) => props.onChange(color.toHexString())}
      showText
    />
    </span>
  );
};

// ── hierarchical_select ──────────────────────────────────────────────────────

/** `hierarchical_select` → `Cascader`. The config's nested
 * `{value, label, children}` options are already the shape antd wants, and
 * the answer is the path array the engine stores. */
const HierarchicalSelectWidget: FormFieldWidget = (props: FormFieldWidgetProps) => {
  const t = useT();
  const raw = config(props.field)["options"];
  const options = Array.isArray(raw) ? raw : [];
  const value = Array.isArray(props.value) ? props.value.map(str) : undefined;
  return (
    <Cascader
      id={props.id}
      style={{ width: "100%" }}
      options={options as never}
      disabled={props.disabled}
      {...errorStatus(props.error)}
            placeholder={t(FORMS_I18N_KEYS.fillSelectPlaceholder)}
      {...(value ? { value } : {})}
      onChange={(next: unknown) => props.onChange(next ?? undefined)}
    />
  );
};

// ── convertible_unit ─────────────────────────────────────────────────────────

/**
 * `convertible_unit` → a number beside the unit it is expressed in.
 *
 * The one widget whose value is an OBJECT, because its wire DTO is:
 * `{type: "convertible_unit", value, unit}` — the number as typed, tagged
 * with which of the config's `unit_m` (metric) / `unit_i` (imperial) codes it
 * is in. The server converts to the family's base unit before validating, so
 * the widget must send the unit and must NOT convert anything itself.
 *
 * This kind has no upstream `config_form()` declaration, so it ships
 * BUILDER-LESS (spec §12 risk 5) — it renders and submits correctly, it just
 * cannot be configured in `<FormBuilderPane>`.
 */
const ConvertibleUnitWidget: FormFieldWidget = (props: FormFieldWidgetProps) => {
  const cfg = config(props.field);
  const units = [str(cfg["unit_m"]), str(cfg["unit_i"])].filter(
    (code) => code.length > 0
  );
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
      type: "convertible_unit",
      value: nextAmount,
      ...(nextUnit.length > 0 ? { unit: nextUnit } : {}),
    });
  };

  return (
    <Flex gap={spacing[2]}>
      <InputNumber
        id={props.id}
        style={{ flex: 1 }}
        value={amount ?? null}
        disabled={props.disabled}
        {...errorStatus(props.error)}
                {...(precision !== undefined ? { precision } : {})}
        onChange={(next) => emit(next ?? undefined, unit)}
      />
      {units.length > 0 && (
        <Select
          style={{ width: UNIT_SELECT_WIDTH }}
          disabled={props.disabled}
          {...errorStatus(props.error)}
          value={unit}
          options={units.map((code) => ({ value: code, label: code }))}
          onChange={(next) => emit(amount, next)}
        />
      )}
    </Flex>
  );
};

/**
 * The skin's builtin widget per kind — the second rung of the ladder. A kind
 * absent from this table has no default drawing and reaches the
 * unsupported-field notice.
 */
export const BUILTIN_FIELD_WIDGETS: Readonly<Record<string, FormFieldWidget>> = {
  string: StringWidget,
  int: makeNumberWidget(true),
  float: makeNumberWidget(false),
  bool: BoolWidget,
  select: SelectWidget,
  date: DateWidget,
  header: HeaderWidget,
  hex_color: HexColorWidget,
  hierarchical_select: HierarchicalSelectWidget,
  convertible_unit: ConvertibleUnitWidget,
};

/** The kinds this skin can draw — handed to `<FormFill>` so the headless
 * layer can judge `unsupportedKinds` without importing the skin. */
export const BUILTIN_FIELD_KINDS: readonly string[] =
  Object.keys(BUILTIN_FIELD_WIDGETS).sort();
