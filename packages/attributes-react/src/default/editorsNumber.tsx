/**
 * The numeric editors: `int`, `float`, and `convertible_unit`.
 *
 * ── The rule this file states ──────────────────────────────────────────────
 *
 * **A bound is a hint, never a clamp.** antd's `InputNumber` — what these
 * drew until now — rewrites what it is given: typing `9` towards `95` in a
 * field capped at 50 leaves `9`, and blurring `120` in a `max: 100` field
 * silently stores `100`, a number nobody typed, in a field nobody is looking
 * at any more. The mirror already refuses an out-of-range answer with the
 * engine's own sentence under the control, so the control's job is to SAY the
 * range (as the empty box's placeholder and as a line under it) and then keep
 * whatever was typed.
 *
 * `SkinNumberField` is the substrate half of that rule — a plain `Input` with
 * `inputMode` for the phone keypad, the unit as a suffix that never enters
 * the value, and raw text kept so a half-typed `1.` survives a re-render.
 *
 * Requiredness reaches the control through the substrate's own contract —
 * `ariaRequired` on `SkinNumberField` and `CountedInput` — never through a
 * local `useEffect` poking the rendered input, which would be a second owner
 * of the attribute.
 *
 * ── `convertible_unit` converts nothing ────────────────────────────────────
 *
 * The wire DTO is `{value, unit}`: the number AS TYPED, tagged with which of
 * the config's `unit_m` (metric) / `unit_i` (imperial) codes it is in. The
 * server converts to the family's base unit before validating, so a
 * conversion here would be a second, disagreeing implementation of a table
 * that lives in Python.
 */
import type { ReactElement } from "react";
import { Flex, Select, Typography } from "antd";
import { useT } from "@stapel/core";
import { SkinNumberField, SkinPickerSheet } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { ValueEditor, ValueEditorProps } from "../registry.js";
import { featureName } from "../types.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";
import { configLabel } from "./labels.js";
import { useTouchFloor } from "./touchFloor.js";
import {
  CHIPS_MAX_OPTIONS,
  ChoiceChips,
  HintLine,
  PickerTrigger,
  chipOptions,
  configOf,
  errorStatus,
  isClosedList,
  numberish,
  pickerOptions,
  rangePlaceholder,
  str,
  touchFloorMarker,
  useChoices,
  useDisclosure,
  useRangeHint,
} from "./editorKit.js";

/** The `convertible_unit` unit chooser holds a unit CODE (`m`, `ft`, `mm`),
 * never a word — so its width is measured in characters, not pixels: it
 * follows the type scale instead of contradicting it. */
const UNIT_SELECT_WIDTH = "12ch";

// ── int / float ──────────────────────────────────────────────────────────────

function makeNumberEditor(isInt: boolean): ValueEditor {
  const Editor = (props: ValueEditorProps): ReactElement => {
    const t = useT();
    const cfg = configOf(props);
    const touchFloor = useTouchFloor();
    const rangeHint = useRangeHint();
    const choices = useChoices(cfg);
    const closed = isClosedList(cfg, choices.length);
    const sheet = useDisclosure();
    const min = numberish(cfg["min"]);
    const max = numberish(cfg["max"]);
    // `int`'s `precision` is a DISPLAY hint upstream (it defaults to 1 and
    // means "significant step", not "decimal places"), so an integer control
    // pins 0 decimals rather than reading it — reading it would let an `int`
    // field accept `1.0` and then silently truncate server-side. A `float`
    // whose config pins 0 decimals gets the integer keypad, which is the one
    // thing `precision` legitimately decides on this side.
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
      const label = (choice: { value: string; label: string }): string =>
        `${prefix}${choice.label}${suffix ? ` ${suffix}` : ""}`;
      const labelled = choices.map((choice) => ({
        value: choice.value,
        label: label(choice),
      }));
      const chosen = labelled.find((choice) => choice.value === String(current));
      if (choices.length <= CHIPS_MAX_OPTIONS) {
        return (
          <div id={props.id} {...touchFloorMarker(touchFloor)}>
            <ChoiceChips
              mode="single"
              ariaLabel={featureName(props.feature)}
              options={chipOptions(labelled, {
                touchFloor,
                disabled: props.disabled === true,
              })}
              testId="attributes-number-chips"
              {...(chosen !== undefined ? { value: chosen.value } : {})}
              onChange={(next) => props.onChange(numberish(next))}
            />
          </div>
        );
      }
      return (
        <>
          <PickerTrigger
            id={props.id}
            expanded={sheet.open}
            onOpen={sheet.show}
            disabled={props.disabled === true}
            placeholder={
              placeholder.length > 0 ? placeholder : t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)
            }
            testId="attributes-number-trigger"
            touchFloor={touchFloor}
            {...(chosen !== undefined ? { value: chosen.label } : {})}
            {...(props.required === true ? { required: true } : {})}
            {...(props.error ? { invalid: true } : {})}
          />
          <SkinPickerSheet
            mode="single"
            open={sheet.open}
            onClose={sheet.hide}
            title={featureName(props.feature)}
            options={pickerOptions(labelled)}
            searchPlaceholder={t(ATTRIBUTES_I18N_KEYS.pickerSearch)}
            refineLabel={t(ATTRIBUTES_I18N_KEYS.pickerRefine)}
            emptyLabel={t(ATTRIBUTES_I18N_KEYS.vocabularyNoMatches)}
            testId="attributes-number-sheet"
            {...(chosen !== undefined ? { value: chosen.value } : {})}
            onChange={(next) => props.onChange(numberish(next))}
          />
        </>
      );
    }

    // The bound, twice and honestly: as the empty box's placeholder (numerals
    // and an en dash — a range in every locale, so not a sentence anybody
    // translates) and as a line under it in words. The catalogue's own
    // `placeholder`/`example` wins the box, because it is the more specific
    // statement.
    const hint = rangeHint(
      min === undefined ? undefined : String(min),
      max === undefined ? undefined : String(max)
    );
    const box = rangePlaceholder(min, max);
    const help = hint === undefined ? undefined : <HintLine>{hint}</HintLine>;

    const field = (
      <SkinNumberField
        id={props.id}
        value={current}
        integer={precision === 0}
        disabled={props.disabled === true}
        ariaLabel={featureName(props.feature)}
        {...(props.required === true ? { ariaRequired: true } : {})}
        testId="attributes-number-field"
        {...errorStatus(props.error)}
        {...(suffix.length > 0 ? { unit: suffix } : {})}
        {...(placeholder.length > 0
          ? { hintPlaceholder: placeholder }
          : box !== undefined
            ? { hintPlaceholder: box }
            : {})}
        {...(help !== undefined ? { helpText: help } : {})}
        onValueChange={(next) => props.onChange(next)}
      />
    );

    if (prefix.length === 0) return field;
    // `SkinNumberField` owns one slot after the number (the unit); a prefix
    // is a second, and it is the caller's to draw. Beside the box rather than
    // inside it, so the field's own text never has a currency symbol in it
    // that `parseNumericText` would have to strip back out.
    return (
      <Flex align="center" gap={spacing[2]}>
        <Typography.Text type="secondary" data-attributes-prefix="">
          {prefix}
        </Typography.Text>
        <div style={{ flex: 1 }}>{field}</div>
      </Flex>
    );
  };
  Editor.displayName = isInt ? "IntValueEditor" : "FloatValueEditor";
  return Editor;
}

// ── convertible_unit ─────────────────────────────────────────────────────────

const ConvertibleUnitEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const rangeHint = useRangeHint();
  const units = [str(cfg["unit_m"]), str(cfg["unit_i"])].filter((code) => code.length > 0);
  const current =
    props.value !== null && typeof props.value === "object"
      ? (props.value as { value?: unknown; unit?: unknown })
      : {};
  const unit = str(current.unit) || units[0] || "";
  const amount = numberish(current.value);
  const precision = numberish(cfg["precision"]);
  const min = numberish(cfg["min"]);
  const max = numberish(cfg["max"]);
  const prefix = configLabel(t, cfg["prefix"]);
  const box = rangePlaceholder(min, max);

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

  // The bound belongs to the family's BASE unit, and the number is typed in
  // whichever unit is chosen — so the hint says the range and stops there
  // rather than converting it, which is the same rule the value obeys.
  const hint = rangeHint(
    min === undefined ? undefined : String(min),
    max === undefined ? undefined : String(max)
  );

  return (
    <Flex vertical gap={spacing[1]}>
      <Flex gap={spacing[2]} align="flex-start">
        {prefix.length > 0 && (
          <Typography.Text type="secondary" data-attributes-prefix="">
            {prefix}
          </Typography.Text>
        )}
        <div style={{ flex: 1 }}>
          <SkinNumberField
            id={props.id}
            value={amount}
            integer={precision === 0}
            disabled={props.disabled === true}
            ariaLabel={featureName(props.feature)}
            {...(props.required === true ? { ariaRequired: true } : {})}
            testId="attributes-unit-amount"
            {...errorStatus(props.error)}
            {...(box !== undefined ? { hintPlaceholder: box } : {})}
            onValueChange={(next) => emit(next, unit)}
          />
        </div>
        {units.length > 0 && (
          <Select
            // The unit chooser is a SECOND control in one field: the row's
            // label names the number, so this one names itself or a screen
            // reader announces an unlabelled combobox.
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
      {hint !== undefined && <HintLine>{hint}</HintLine>}
    </Flex>
  );
};

export { ConvertibleUnitEditor, makeNumberEditor };
