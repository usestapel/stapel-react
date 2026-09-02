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
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, Select, Typography } from "antd";
import { useT } from "@stapel/core";
import { SkinNumberField, SkinPickerSheet } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { ValueEditor, ValueEditorProps } from "../registry.js";
import { featureName } from "../types.js";
import { firstCode, optionsRefOf, useVocabularyClient } from "../vocabulary.js";
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

// ── int with a vocabulary-backed allowed set ────────────────────────────────

/** One fetched page. An answer this long means the level was CUT to fit, so
 * the set is not fully known and the editor constrains nothing — a truncated
 * "allowed set" would refuse values the server accepts. */
const REF_INT_PAGE = 50;

/** The suggestions panel's scroll cap — one-off geometry (about six rows of
 * the phone control height), named so the next change happens once. */
export const INT_SUGGESTIONS_MAX_HEIGHT = 240;

/**
 * `IntConfig.optionsRef` — the year-of-make field scoped by the chosen
 * generation. The owner's ruling, final shape (together, not instead):
 *
 *  - the numeric KEYPAD stays — typing is the primary path;
 *  - a dropdown of the allowed set rides along: a typed prefix filters it, a
 *    typed number that IS allowed commits with no further UI, and a typed
 *    number OUTSIDE the set shows the whole set plus a bounds hint — the
 *    dropdown is the recovery path;
 *  - the two steppers walk the ALLOWED set (skipping gaps), greyed at the
 *    ends;
 *  - exactly one allowed value bakes: committed and grey, like every other
 *    single-option collapse.
 *
 * The static `min`/`max` range hint is suppressed here on purpose: the live
 * set IS the constraint, and prose describing it beside a control that
 * enforces it is the defect this editor exists to remove. The same set is
 * what the server checks (`IntFeatureType.validate_dto_in_context` walks the
 * same vocabulary edges), so the picker and the refusal cannot disagree.
 */
const RefIntEditor = (props: ValueEditorProps): ReactElement => {
  const t = useT();
  const cfg = configOf(props);
  const touchFloor = useTouchFloor();
  const client = useVocabularyClient();
  const pointer = optionsRefOf(cfg);
  const vocabulary = pointer?.vocabulary ?? "";
  const level = pointer?.level ?? "";
  const parentFeature = pointer?.parentFeature;
  const parent =
    parentFeature === undefined ? undefined : firstCode(props.siblings?.[parentFeature]);
  const current = numberish(props.value);
  const placeholder = str(cfg["placeholder"]);
  const postfix = configLabel(t, cfg["postfix"]);

  // The allowed set for the CURRENT parent, ascending; `null` while loading
  // or when it cannot be trusted (no client, a failed fetch, a page-capped
  // answer, a non-numeric code). `null` renders a plain keypad — the fetch
  // is a convenience, the server is the gate.
  const [allowed, setAllowed] = useState<readonly number[] | null>(null);
  useEffect(() => {
    setAllowed(null);
    if (client === null || vocabulary.length === 0 || level.length === 0) return;
    // Normally unreachable — progressive disclosure keeps the row unmounted
    // until the parent is answered — but a host drawing rows itself may not
    // gate, and the whole level is not "the allowed set of this parent".
    if (parentFeature !== undefined && parent === undefined) return;
    let stale = false;
    client
      .search(vocabulary, level, "", parent)
      .then((terms) => {
        if (stale || terms.length === 0 || terms.length >= REF_INT_PAGE) return;
        const numbers = terms.map((term) => Number.parseInt(term.code, 10));
        if (numbers.some((one) => !Number.isFinite(one))) return;
        setAllowed([...numbers].sort((left, right) => left - right));
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [client, vocabulary, level, parent, parentFeature]);

  // What the person is TYPING, before the host round-trips it — the panel
  // and the steppers read this, so a half-typed «201» filters immediately.
  // External moves (a parent-change reset, the bake) are adopted back.
  const [typed, setTyped] = useState<number | undefined>(current);
  useEffect(() => {
    setTyped(current);
  }, [current]);

  const baked = allowed !== null && allowed.length === 1;
  const onChange = props.onChange;
  useEffect(() => {
    if (!baked || allowed === null) return;
    if (current === allowed[0]) return;
    onChange(allowed[0]);
  }, [baked, allowed, current, onChange]);

  const loaded = allowed !== null && !baked;
  const inSet = allowed !== null && typed !== undefined && allowed.includes(typed);
  const prefixMatched =
    loaded && typed !== undefined && !inSet
      ? allowed.filter((one) => String(one).startsWith(String(typed)))
      : [];
  const outOfSet = loaded && typed !== undefined && !inSet && prefixMatched.length === 0;
  const panel: readonly number[] =
    !loaded || typed === undefined || inSet
      ? []
      : prefixMatched.length > 0
        ? prefixMatched
        : (allowed ?? []);
  const lowest = allowed?.[0];
  const highest = allowed?.[allowed.length - 1];
  const upTarget = !loaded
    ? undefined
    : typed === undefined
      ? lowest
      : allowed?.find((one) => one > typed);
  const downTarget = !loaded
    ? undefined
    : typed === undefined
      ? highest
      : [...(allowed ?? [])].reverse().find((one) => one < typed);

  const commit = (next: number | undefined): void => {
    setTyped(next);
    onChange(next);
  };

  return (
    <div {...touchFloorMarker(touchFloor)} data-testid="attributes-int-ref">
      <Flex align="center" gap={spacing[1]}>
        <div style={{ flex: 1 }}>
          <SkinNumberField
            id={props.id}
            value={current}
            integer
            disabled={props.disabled === true || baked}
            ariaLabel={featureName(props.feature)}
            {...(props.required === true ? { ariaRequired: true } : {})}
            testId="attributes-number-field"
            {...errorStatus(props.error)}
            {...(postfix.length > 0 ? { unit: postfix } : {})}
            {...(placeholder.length > 0 ? { hintPlaceholder: placeholder } : {})}
            onValueChange={commit}
          />
        </div>
        {loaded && (
          <>
            <Button
              aria-label={t(ATTRIBUTES_I18N_KEYS.intStepDown)}
              data-testid="attributes-int-step-down"
              disabled={props.disabled === true || downTarget === undefined}
              data-disabled-reason="already at the lowest allowed value — the boundary the greyed arrow itself communicates"
              data-analytics="none"
              data-analytics-reason="passthrough — the committed value lands in the form's own onChange"
              onClick={() => commit(downTarget)}
            >
              −
            </Button>
            <Button
              aria-label={t(ATTRIBUTES_I18N_KEYS.intStepUp)}
              data-testid="attributes-int-step-up"
              disabled={props.disabled === true || upTarget === undefined}
              data-disabled-reason="already at the highest allowed value — the boundary the greyed arrow itself communicates"
              data-analytics="none"
              data-analytics-reason="passthrough — the committed value lands in the form's own onChange"
              onClick={() => commit(upTarget)}
            >
              +
            </Button>
          </>
        )}
      </Flex>
      {panel.length > 0 && (
        <div
          role="listbox"
          aria-label={featureName(props.feature)}
          data-testid="attributes-int-suggestions"
          style={{
            maxHeight: INT_SUGGESTIONS_MAX_HEIGHT,
            overflowY: "auto",
            marginTop: spacing[1],
          }}
        >
          {panel.map((one) => (
            <Button
              key={one}
              type="text"
              block
              role="option"
              data-int-suggestion=""
              data-analytics="none"
              data-analytics-reason="passthrough — the caller's onChange carries the tracked pick"
              onClick={() => commit(one)}
            >
              {String(one)}
            </Button>
          ))}
        </div>
      )}
      {outOfSet && lowest !== undefined && highest !== undefined && (
        <HintLine>
          <span data-testid="attributes-int-out-of-set">
            {t(ATTRIBUTES_I18N_KEYS.intOutOfAllowed, {
              min: String(lowest),
              max: String(highest),
            })}
          </span>
        </HintLine>
      )}
      {baked && (
        <Typography.Text
          type="secondary"
          style={{ display: "block", marginTop: spacing[1] }}
          data-testid={`attributes-baked-${props.feature.slug}`}
        >
          {t(ATTRIBUTES_I18N_KEYS.bakedByConstraint)}
        </Typography.Text>
      )}
    </div>
  );
};

// ── int / float ──────────────────────────────────────────────────────────────

function makeNumberEditor(isInt: boolean): ValueEditor {
  const Editor = (props: ValueEditorProps): ReactElement => {
    // The vocabulary-backed int branches BEFORE any hook: `optionsRef` is a
    // property of the catalogue's config, stable for the life of the row.
    if (isInt && optionsRefOf(configOf(props)) !== undefined) {
      return <RefIntEditor {...props} />;
    }
    return <FreeNumberEditor {...props} isInt={isInt} />;
  };
  Editor.displayName = isInt ? "IntValueEditor" : "FloatValueEditor";
  return Editor;
}

// A named type rather than an inline object literal: `configKeys.test.ts`
// brace-matches declarations and would take `{ readonly isInt … }` for the
// body (the same reason `Choice` is a named interface in editorKit).
type FreeNumberEditorProps = ValueEditorProps & { readonly isInt: boolean };

function FreeNumberEditor(allProps: FreeNumberEditorProps): ReactElement {
  const { isInt, ...props } = allProps;
  {
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
  }
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
