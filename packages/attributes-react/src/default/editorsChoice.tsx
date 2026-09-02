/**
 * The two editors whose whole job is a CHOICE: `select` and `bool`.
 *
 * ── The rule this file states ──────────────────────────────────────────────
 *
 * **A closed list is picked, not unfolded.** A short one is chips a thumb can
 * hit; a long one is a bottom sheet with a search box. An antd `Select` panel
 * on a 390px screen is a 250px portal floating over the field it belongs to,
 * with the keyboard covering half of it — that is the control this file no
 * longer draws by default.
 *
 * The threshold is {@link CHIPS_MAX_OPTIONS} (six), raised from the four the
 * old `Segmented` bar could physically fit. `uiStyle` still wins in both
 * directions: `chips`/`checkboxes` keep every option on screen whatever the
 * count (the admin asked for that), and only an ABSENT or `dropdown` style is
 * decided by the number.
 *
 * ── Why a CAPPED multiple choice stays inline ──────────────────────────────
 *
 * `SkinPickerSheet` holds its own draft and reports it once, on commit — that
 * is what lets a person untick a mis-tap without the list re-sorting under
 * them. It also means the caller cannot see the draft grow, so a
 * `maxSelected` cap cannot be enforced INSIDE the sheet: the person would
 * tick a seventh answer, press Done, and be refused by the mirror for a
 * choice the control had offered. That is precisely the defect this package's
 * gate exists to prevent, so a `select` with a cap is drawn as chips however
 * many options it has — where the control owns the selection and can switch
 * the remaining chips off with the reason beside them.
 */
import type { ReactElement, ReactNode } from "react";
import { Checkbox, Flex, Radio, Switch, Typography } from "antd";
import { useT } from "@stapel/core";
import { SkinPickerSheet } from "@stapel/tokens-antd/skin";
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
  Lockable,
  PickerTrigger,
  chipOptions,
  configOf,
  numberish,
  pickerOptions,
  requiredAria,
  str,
  touchFloorMarker,
  uiStyleOf,
  useChoices,
  useDisclosure,
} from "./editorKit.js";

// ── select ───────────────────────────────────────────────────────────────────

/**
 * `select` → chips, a radio/checkbox list, or a trigger over a picker sheet —
 * whichever the config asked for, on both the single and the multiple branch.
 *
 * The value is a LIST on every branch. `maxSelected` absent means UNLIMITED
 * (the engine's own default); reading an absent key as 1 would silently turn
 * every unconfigured select into a single-choice control.
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
  const sheet = useDisclosure();
  const options = [...choices];

  const emit = (next: readonly string[]): void =>
    props.onChange(next.length > 0 ? [...next] : undefined);

  // Every option on screen, either because the admin said so or because there
  // are few enough of them — plus the capped case, which cannot be a sheet
  // (see the module note).
  const capped = multiple && maxSelected !== undefined;
  const inline =
    style !== "dropdown" || capped || choices.length <= CHIPS_MAX_OPTIONS;

  const full = capped && current.length >= (maxSelected ?? 0);
  const capReason = (value: string): string | undefined =>
    full && !current.includes(value)
      ? t(ATTRIBUTES_I18N_KEYS.selectMaxSelected, { count: maxSelected })
      : undefined;

  // antd's `Select` has `maxCount` and no minimum, so the floor is said in
  // words beside the control instead of only after a refused submit.
  const minHint =
    minSelected > 0 ? (
      <HintLine testId="attributes-min-selected">
        {t(ATTRIBUTES_I18N_KEYS.selectMinSelected, { count: minSelected })}
      </HintLine>
    ) : null;

  const chosenLabels = current
    .map((code) => choices.find((choice) => choice.value === code)?.label ?? code)
    .join(", ");

  const control = (bind: {
    readonly disabled: boolean;
    readonly "aria-describedby": string | undefined;
  }): ReactElement => {
    const described =
      bind["aria-describedby"] !== undefined
        ? { "aria-describedby": bind["aria-describedby"] }
        : {};

    // An explicit `checkboxes` on a SINGLE choice is a radio list: the admin
    // asked for one row per option with a mark beside it, and that is what
    // antd's radio group is. `chips` and the small-list default are chips.
    if (style === "checkboxes" && !multiple && choices.length > 0) {
      return (
        <Radio.Group
          id={props.id}
          aria-label={featureName(props.feature)}
          {...described}
          options={options}
          value={current[0] ?? ""}
          disabled={bind.disabled}
          onChange={(event) => emit(event.target.value ? [String(event.target.value)] : [])}
        />
      );
    }

    if (inline && choices.length > 0) {
      return (
        <div {...touchFloorMarker(touchFloor)}>
          {multiple ? (
            <ChoiceChips
              mode="multi"
              columns="grid"
              // The row's <label htmlFor> resolves to the first chip; a group
              // aria-label repeating the field name would make it ambiguous
              // which element the name belongs to (two matches for one label).
              {...(props.id !== undefined
                ? { id: props.id }
                : { ariaLabel: featureName(props.feature) })}
              options={chipOptions(choices, {
                touchFloor,
                disabled: bind.disabled,
                disabledReason: capReason,
              })}
              values={current}
              testId="attributes-select-chips"
              onChange={(next) => emit(next)}
            />
          ) : (
            <ChoiceChips
              mode="single"
              {...(props.id !== undefined
                ? { id: props.id }
                : { ariaLabel: featureName(props.feature) })}
              options={chipOptions(choices, { touchFloor, disabled: bind.disabled })}
              testId="attributes-select-chips"
              {...(current[0] !== undefined ? { value: current[0] } : {})}
              onChange={(next) => emit(next === undefined ? [] : [next])}
            />
          )}
        </div>
      );
    }

    // The long list: a field that says what is chosen, and a sheet that picks
    // it. The sheet filters locally — every option is already here, which is
    // what makes this a `select` and not a `ref_select`.
    return (
      <>
        <PickerTrigger
          id={props.id}
          expanded={sheet.open}
          onOpen={sheet.show}
          disabled={bind.disabled}
          placeholder={t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)}
          testId="attributes-select-trigger"
          touchFloor={touchFloor}
          {...(chosenLabels.length > 0 ? { value: chosenLabels } : {})}
          {...(multiple ? { count: current.length } : {})}
          {...(props.required === true ? { required: true } : {})}
          {...(props.error ? { invalid: true } : {})}
          {...described}
        />
        {multiple ? (
          <SkinPickerSheet
            mode="multi"
            open={sheet.open}
            onClose={sheet.hide}
            title={featureName(props.feature)}
            options={pickerOptions(choices)}
            values={current}
            doneLabel={t(ATTRIBUTES_I18N_KEYS.pickerDone)}
            searchPlaceholder={t(ATTRIBUTES_I18N_KEYS.pickerSearch)}
            refineLabel={t(ATTRIBUTES_I18N_KEYS.pickerRefine)}
            emptyLabel={t(ATTRIBUTES_I18N_KEYS.vocabularyNoMatches)}
            testId="attributes-select-sheet"
            onChange={(next) => emit(next)}
          />
        ) : (
          <SkinPickerSheet
            mode="single"
            open={sheet.open}
            onClose={sheet.hide}
            title={featureName(props.feature)}
            options={pickerOptions(choices)}
            searchPlaceholder={t(ATTRIBUTES_I18N_KEYS.pickerSearch)}
            refineLabel={t(ATTRIBUTES_I18N_KEYS.pickerRefine)}
            emptyLabel={t(ATTRIBUTES_I18N_KEYS.vocabularyNoMatches)}
            testId="attributes-select-sheet"
            {...(current[0] !== undefined ? { value: current[0] } : {})}
            onChange={(next) => emit([next])}
          />
        )}
      </>
    );
  };

  // A `checkboxes`/`chips` MULTIPLE choice and a small default one are the
  // same control now that the substrate ships one: `ChoiceChips` in grid
  // mode. That is why `Checkbox.Group` survives only where the config asks
  // for it and the cap does not need enforcing.
  const checkboxes =
    style === "checkboxes" && multiple && choices.length > 0 && !capped;

  return (
    <Flex vertical gap={spacing[1]}>
      <Lockable locked={locked} disabled={props.disabled === true}>
        {checkboxes
          ? (bind): ReactElement => (
              <Checkbox.Group
                // `Checkbox.Group` renders a plain `div` and antd's types
                // carry no `id`, so `<label for>` has nothing to point at —
                // the group names itself, exactly as the chips do.
                aria-label={featureName(props.feature)}
                {...(bind["aria-describedby"] !== undefined
                  ? { "aria-describedby": bind["aria-describedby"] }
                  : {})}
                options={options}
                value={[...current]}
                disabled={bind.disabled}
                onChange={(next) =>
                  emit((next as readonly (string | number | boolean)[]).map(str))
                }
              />
            )
          : control}
      </Lockable>
      {minHint}
      {full && (
        <HintLine testId="attributes-max-selected">
          {t(ATTRIBUTES_I18N_KEYS.selectMaxSelected, { count: maxSelected })}
        </HintLine>
      )}
    </Flex>
  );
};

// ── bool ─────────────────────────────────────────────────────────────────────

/** The two answers a tristate holds, as codes the chips are keyed on. They
 * never reach the wire — the editor emits `true`/`false`. */
const YES = "yes";
const NO = "no";

/**
 * `bool` → a switch when a `false` default is real, and an honest TRISTATE
 * when an answer is required.
 *
 * A switch has two positions and three meanings: on, off, and "nobody has
 * touched this yet", which it draws identically to off. For an optional flag
 * that is fine — an unanswered "negotiable" IS not negotiable, and the value
 * the composer submits (`undefined`) says so. For a REQUIRED bool it is a
 * lie: the form shows "No" for a question the person has not answered, the
 * asterisk beside it says they must, and the two contradict each other until
 * the submit is refused for a field that looks filled in.
 *
 * So a required bool is two chips with NEITHER selected until one is tapped.
 * `undefined` stays reachable in the value, the mirror keeps refusing it as
 * `mandatory_missing`, and what is on screen agrees with what is stored.
 */
const BoolEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const touchFloor = useTouchFloor();
  const on = props.value === true;
  const answered = typeof props.value === "boolean";
  // `trueLabel`/`falseLabel` are translation KEYS
  // (`types/bool/type.py:117-123` collects them for the catalogue, and
  // `format_value` falls back to `feature.bool.true`). Rendering them verbatim
  // showed English captions on a Russian storefront.
  const trueLabel = configLabel(t, cfg["trueLabel"]) || t(ATTRIBUTES_I18N_KEYS.boolYes);
  const falseLabel = configLabel(t, cfg["falseLabel"]) || t(ATTRIBUTES_I18N_KEYS.boolNo);

  if (props.required === true) {
    const chips: ReactNode = (
      <ChoiceChips
        mode="single"
        {...(props.id !== undefined
          ? { id: props.id }
          : { ariaLabel: featureName(props.feature) })}
        options={chipOptions(
          [
            { value: YES, label: trueLabel },
            { value: NO, label: falseLabel },
          ],
          { touchFloor, disabled: props.disabled === true }
        )}
        testId="attributes-bool-tristate"
        {...(answered ? { value: on ? YES : NO } : {})}
        onChange={(next) => props.onChange(next === YES)}
      />
    );
    return (
      <div
        data-attributes-bool={answered ? String(on) : "unanswered"}
        {...touchFloorMarker(touchFloor)}
      >
        {chips}
      </div>
    );
  }

  return (
    <Flex align="center" gap={spacing[2]} data-attributes-bool={answered ? String(on) : "unanswered"}>
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

export { BoolEditor, SelectEditor };
