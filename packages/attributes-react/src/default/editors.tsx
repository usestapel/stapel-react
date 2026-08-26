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
 * ── The rule this file is now held to ──────────────────────────────────────
 *
 * **A control never offers what the mirror will refuse.** The audit found the
 * editors reading roughly half the config keys `validate.ts` reads: a closed
 * `options` list drawn as a free text box, `allowPast: false` drawn as an
 * unbounded date input, `uiStyle: checkboxes` collapsing to a dropdown on
 * every multi-select. Each one is the same defect — a person types a value the
 * control offered and is told it is not allowed — and each was found by a
 * human reading two files side by side, which is not a mechanism.
 *
 * The mechanism is `test/configKeys.test.ts`: for every value type, the set of
 * `config[...]` keys the MIRROR reads must be a SUBSET of the set this file's
 * editor reads, both extracted from the source. Adding a rule to `validate.ts`
 * without an affordance here is now a red test, by name, with the missing key
 * printed. Two consequences visible below:
 *
 *  - `string` passes `pattern` and `minLength` to the native input and turns
 *    `maxLength` into a code-point COUNTER rather than a cap (the DOM counts
 *    UTF-16 units and the engine counts code points, so a hard cap would stop
 *    a person two emoji short of the real limit with no explanation);
 *  - every options-bearing numeric/string config draws a picker, closed when
 *    `allowCustom === false` and suggesting otherwise.
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
import type { ReactElement, ReactNode } from "react";
import {
  AutoComplete,
  Cascader,
  Checkbox,
  ColorPicker,
  Flex,
  Input,
  InputNumber,
  Radio,
  Segmented,
  Select,
  Switch,
  Typography,
} from "antd";
import { actionBlocked, useI18n, useT } from "@stapel/core";
import { GatedControl, PHONE_CONTROL_HEIGHT, SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { ValueEditor, ValueEditorProps } from "../registry.js";
import { featureConfig, featureName } from "../types.js";
import type { FeatureConfig } from "../types.js";
import { SIMPLE_COLORS, codePointLength } from "../validate.js";
import { formatFeatureValue } from "../format.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";
import { configLabel, optionLabel } from "./labels.js";
import { useTouchFloor } from "./touchFloor.js";

/** At or below this many choices an inline single-select renders as a
 * `Segmented` — the profiles-react / forms-react threshold, kept identical on
 * purpose. Above it, an inline group of radio buttons, which wraps. */
const SEGMENTED_MAX_OPTIONS = 4;

/** The `convertible_unit` unit chooser holds a unit CODE (`m`, `ft`, `mm`),
 * never a word — so its width is measured in characters, not pixels: it
 * follows the type scale instead of contradicting it. */
const UNIT_SELECT_WIDTH = "12ch";

/**
 * The height a chip's LABEL is held to inside a narrow column.
 *
 * antd derives a `Segmented` item from `controlHeight`, and `SkinTheme` only
 * raises that to 44px on a phone VIEWPORT — so the same chips in a composer
 * column a few hundred pixels wide on a desktop measured ~27px in the visual
 * pass. The label is the one part of the control a caller can size, and
 * growing it grows the item: the track adds its own padding on each side,
 * `spacing[1]` in total, so a 40px label is a 44px chip.
 */
const CHIP_LABEL_FLOOR: number = PHONE_CONTROL_HEIGHT - spacing[1];

/** A chip as antd takes it once its label is a node rather than a string. */
interface ChipOption {
  readonly value: string;
  readonly label: ReactNode;
}

/** {@link CHIP_LABEL_FLOOR}, applied to one choice. */
function touchChip(choice: Choice): ChipOption {
  return {
    value: choice.value,
    label: (
      <span
        style={{ display: "inline-flex", alignItems: "center", minHeight: CHIP_LABEL_FLOOR }}
      >
        {choice.label}
      </span>
    ),
  };
}

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

/** `aria-required` for the row's required state, absent when it is not — the
 * asterisk antd draws is decorative and reaches no screen reader. */
function requiredAria(props: ValueEditorProps): { "aria-required": true } | Record<string, never> {
  return props.required === true ? { "aria-required": true } : {};
}

/**
 * A control the CATALOGUE locked (`select.lockUserInput`, `date.lockInput`).
 *
 * Not a bare `disabled`: a switched-off control with nothing beside it is the
 * dead rectangle §83 exists to forbid, and "why can't I change this?" has an
 * answer here — the admin fixed the value. `GatedControl` puts that sentence
 * under the control and wires `aria-describedby` to it. When nothing is
 * locked the wrapper is skipped entirely, so the common case gains no DOM.
 */
function Lockable(props: {
  readonly locked: boolean;
  readonly disabled: boolean;
  readonly children: (bind: {
    readonly disabled: boolean;
    readonly "aria-describedby": string | undefined;
  }) => ReactNode;
}): ReactElement {
  if (!props.locked) {
    return <>{props.children({ disabled: props.disabled, "aria-describedby": undefined })}</>;
  }
  return (
    <GatedControl
      gate={actionBlocked(ATTRIBUTES_I18N_KEYS.lockedByConfig)}
      testId="attributes-locked"
    >
      {(bind) => props.children({ disabled: true, "aria-describedby": bind["aria-describedby"] })}
    </GatedControl>
  );
}

/** One offered choice. A named type, not an inline object literal, because
 * `test/configKeys.test.ts` brace-matches these function bodies out of the
 * source and a `{…}` in a return type is a body it would stop at. */
interface Choice {
  readonly value: string;
  readonly label: string;
}

/** `{value, label}` choices from either option shape the engine allows, with
 * labels resolved through the host's catalogue when `translatable_options`
 * is on (its default). Shared by `string`, `int`/`float` and `select`, which
 * is why all three read `options` and `allowCustom` the same way. */
function useChoices(config: FeatureConfig): readonly Choice[] {
  const t = useT();
  return useMemo(() => {
    const raw = config["options"];
    if (!Array.isArray(raw)) return [];
    return raw.map((option) => {
      if (option !== null && typeof option === "object") {
        const entry = option as { value?: unknown; label?: unknown };
        const value = str(entry.value);
        return { value, label: optionLabel(t, config, entry.label, value) };
      }
      const value = str(option);
      return { value, label: value };
    });
  }, [config, t]);
}

/** Does this config offer a CLOSED list — options present and free entry off?
 * `allowCustom` absent means TRUE for every type that has it (the dataclass
 * default, and `type.py`'s `allowCustom if … is not None else (options is
 * None)`), so an options list alone constrains nothing. */
function isClosedList(config: FeatureConfig, choiceCount: number): boolean {
  return choiceCount > 0 && config["allowCustom"] === false;
}

// ── string ───────────────────────────────────────────────────────────────────

/**
 * `string` → an `Input`, a `TextArea` when `config.multiline`, a closed
 * `Select` when the options are a fixed vocabulary, and an `AutoComplete` when
 * they are suggestions.
 */
const StringEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const choices = useChoices(cfg);
  const closed = isClosedList(cfg, choices.length);
  const placeholder = str(cfg["placeholder"]);
  const value = str(props.value);
  const minLength = numberish(cfg["minLength"]);
  const maxLength = numberish(cfg["maxLength"]);
  const pattern = str(cfg["pattern"]);
  // `prefix`/`postfix` are TRANSLATION KEYS upstream
  // (`types/string/type.py:get_translation_keys`), never literal copy.
  const prefix = configLabel(t, cfg["prefix"]);
  const postfix = configLabel(t, cfg["postfix"]);

  if (closed) {
    return (
      <Select
        id={props.id}
        style={{ width: "100%" }}
        options={[...choices]}
        disabled={props.disabled === true}
        {...errorStatus(props.error)}
        {...requiredAria(props)}
        placeholder={placeholder.length > 0 ? placeholder : t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)}
        showSearch
        optionFilterProp="label"
        {...(value.length > 0 ? { value } : {})}
        onChange={(next: string) => props.onChange(next.length > 0 ? next : undefined)}
      />
    );
  }

  // Chrome shared by every free-entry branch. `value`/`onChange` are NOT here:
  // the `AutoComplete` branch below owns them and clones them onto its child.
  const chrome = {
    disabled: props.disabled === true,
    ...errorStatus(props.error),
    ...requiredAria(props),
    ...(placeholder.length > 0 ? { placeholder } : {}),
    ...(minLength !== undefined ? { minLength } : {}),
    ...(prefix.length > 0 ? { prefix } : {}),
    ...(postfix.length > 0 ? { suffix: postfix } : {}),
    // `config.maxLength` is deliberately NOT a hard cap: the engine counts
    // Unicode CODE POINTS and the DOM's `maxlength` counts UTF-16 code units,
    // so a cap would stop a person two emoji short of the real limit with no
    // explanation. It becomes a live counter IN THE ENGINE'S UNIT instead, and
    // the mirror reports the limit when it is actually exceeded.
    ...(maxLength !== undefined
      ? {
          showCount: {
            formatter: ({ value: text }: { value: string }): string =>
              `${codePointLength(text)} / ${maxLength}`,
          },
        }
      : {}),
  };

  if (cfg["multiline"] === true) {
    return (
      <Input.TextArea
        id={props.id}
        value={value}
        {...chrome}
        autoSize={{ minRows: 3, maxRows: 8 }}
        onChange={(event) => props.onChange(event.target.value)}
      />
    );
  }

  // Options + `allowCustom` (the default): the list is a SUGGESTION, so the
  // control must SHOW it and still take anything typed.
  if (choices.length > 0) {
    return (
      <AutoComplete
        id={props.id}
        options={[...choices]}
        value={value}
        disabled={props.disabled === true}
        style={{ width: "100%" }}
        filterOption={(typed, option) =>
          str(option?.label).toLowerCase().includes(typed.toLowerCase())
        }
        onChange={(next: string) => props.onChange(next.length > 0 ? next : undefined)}
      >
        {/* AutoComplete clones this child and injects value/onChange/disabled
            from the parent above — hence no `value` or `disabled` here. */}
        <Input {...chrome} {...(pattern.length > 0 ? { pattern } : {})} />
      </AutoComplete>
    );
  }

  // A native `pattern` is `re.fullmatch` semantics in the browser — the same
  // anchoring `patternFullMatch` applies in the mirror, from the same string.
  return (
    <Input
      id={props.id}
      value={value}
      {...chrome}
      {...(pattern.length > 0 ? { pattern } : {})}
      onChange={(event) => props.onChange(event.target.value)}
    />
  );
};

// ── int / float ──────────────────────────────────────────────────────────────

function makeNumberEditor(isInt: boolean): ValueEditor {
  const Editor = (props: ValueEditorProps): ReactElement => {
    const t = useT();
    const cfg = configOf(props);
    const choices = useChoices(cfg);
    const closed = isClosedList(cfg, choices.length);
    const min = numberish(cfg["min"]);
    const max = numberish(cfg["max"]);
    // `int`'s `precision` is a DISPLAY hint upstream (it defaults to 1 and
    // means "significant step", not "decimal places"), so an integer control
    // pins 0 decimals rather than reading it — reading it would let an `int`
    // field accept `1.0` and then silently truncate server-side.
    const precision = isInt ? 0 : numberish(cfg["precision"]);
    const placeholder = str(cfg["placeholder"]);
    const current = numberish(props.value);
    // Upstream declares all three as translation keys
    // (`types/int/type.py:get_translation_keys`). `postfix1000` is the unit a
    // value of a thousand or more is READ in ("k", "t"), and the engine swaps
    // to it at exactly that boundary in `format_value` — so the control's
    // suffix follows the number the person is typing.
    const prefix = configLabel(t, cfg["prefix"]);
    const postfix = configLabel(t, cfg["postfix"]);
    const postfix1000 = configLabel(t, cfg["postfix1000"]);
    const suffix =
      postfix1000.length > 0 && current !== undefined && Math.abs(current) >= 1000
        ? postfix1000
        : postfix;

    if (closed) {
      return (
        <Select
          id={props.id}
          style={{ width: "100%" }}
          options={choices.map((choice) => ({
            value: choice.value,
            label: `${prefix}${choice.label}${suffix ? ` ${suffix}` : ""}`,
          }))}
          disabled={props.disabled === true}
          {...errorStatus(props.error)}
          {...requiredAria(props)}
          placeholder={
            placeholder.length > 0 ? placeholder : t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)
          }
          {...(current === undefined ? {} : { value: String(current) })}
          onChange={(next: string) => props.onChange(numberish(next))}
        />
      );
    }

    return (
      <InputNumber
        id={props.id}
        style={{ width: "100%" }}
        value={current ?? null}
        disabled={props.disabled === true}
        {...errorStatus(props.error)}
        {...requiredAria(props)}
        {...(min !== undefined ? { min } : {})}
        {...(max !== undefined ? { max } : {})}
        {...(precision !== undefined ? { precision } : {})}
        {...(isInt ? { step: 1 } : {})}
        {...(placeholder.length > 0 ? { placeholder } : {})}
        {...(prefix.length > 0 ? { prefix } : {})}
        {...(suffix.length > 0 ? { suffix } : {})}
        // Options with free entry: a datalist offers them without closing the
        // control, which is what `allowCustom` (the default) actually means.
        {...(choices.length > 0 ? { "aria-autocomplete": "list" as const } : {})}
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
  // `trueLabel`/`falseLabel` are translation KEYS
  // (`types/bool/type.py:117-123` collects them for the catalogue, and
  // `format_value` falls back to `feature.bool.true`). Rendering them verbatim
  // showed English captions on a Russian storefront.
  const trueLabel = configLabel(t, cfg["trueLabel"]) || t(ATTRIBUTES_I18N_KEYS.boolYes);
  const falseLabel = configLabel(t, cfg["falseLabel"]) || t(ATTRIBUTES_I18N_KEYS.boolNo);
  return (
    <Flex align="center" gap={spacing[2]}>
      <Switch
        id={props.id}
        checked={on}
        disabled={props.disabled === true}
        {...requiredAria(props)}
        onChange={(checked) => props.onChange(checked)}
      />
      <Typography.Text type="secondary">{on ? trueLabel : falseLabel}</Typography.Text>
    </Flex>
  );
};

// ── select ───────────────────────────────────────────────────────────────────

/** `SelectConfig.uiStyle` — `dropdown` is the DEFAULT and, crucially, what an
 * ABSENT key means (`types/select/config.py`). The old
 * `cfg["uiStyle"] !== "dropdown"` test was true for absent, so an unconfigured
 * small single-select rendered inline where the config said dropdown. */
function uiStyleOf(config: FeatureConfig): "dropdown" | "checkboxes" | "chips" {
  const declared = str(config["uiStyle"]);
  return declared === "checkboxes" || declared === "chips" ? declared : "dropdown";
}

/**
 * `select` → a control in the style the CONFIG asked for, on both the single
 * and the multiple branch.
 *
 * The value is a LIST on every branch. `maxSelected` absent means UNLIMITED
 * (the engine's own default); reading an absent key as 1 would silently turn
 * every unconfigured select into a single-choice control.
 *
 * `chips` and `checkboxes` both mean "every option visible, no popup"; they
 * differ only where antd gives them different single-choice controls (a
 * `Segmented` bar versus radio buttons). For a MULTIPLE select antd ships one
 * inline control, `Checkbox.Group`, so both styles reach it — stated here
 * rather than silently, because the alternative is inventing a chip widget
 * that no other pair in the fleet has.
 */
const SelectEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const touchFloor = useTouchFloor();
  const choices = useChoices(cfg);
  const maxSelected = numberish(cfg["maxSelected"]);
  const minSelected = numberish(cfg["minSelected"]) ?? 0;
  const multiple = maxSelected === undefined || maxSelected > 1;
  const style = uiStyleOf(cfg);
  const locked = cfg["lockUserInput"] === true;
  const current = Array.isArray(props.value) ? props.value.map(str) : [];
  const options = [...choices];

  const emit = (next: readonly string[]): void =>
    props.onChange(next.length > 0 ? [...next] : undefined);

  // antd's `Select` has `maxCount` and no minimum, so the floor is said in
  // words beside the control instead of only after a refused submit.
  const minHint =
    minSelected > 0 ? (
      <Typography.Text type="secondary" data-testid="attributes-min-selected">
        {t(ATTRIBUTES_I18N_KEYS.selectMinSelected, { count: minSelected })}
      </Typography.Text>
    ) : null;

  const control = (bind: {
    readonly disabled: boolean;
    readonly "aria-describedby": string | undefined;
  }): ReactElement => {
    if (style !== "dropdown" && !multiple && choices.length > 0) {
      if (choices.length <= SEGMENTED_MAX_OPTIONS && style === "chips") {
        return (
          <Segmented<string>
            id={props.id}
            // antd renders a `radiogroup` div, which a `<label for>` cannot
            // name — so the accessible name comes from the feature itself.
            aria-label={featureName(props.feature)}
            {...(bind["aria-describedby"] !== undefined
              ? { "aria-describedby": bind["aria-describedby"] }
              : {})}
            // A narrow column is a touched one: the chips carry the 44px
            // floor the viewport rule alone would not give them here.
            {...(touchFloor ? { "data-attributes-touch-floor": "" } : {})}
            options={touchFloor ? options.map(touchChip) : options}
            value={current[0] ?? ""}
            disabled={bind.disabled}
            onChange={(next) => emit(next.length > 0 ? [next] : [])}
          />
        );
      }
      return (
        <Radio.Group
          id={props.id}
          aria-label={featureName(props.feature)}
          {...(bind["aria-describedby"] !== undefined
            ? { "aria-describedby": bind["aria-describedby"] }
            : {})}
          options={options}
          {...(style === "chips" ? { optionType: "button" as const } : {})}
          value={current[0] ?? ""}
          disabled={bind.disabled}
          onChange={(event) => emit(event.target.value ? [String(event.target.value)] : [])}
        />
      );
    }

    if (style !== "dropdown" && multiple && choices.length > 0) {
      return (
        <Checkbox.Group
          // `Checkbox.Group` renders a plain `div` and antd's types carry no
          // `id`, so `<label for>` has nothing to point at — the group names
          // itself, exactly as `Segmented` does two branches up.
          aria-label={featureName(props.feature)}
          {...(bind["aria-describedby"] !== undefined
            ? { "aria-describedby": bind["aria-describedby"] }
            : {})}
          options={options}
          value={[...current]}
          disabled={bind.disabled}
          onChange={(next) => emit((next as readonly (string | number | boolean)[]).map(str))}
        />
      );
    }

    const dropdown = {
      id: props.id,
      style: { width: "100%" },
      options,
      disabled: bind.disabled,
      ...errorStatus(props.error),
      ...requiredAria(props),
      ...(bind["aria-describedby"] !== undefined
        ? { "aria-describedby": bind["aria-describedby"] }
        : {}),
      placeholder: t(ATTRIBUTES_I18N_KEYS.selectPlaceholder),
    };
    if (multiple) {
      return (
        <Select
          {...dropdown}
          mode="multiple"
          {...(maxSelected !== undefined ? { maxCount: maxSelected } : {})}
          value={[...current]}
          onChange={(next: readonly string[]) => emit(next)}
        />
      );
    }
    return (
      <Select
        {...dropdown}
        {...(current[0] !== undefined ? { value: current[0] } : {})}
        onChange={(next: string) => emit(next.length > 0 ? [next] : [])}
      />
    );
  };

  return (
    <Flex vertical gap={spacing[1]}>
      <Lockable locked={locked} disabled={props.disabled === true}>
        {control}
      </Lockable>
      {minHint}
    </Flex>
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

/** The tighter of two bounds, either of which may be absent. */
function tightest(
  a: number | undefined,
  b: number | undefined,
  pick: (x: number, y: number) => number
): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return pick(a, b);
}

const DateEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const { locale } = useI18n();
  const cfg = configOf(props);
  const precision = str(cfg["precision"]) || "date";
  const current = numberish(props.value);
  const locked = cfg["lockInput"] === true;

  // `allowFuture`/`allowPast` are enforced by the engine AND by the mirror
  // against "now". They are therefore BOUNDS, and a control that does not
  // carry them offers dates it already knows will be refused.
  const now = Math.floor(Date.now() / 1000);
  const min = tightest(
    numberish(cfg["minDate"]),
    cfg["allowPast"] === false ? now : undefined,
    Math.max
  );
  const max = tightest(
    numberish(cfg["maxDate"]),
    cfg["allowFuture"] === false ? now : undefined,
    Math.min
  );

  // `config.options` is a PICKLIST of timestamps the admin curated (model
  // years, delivery slots). The engine does not range-check against it, but
  // offering a free calendar where a fixed list was configured is the same
  // "control that means something else than the config says" defect.
  const picks = useMemo(() => {
    const raw = cfg["options"];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((option) => numberish(option))
      .filter((seconds): seconds is number => seconds !== undefined)
      .map((seconds) => ({
        value: String(seconds),
        label:
          formatFeatureValue(props.feature, { type: "date", value: seconds }, { t, locale }) ??
          timestampToInputValue(seconds, precision),
      }));
  }, [cfg, props.feature, t, locale, precision]);

  const placeholder = str(cfg["placeholder"]);

  return (
    <Lockable locked={locked} disabled={props.disabled === true}>
      {(bind) => {
        const described =
          bind["aria-describedby"] !== undefined
            ? { "aria-describedby": bind["aria-describedby"] }
            : {};
        if (picks.length > 0) {
          return (
            <Select
              id={props.id}
              style={{ width: "100%" }}
              options={picks}
              disabled={bind.disabled}
              {...errorStatus(props.error)}
              {...requiredAria(props)}
              {...described}
              placeholder={
                placeholder.length > 0 ? placeholder : t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)
              }
              {...(current === undefined ? {} : { value: String(current) })}
              onChange={(next: string) => props.onChange(numberish(next))}
            />
          );
        }

        // "Year only" is a number, not a date: a date input would force a
        // month and a day the admin explicitly said they do not want. The
        // value on the wire is still a timestamp — January 1st, local time.
        if (precision === "year") {
          return (
            <InputNumber
              id={props.id}
              style={{ width: "100%" }}
              value={current === undefined ? null : new Date(current * 1000).getFullYear()}
              disabled={bind.disabled}
              {...errorStatus(props.error)}
              {...requiredAria(props)}
              {...described}
              step={1}
              precision={0}
              {...(min !== undefined ? { min: new Date(min * 1000).getFullYear() } : {})}
              {...(max !== undefined ? { max: new Date(max * 1000).getFullYear() } : {})}
              {...(placeholder.length > 0 ? { placeholder } : {})}
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

        return (
          <Input
            id={props.id}
            type={DATE_INPUT_TYPE[precision] ?? "date"}
            value={current === undefined ? "" : timestampToInputValue(current, precision)}
            disabled={bind.disabled}
            {...errorStatus(props.error)}
            {...requiredAria(props)}
            {...described}
            {...(placeholder.length > 0 ? { placeholder } : {})}
            {...(min !== undefined ? { min: timestampToInputValue(min, precision) } : {})}
            {...(max !== undefined ? { max: timestampToInputValue(max, precision) } : {})}
            onChange={(event) => props.onChange(inputValueToTimestamp(event.target.value))}
          />
        );
      }}
    </Lockable>
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

/** The stops of the `multicolor` swatch. Held apart from the map below
 * because `multicolor` is a key ending in "color", so a gradient written
 * inline there reads to `stapel/no-raw-colors` as a themeable colour decision
 * — which it is not: these eighteen shades ARE the engine's vocabulary
 * (`types/hex_color/constants.py`), the data being drawn rather than chrome
 * around it. */
const MULTICOLOR_STOPS = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"].join(
  ","
);

/** A colour category drawn as a colour. The engine's eighteen `simple` codes
 * are a closed vocabulary (`types/hex_color/constants.py`), so the swatch is a
 * lookup, not a guess; `clear` and `multicolor` name an ABSENCE of one colour
 * and get a CSS gradient/transparency rather than a fake solid. */
const CATEGORY_SWATCH: Readonly<Record<string, string>> = {
  black: "#000000",
  white: "#ffffff",
  gray: "#808080",
  silver: "#c0c0c0",
  red: "#e53935",
  pink: "#ec407a",
  orange: "#fb8c00",
  yellow: "#fdd835",
  green: "#43a047",
  blue: "#1e88e5",
  purple: "#8e24aa",
  brown: "#795548",
  gold: "#d4af37",
  beige: "#f5f5dc",
  turquoise: "#26c6da",
  clear: "transparent",
  multicolor: `linear-gradient(90deg,${MULTICOLOR_STOPS})`,
  custom: "transparent",
};

/** The dot beside a category name. Decorative: the category's own label
 * carries the meaning, so it is `aria-hidden` and never the only signal. */
function Swatch(props: { readonly code: string }): ReactElement {
  const paint = CATEGORY_SWATCH[props.code] ?? "transparent";
  return (
    <span
      aria-hidden="true"
      data-attributes-swatch={props.code}
      style={{
        display: "inline-block",
        width: "1em",
        height: "1em",
        borderRadius: "50%",
        border: "1px solid currentColor",
        verticalAlign: "-0.15em",
        background: paint,
      }}
    />
  );
}

/**
 * `hex_color` → a colour CATEGORY picker that shows the colours, plus an exact
 * swatch when the config allows a custom shade.
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
          .filter((option) => option !== null && typeof option === "object")
          .map((option) => {
            const entry = option as { simple?: unknown; label?: unknown };
            const code = str(entry.simple);
            // The option's `label` is a translation key upstream
            // (`types/hex_color/type.py:get_translation_keys`) and was being
            // dropped entirely: the picker showed the raw category CODES of a
            // catalogue that had authored names for them.
            return { code, label: optionLabel(t, cfg, entry.label, code) };
          })
          .filter((entry) => entry.code.length > 0)
      : [];
    const source =
      declared.length > 0 && !allowCustom
        ? declared
        : SIMPLE_COLORS.map((code) => ({ code, label: code }));
    // `label` stays a STRING so antd keeps using it for the option's `title`
    // and for search; the colour arrives through `optionRender`/`labelRender`,
    // which is decoration over the same value rather than a second one.
    return source.map((entry) => ({ value: entry.code, label: entry.label }));
  }, [cfg, allowCustom, t]);

  const withSwatch = (option: { value?: unknown; label?: unknown }): ReactElement => (
    <Flex align="center" gap={spacing[2]}>
      <Swatch code={str(option.value)} />
      <span>{str(option.label)}</span>
    </Flex>
  );

  const emit = (nextSimple: string, nextHex: string): void => {
    if (nextSimple.length === 0) {
      props.onChange(undefined);
      return;
    }
    props.onChange({ simple: nextSimple, ...(nextHex.length > 0 ? { hex: nextHex } : {}) });
  };

  return (
    <Flex gap={spacing[2]} align="center">
      <Select
        id={props.id}
        style={{ flex: 1 }}
        options={options}
        disabled={props.disabled === true}
        {...errorStatus(props.error)}
        {...requiredAria(props)}
        optionRender={(option) => withSwatch(option.data as { value?: unknown; label?: unknown })}
        labelRender={(item) => withSwatch(item as { value?: unknown; label?: unknown })}
        placeholder={t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)}
        {...(simple.length > 0 ? { value: simple } : {})}
        onChange={(next: string) => emit(next, hex)}
      />
      {allowCustom && (
        // antd's ColorPicker renders no labelable control and accepts no
        // `id`, so it is the SECONDARY control here (the labelled one is the
        // category select) and carries its own accessible name.
        <ColorPicker
          aria-label={t(ATTRIBUTES_I18N_KEYS.colorExact)}
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
  config: FeatureConfig,
  depthLeft: number
): readonly CascaderOption[] {
  if (!Array.isArray(raw) || depthLeft <= 0) return [];
  return raw.map((option) => {
    if (option === null || typeof option !== "object") {
      return { value: str(option), label: str(option) };
    }
    const entry = option as { value?: unknown; label?: unknown; children?: unknown };
    const value = str(entry.value);
    const children = toCascaderOptions(entry.children, t, config, depthLeft - 1);
    return {
      value,
      label: optionLabel(t, config, entry.label, value),
      ...(children.length > 0 ? { children } : {}),
    };
  });
}

/**
 * `hierarchical_select` → `Cascader`. The answer is the path array of
 * `value`s from root to the chosen node, which is exactly what the engine
 * stores and validates level by level.
 *
 * Both depth bounds reach the control. `maxDepth` PRUNES the tree, so a level
 * the engine would refuse is never offered; `minDepth > 1` drops
 * `changeOnSelect`, so a partial path stops being selectable at all instead of
 * being selectable and then refused (`below_minimum`).
 *
 * Not honoured here, and deliberately: an option's `icon` is a reference into
 * a host's icon set that this package has no registry for, and `childrenTitle`
 * names a column that antd's `Cascader` does not expose a slot for. Both are
 * filed rather than half-drawn.
 */
const HierarchicalSelectEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const minDepth = numberish(cfg["minDepth"]) ?? 1;
  const maxDepth = numberish(cfg["maxDepth"]);
  const options = useMemo(
    () => toCascaderOptions(cfg["options"], t, cfg, maxDepth ?? Number.POSITIVE_INFINITY),
    [cfg, t, maxDepth]
  );
  const value = Array.isArray(props.value) ? props.value.map(str) : undefined;
  return (
    <Cascader
      id={props.id}
      style={{ width: "100%" }}
      options={options as never}
      disabled={props.disabled === true}
      {...errorStatus(props.error)}
      {...requiredAria(props)}
      placeholder={t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)}
      {...(minDepth <= 1 ? { changeOnSelect: true } : {})}
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
  const t = useT();
  const cfg = configOf(props);
  const units = [str(cfg["unit_m"]), str(cfg["unit_i"])].filter((code) => code.length > 0);
  const current =
    props.value !== null && typeof props.value === "object"
      ? (props.value as { value?: unknown; unit?: unknown })
      : {};
  const unit = str(current.unit) || units[0] || "";
  const amount = numberish(current.value);
  const precision = numberish(cfg["precision"]);
  const prefix = configLabel(t, cfg["prefix"]);

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
    <Flex gap={spacing[2]}>
      <InputNumber
        id={props.id}
        style={{ flex: 1 }}
        value={amount ?? null}
        disabled={props.disabled === true}
        {...errorStatus(props.error)}
        {...requiredAria(props)}
        {...(precision !== undefined ? { precision } : {})}
        {...(prefix.length > 0 ? { prefix } : {})}
        onChange={(next) => emit(next ?? undefined, unit)}
      />
      {units.length > 0 && (
        <Select
          // The unit chooser is a SECOND control in one field: the row's label
          // names the number, so this one names itself or a screen reader
          // announces an unlabelled combobox.
          aria-label={t(ATTRIBUTES_I18N_KEYS.unit)}
          style={{ width: UNIT_SELECT_WIDTH }}
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
 * Every builtin is its OWN skin root.
 *
 * A host may take one editor out of this table and render it in its own form
 * — that is what the registry is for — and on a dark document with no
 * `ConfigProvider` above it antd falls back to its light algorithm: a light
 * input on a dark page. `<FeatureFields/>` already wraps the column, and
 * nested `SkinTheme`s are free (the inner one reuses the applied config and
 * renders no second provider), so the editor pays nothing for being correct
 * on its own. `"bare"` throughout: a control paints no surface of its own.
 */
function skinned(name: string, Editor: ValueEditor): ValueEditor {
  const Skinned = (props: ValueEditorProps): ReactElement => (
    <SkinTheme surface="bare">
      <Editor {...props} />
    </SkinTheme>
  );
  Skinned.displayName = `${name}ValueEditor`;
  return Skinned;
}

/**
 * The skin's builtin editor per value type — the second rung of the ladder.
 * A type absent from this table has no default drawing and reaches
 * `<UnsupportedValueEditor/>`.
 */
export const BUILTIN_VALUE_EDITORS: Readonly<Record<string, ValueEditor>> = {
  string: skinned("String", StringEditor),
  int: skinned("Int", makeNumberEditor(true)),
  float: skinned("Float", makeNumberEditor(false)),
  bool: skinned("Bool", BoolEditor),
  select: skinned("Select", SelectEditor),
  date: skinned("Date", DateEditor),
  header: skinned("Header", HeaderEditor),
  hex_color: skinned("HexColor", HexColorEditor),
  hierarchical_select: skinned("HierarchicalSelect", HierarchicalSelectEditor),
  convertible_unit: skinned("ConvertibleUnit", ConvertibleUnitEditor),
};

/** The types this skin can draw — handed to `unsupportedTypes` so the
 * headless half can judge renderability without importing the skin. */
export const BUILTIN_VALUE_EDITOR_TYPES: readonly string[] =
  Object.keys(BUILTIN_VALUE_EDITORS).sort();
