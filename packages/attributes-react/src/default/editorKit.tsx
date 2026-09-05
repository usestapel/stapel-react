/**
 * The pieces every builtin editor is built out of — the config readers, the
 * lock wrapper, and the two shapes a CHOICE takes on a phone.
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 *
 * `editors.tsx` had grown to hold thirteen editors plus the helpers they
 * share, and the picker rework doubles what a choice-shaped editor does: a
 * short list is chips, a long one is a trigger over a bottom sheet, and both
 * have to agree about the touch floor, the placeholder, the count and the
 * disabled reason. Those decisions are made ONCE here, so `select`,
 * `ref_select` and the chained rungs cannot drift apart — the drift is what
 * the file's own rule ("a control never offers what the mirror will refuse")
 * is about, one level up.
 *
 * ── What is here and what is in the substrate ──────────────────────────────
 *
 * `ChoiceChips`, `SkinPickerSheet`, `SkinNumberField` and `CountedInput` are
 * `@stapel/tokens-antd/skin`'s: they are paint, and every pair that draws a
 * picker needs them. What stays here is what only an ATTRIBUTE means — the
 * option shapes the engine allows, `translatable_options`, the inverted
 * `allowCustom` default, the lock reason, and the trigger that stands in for
 * a control while its sheet is closed.
 *
 * ── The config-key gate reads this file ────────────────────────────────────
 *
 * `test/configKeys.test.ts` follows the helpers below one level out of an
 * editor's body ({@link useChoices}, {@link isClosedList}, {@link uiStyleOf}).
 * A NEW helper here that reads `config[...]` must be added to that test's
 * `HELPERS` map, or the gate stops seeing the key and starts lying in the
 * direction that lets a real gap through.
 */
import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Typography, theme as antdTheme } from "antd";
import { SkinButton as Button } from "@stapel/tokens-antd/skin";
import { actionBlocked, useT } from "@stapel/core";
import { ChoiceChips, GatedControl, PHONE_CONTROL_HEIGHT } from "@stapel/tokens-antd/skin";
import type { ChoiceChipOption, PickerOption } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { ValueEditorProps } from "../registry.js";
import { featureConfig } from "../types.js";
import type { FeatureConfig } from "../types.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";
import { optionLabel } from "./labels.js";

/**
 * At or below this many choices a closed list is drawn INLINE, as chips a
 * thumb can hit; above it the answer is picked in a sheet with a search box.
 *
 * Raised from four (the old `Segmented` threshold, inherited from
 * profiles-react) because four was a control-WIDTH limit — a segmented bar
 * with five items does not fit 390px — and chips wrap, so the limit is now
 * about READING: six options is the most a person takes in at a glance, and
 * the seventh is where a search box starts earning its place. An explicit
 * `uiStyle` still wins over this number in both directions.
 */
export const CHIPS_MAX_OPTIONS = 6;

/**
 * The height a chip's LABEL is held to inside a narrow column.
 *
 * `ChoiceChips` reads the 44px floor from the VIEWPORT (`useDialogSurface`),
 * which is right for a phone and wrong for the listings composer: a form
 * column a few hundred pixels wide on a 1440px desktop is touched, not
 * clicked, and antd is on its 32px desktop control height there. The label is
 * the one part of a chip a caller can size, and growing it grows the chip —
 * the chip adds its own padding, `spacing[1]` in total, so a 40px label is a
 * 44px target. See `touchFloor.ts` for why the answer is measured from the
 * column.
 */
const CHIP_LABEL_FLOOR: number = PHONE_CONTROL_HEIGHT - spacing[1];

/** One offered choice. A named type, not an inline object literal, because
 * `test/configKeys.test.ts` brace-matches function bodies out of the source
 * and a `{…}` in a return type is a body it would stop at. */
export interface Choice {
  readonly value: string;
  readonly label: string;
}

export function str(value: unknown): string {
  return typeof value === "string"
    ? value
    : value === null || value === undefined
      ? ""
      : String(value);
}

export function numberish(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function configOf(props: ValueEditorProps): FeatureConfig {
  return featureConfig(props.feature);
}

/**
 * antd's `status` prop under `exactOptionalPropertyTypes` does not accept
 * `undefined` — it wants the key ABSENT. Spread this instead of passing
 * `status={error ? "error" : undefined}`.
 */
export function errorStatus(error: unknown): { status: "error" } | Record<string, never> {
  return error ? { status: "error" } : {};
}

/** `aria-required` for the row's required state, absent when it is not — the
 * asterisk antd draws is decorative and reaches no screen reader. */
export function requiredAria(
  props: ValueEditorProps
): { "aria-required": true } | Record<string, never> {
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
export function Lockable(props: {
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
      // `inert` on purpose, and the one place in this pair that asks for it:
      // a catalogue lock is not a door anybody can open from this screen, and
      // `Lockable` re-emits its OWN binding to editors that only speak
      // `disabled`. Forwarding the live binding through that contract is a
      // change to every editor's signature, not a spread — tracked separately.
      whenBlocked="inert"
      testId="attributes-locked"
    >
      {(bind) => props.children({ disabled: true, "aria-describedby": bind["aria-describedby"] })}
    </GatedControl>
  );
}

/** `{value, label}` choices from either option shape the engine allows, with
 * labels resolved through the host's catalogue when `translatable_options`
 * is on (its default). Shared by `string`, `int`/`float` and `select`, which
 * is why all three read `options` and `allowCustom` the same way. */
export function useChoices(config: FeatureConfig): readonly Choice[] {
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
export function isClosedList(config: FeatureConfig, choiceCount: number): boolean {
  return choiceCount > 0 && config["allowCustom"] === false;
}

/** `SelectConfig.uiStyle` — `dropdown` is the DEFAULT and, crucially, what an
 * ABSENT key means (`types/select/config.py`). The old
 * `cfg["uiStyle"] !== "dropdown"` test was true for absent, so an unconfigured
 * small single-select rendered inline where the config said dropdown. */
export function uiStyleOf(config: FeatureConfig): "dropdown" | "checkboxes" | "chips" {
  const declared = str(config["uiStyle"]);
  return declared === "checkboxes" || declared === "chips" ? declared : "dropdown";
}

/**
 * Choices → chips, with the column's touch floor applied to each label and an
 * optional reason that switches one off (a cardinality cap).
 *
 * ── Why every chip states its own aria-label ─────────────────────────────
 *
 * `touchFloor` wraps each label in a `<span>` so a chip is a 44px tap target.
 * That makes the label a NODE, and the bridge has no string form for a node —
 * so the chip that carries the field's `id` (the first of every group, which
 * must have an explicit accessible name or the field's `<label>` overrides it)
 * fell all the way through to `option.value` and was announced as the STORAGE
 * CODE: "b-u" where the screen said "Estate", `4d-sedan` where it said "Sedan", on the first chip of every
 * group in the composer. Nothing on screen showed it.
 *
 * The plain `choice.label` is right here and nowhere else — this function is
 * the one place that holds both the words and the node built out of them — so
 * it is stated, on every chip rather than only the first: which chip carries
 * the id is the row's business, not this one's, and a name that is correct
 * only in the position the caller happens to render it in is a defect waiting
 * for a reorder.
 */
export function chipOptions(
  choices: readonly Choice[],
  options: {
    readonly touchFloor: boolean;
    /** The whole control is off (a submit in flight, a locked config). The
     * reason — when there is one — is already beside the control, so a chip
     * switched off this way says nothing of its own. */
    readonly disabled?: boolean;
    /** Why this choice cannot be taken right now, as a finished sentence.
     * `undefined` leaves the chip live. */
    readonly disabledReason?: (value: string) => string | undefined;
  }
): readonly ChoiceChipOption[] {
  return choices.map((choice) => {
    const reason = options.disabled === true ? undefined : options.disabledReason?.(choice.value);
    return {
      value: choice.value,
      ariaLabel: choice.label,
      ...(options.disabled === true ? { disabled: true } : {}),
      label: options.touchFloor ? (
        <span
          style={{ display: "inline-flex", alignItems: "center", minHeight: CHIP_LABEL_FLOOR }}
        >
          {choice.label}
        </span>
      ) : (
        choice.label
      ),
      ...(reason === undefined ? {} : { disabled: true, disabledReason: reason }),
    };
  });
}

/** Choices → the sheet's rows. One function so a list drawn inline and the
 * same list drawn in a sheet can never disagree about labels. */
export function pickerOptions(choices: readonly Choice[]): readonly PickerOption[] {
  return choices.map((choice) => ({ value: choice.value, label: choice.label }));
}

/** Whether the chips a column draws need the label floor — see
 * {@link CHIP_LABEL_FLOOR}. Stamped as a data attribute so a test can prove
 * the floor was applied rather than describing it in prose. */
export function touchFloorMarker(
  touchFloor: boolean
): { "data-attributes-touch-floor": "" } | Record<string, never> {
  return touchFloor ? { "data-attributes-touch-floor": "" } : {};
}

/** Open/closed for one sheet, as three stable values. */
export function useDisclosure(): {
  readonly open: boolean;
  readonly show: () => void;
  readonly hide: () => void;
} {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => {
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
  }, []);
  return { open, show, hide };
}

export interface PickerTriggerProps {
  /** The row's `<label for>` target. A `<button>` is a labelable element, so
   * the field's label names it exactly as it would name an input. Absent on
   * a control that is not the row's primary one — a rung below the first of
   * a chain, where the label already names the chain. */
  readonly id?: string | undefined;
  /** What is chosen, already resolved to the person's language. Absent while
   * the field is unanswered — the placeholder is what shows then. */
  readonly value?: string | undefined;
  /** What to say when nothing is chosen. */
  readonly placeholder: string;
  /** How many answers are held, for a multiple field. Rendered as numerals
   * beside the label — a count is not prose and needs no key. */
  readonly count?: number;
  readonly onOpen: () => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly invalid?: boolean;
  readonly describedBy?: string | undefined;
  /** The accessible name, when the row's own `<label>` is not the whole
   * story (a rung of a chained reference names its LEVEL). */
  readonly ariaLabel?: string | undefined;
  readonly testId?: string;
  /** The sheet is open — announced, so a screen reader is not told about a
   * collapsed control while a dialog is on screen. */
  readonly expanded: boolean;
  readonly touchFloor?: boolean;
}

/**
 * The field a closed sheet leaves behind: what is chosen, and a way back in.
 *
 * It is a `<button>` and not an input on purpose. An input that opens a sheet
 * takes the keyboard focus, and on a phone the on-screen keyboard then covers
 * the sheet it just opened — the exact failure that makes an antd `Select` on
 * a phone unusable, reproduced one layer up. A button announces itself as
 * `aria-haspopup="dialog"`, opens on Enter and Space, and never raises a
 * keyboard for a list nobody types into.
 */
export function PickerTrigger(props: PickerTriggerProps): ReactElement {
  const { token } = antdTheme.useToken();
  const chosen = props.value !== undefined && props.value.length > 0;
  const style: CSSProperties = {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: token.paddingXS,
    textAlign: "left",
    ...(props.touchFloor === true ? { minHeight: PHONE_CONTROL_HEIGHT } : {}),
    ...(props.invalid === true ? { borderColor: token.colorError } : {}),
  };
  return (
    <Button
      {...(props.id !== undefined ? { id: props.id } : {})}
      type="default"
      data-testid={props.testId ?? "attributes-picker-trigger"}
      data-attributes-picker-trigger={chosen ? "answered" : "empty"}
      data-analytics="none"
      data-analytics-reason="passthrough — the tracked step is the submit, not opening a picker"
      aria-haspopup="dialog"
      aria-expanded={props.expanded}
      disabled={props.disabled === true}
      {...(props.required === true ? { "aria-required": true } : {})}
      {...(props.ariaLabel !== undefined ? { "aria-label": props.ariaLabel } : {})}
      {...(props.describedBy !== undefined ? { "aria-describedby": props.describedBy } : {})}
      style={style}
      onClick={props.onOpen}
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          ...(chosen ? {} : { color: token.colorTextPlaceholder }),
        }}
      >
        {chosen ? props.value : props.placeholder}
      </span>
      {props.count !== undefined && props.count > 1 && (
        <Typography.Text type="secondary" data-attributes-chosen-count={props.count}>
          {String(props.count)}
        </Typography.Text>
      )}
    </Button>
  );
}

/**
 * A bound, said rather than enforced.
 *
 * The mirror refuses an out-of-range answer with the engine's own sentence,
 * and the control must not ALSO clamp it — a clamp rewrites what a person
 * typed while they are looking away. So min/max travel as a hint under the
 * field (and, for a number, as the empty box's placeholder), which is the
 * only form that survives being wrong.
 */
export function useRangeHint(): (
  min: string | undefined,
  max: string | undefined
) => string | undefined {
  const t = useT();
  return useCallback(
    (min: string | undefined, max: string | undefined): string | undefined => {
      if (min !== undefined && max !== undefined) {
        return t(ATTRIBUTES_I18N_KEYS.hintRange, { min, max });
      }
      if (min !== undefined) return t(ATTRIBUTES_I18N_KEYS.hintMin, { min });
      if (max !== undefined) return t(ATTRIBUTES_I18N_KEYS.hintMax, { max });
      return undefined;
    },
    [t]
  );
}

/** The empty box's placeholder for a bounded number: numerals and an en
 * dash, which is a range in every locale this ships in and therefore not a
 * sentence anybody has to translate. */
export function rangePlaceholder(
  min: number | undefined,
  max: number | undefined
): string | undefined {
  if (min !== undefined && max !== undefined) return `${String(min)}–${String(max)}`;
  return undefined;
}

/** A one-line help under a control — the units in words, the limit's meaning,
 * the count still to choose. */
export function HintLine(props: {
  readonly children: ReactNode;
  readonly testId?: string;
}): ReactElement {
  return (
    <Typography.Text
      type="secondary"
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      style={{ fontSize: "inherit" }}
    >
      {props.children}
    </Typography.Text>
  );
}

/** Re-exported so the editors import one chips control, not two. */
export { ChoiceChips };
