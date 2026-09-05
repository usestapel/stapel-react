/**
 * `ChoiceChips` — a short set of answers, tapped instead of unfolded.
 *
 * ## The rule it states once
 *
 * **A choice of a handful of options is rendered INLINE as chips, never as a
 * dropdown.** A `Select` on a phone costs a tap to open, a portal that covers
 * the field it belongs to, and a list the person has to read before they can
 * see that it held three items; chips show all three at once, are 44px tall,
 * and answer in one tap. The threshold ("a handful") belongs to the caller —
 * an attribute editor draws chips up to six options and a sheet past that, a
 * search facet will pick its own number — but the CONTROL is one control, and
 * this is it.
 *
 * ## Why it lives in `@stapel/tokens-antd/skin` and not in `@stapel/core`
 *
 * Everything a chip is, is paint: the 44px touch floor, the wrap behaviour,
 * the selected/unselected/disabled tones, the focus ring — all of it reads the
 * live antd theme (`theme.useToken()`), which is what makes a chip row look
 * like the rest of a screen on both sides of `data-theme`. `@stapel/core` is
 * deliberately design-system-agnostic and carries no antd; a chips control
 * there could only ship geometry-free markup that every skin would then have
 * to re-paint, which is the duplication this substrate exists to end. The
 * SELECTION semantics are three lines of state the caller already holds, so
 * there is no headless half worth splitting out.
 *
 * ## A disabled chip says why, as text
 *
 * A chip that cannot be chosen renders its `disabledReason` as visible text
 * under the row, once per distinct sentence, with the chip's
 * `aria-describedby` pointing at it — the same shape `GatedControl` and
 * `PaneGate` use, for the same reason: a disabled control receives no pointer
 * events, so a tooltip on it is an explanation nobody can read
 * (`stapel/no-tooltip-in-skin`). And for the same reason the chip is
 * `aria-disabled` rather than html-`disabled`: it stays focusable and keeps
 * firing, so the sentence reaches a keyboard and a screen reader, while the
 * click handler is the thing that refuses the answer. It does NOT route through `GatedControl`
 * itself, because that component's contract is an `ActionAvailability` whose
 * `code` is an i18n KEY, and a chip's reason is copy the caller has already
 * translated; feeding a finished sentence to `t()` would be a lie in the one
 * place the fleet is strict about (`stapel/i18n-key-exists`).
 */
import { useId } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Typography, theme as antdTheme } from "antd";
import { useDialogSurface } from "./dialogSurface.js";
import { PHONE_CONTROL_HEIGHT } from "./theme.js";

export interface ChoiceChipOption {
  /** The code the caller stores. */
  readonly value: string;
  /** What the person reads. Copy the CALLER owns — the bridge invents none. */
  readonly label: ReactNode;
  /**
   * The chip's accessible NAME, when {@link label} is not plain text.
   *
   * A label may be a node — an icon beside the words, a `<span>` a caller
   * wraps every chip in to give it a tap target — and a node has no string
   * form this bridge is entitled to invent. Without this the first chip of a
   * group (the one that carries the field's `id`, and therefore needs an
   * explicit name) fell back to `option.value`, and a screen reader read the
   * STORAGE CODE where every sighted reader saw a word: "b-u" for "Estate",
   * `4d-sedan` for "Sedan".
   *
   * So the caller states it: it is the only party that has both the node and
   * the plain text that went into it. Optional, because a string label needs
   * no help.
   */
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  /**
   * Why this one cannot be chosen, as a finished sentence in the host's
   * locale. Rendered as visible text beside the row; never a tooltip.
   */
  readonly disabledReason?: string;
}

interface ChoiceChipsBase {
  readonly options: readonly ChoiceChipOption[];
  /**
   * `"row"` (default) — chips flow and wrap, the shape for short labels.
   * `"grid"` — equal columns, for a set whose labels are long enough that a
   * ragged row reads as noise.
   */
  readonly columns?: "row" | "grid";
  /** The group's accessible name (the field's label). */
  readonly ariaLabel?: string;
  /**
   * Lands on the FIRST chip — the group's focus target, the way a radio
   * group's label points at its first input. A caller that reveals "the
   * first unanswered field" by element id gets a focusable control, not a
   * wrapper `<div>` that swallows the focus call.
   */
  readonly id?: string;
  readonly style?: CSSProperties;
  readonly className?: string;
  readonly testId?: string;
}

export interface ChoiceChipsSingleProps extends ChoiceChipsBase {
  readonly mode: "single";
  readonly value?: string | undefined;
  /** Receives `undefined` only when {@link ChoiceChipsSingleProps.allowClear}
   * is on and the chosen chip was tapped again. */
  readonly onChange: (value: string | undefined) => void;
  /**
   * Tapping the chosen chip again clears the answer. Off by default: for a
   * REQUIRED field, "unanswer it" is not a state the person can usefully
   * reach by fumbling, and a chip that vanishes under a second tap reads as a
   * bug.
   */
  readonly allowClear?: boolean;
}

export interface ChoiceChipsMultiProps extends ChoiceChipsBase {
  readonly mode: "multi";
  readonly values: readonly string[];
  readonly onChange: (values: readonly string[]) => void;
}

export type ChoiceChipsProps = ChoiceChipsSingleProps | ChoiceChipsMultiProps;

/**
 * The narrowest a grid column gets before the chips reflow: wide enough for a
 * two-word label at the phone font size, so a grid of long answers is two
 * columns at 390px and not one column pretending to be a list.
 */
const GRID_COLUMN_MIN = 140;

/** A chip label as TEXT, for the aria-label the first chip needs: the label
 * when it is a string, the value when the caller rendered a node (a node has
 * no derivable name here, and the value is at least stable and unique). */
function labelText(label: ReactNode): string {
  return typeof label === "string" || typeof label === "number" ? String(label) : "";
}

/**
 * A chip's accessible name, in the order of who actually knows it.
 *
 * The caller's own {@link ChoiceChipOption.ariaLabel} first — it is the only
 * party holding both the node and the words inside it. A plain-text label
 * second. The stored VALUE last, and only because a chip carrying the field's
 * `id` must have some explicit name or the field's `<label>` overrides it and
 * the first answer is announced as the question.
 *
 * That last rung is a defect when it is reached and this order is why: a
 * caller that wraps its labels in a `<span>` (a touch floor, an icon) turned
 * every first chip of every group into its storage code — "Estate" read out as
 * "b-u" — and nothing on screen showed it.
 */
function chipAriaLabel(
  option: ChoiceChipOption,
  /** Does this chip carry the field's `id`? Only then does an unstated name
   * have to be invented at all — every other chip is named by its own
   * content, which is what a reader sees. */
  carriesFieldId: boolean
): string | undefined {
  if (option.ariaLabel !== undefined) return option.ariaLabel;
  if (!carriesFieldId) return undefined;
  return labelText(option.label) || option.value;
}

function isSelected(props: ChoiceChipsProps, value: string): boolean {
  return props.mode === "single" ? props.value === value : props.values.includes(value);
}

/**
 * The chip row. Stamped `data-stapel-choice-chips="single|multi"` and
 * `data-stapel-chips-columns="row|grid"`, so a pair's test can prove the
 * shape it inherited rather than asserting it in prose. Each chip carries
 * `data-stapel-chip="<value>"` and `aria-pressed`.
 *
 * ```tsx
 * <ChoiceChips
 *   mode="single"
 *   ariaLabel={t(KEYS.condition)}
 *   options={conditions}
 *   value={chosen}
 *   onChange={setChosen}
 * />
 * ```
 */
export function ChoiceChips(props: ChoiceChipsProps): ReactElement {
  const { token } = antdTheme.useToken();
  const phone = useDialogSurface() === "sheet";
  const baseId = useId();
  const grid = props.columns === "grid";

  // One copy per distinct sentence, under the row — six chips blocked for the
  // same reason print it once (the defect `PaneGate` was written for).
  const reasons: string[] = [];
  for (const option of props.options) {
    const reason = option.disabledReason;
    if (option.disabled === true && reason !== undefined && !reasons.includes(reason)) {
      reasons.push(reason);
    }
  }
  const reasonId = (reason: string): string =>
    `${baseId}-reason-${String(reasons.indexOf(reason))}`;

  // The touch floor, from the same place every other control gets it: 44px on
  // a phone, antd's control height elsewhere. Read from the theme rather than
  // written here, so a host that raises `controlHeight` raises the chips too.
  const minHeight = phone ? PHONE_CONTROL_HEIGHT : token.controlHeight;

  const chipStyle = (selected: boolean, disabled: boolean): CSSProperties => ({
    minHeight,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: grid ? "center" : "flex-start",
    textAlign: grid ? "center" : "left",
    gap: token.paddingXXS,
    padding: `${String(token.paddingXXS)}px ${String(token.paddingSM)}px`,
    borderRadius: token.borderRadiusLG,
    borderWidth: token.lineWidth,
    borderStyle: token.lineType,
    borderColor: selected ? token.colorPrimary : token.colorBorder,
    background: disabled
      ? token.colorBgContainerDisabled
      : selected
        ? token.colorPrimary
        : token.colorBgContainer,
    color: disabled
      ? token.colorTextDisabled
      : selected
        ? token.colorTextLightSolid
        : token.colorText,
    fontSize: token.fontSize,
    cursor: disabled ? "not-allowed" : "pointer",
    // A label wraps at its spaces and is never cut: an ellipsis in the middle
    // of "Very good condition" turns three answers into three guesses. The
    // row grows instead — which is why the container wraps too.
    whiteSpace: "normal",
    wordBreak: "normal",
    maxWidth: "100%",
  });

  const choose = (value: string, selected: boolean): void => {
    if (props.mode === "single") {
      if (selected) {
        if (props.allowClear === true) props.onChange(undefined);
        return;
      }
      props.onChange(value);
      return;
    }
    props.onChange(
      selected ? props.values.filter((entry) => entry !== value) : [...props.values, value]
    );
  };

  return (
    <div
      data-stapel-choice-chips={props.mode}
      data-stapel-chips-columns={grid ? "grid" : "row"}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      style={{ display: "flex", flexDirection: "column", gap: token.paddingXS, ...props.style }}
    >
      <div
        role="group"
        {...(props.ariaLabel !== undefined ? { "aria-label": props.ariaLabel } : {})}
        style={
          grid
            ? {
                display: "grid",
                gridTemplateColumns: `repeat(auto-fit, minmax(${String(GRID_COLUMN_MIN)}px, 1fr))`,
                gap: token.paddingXS,
              }
            : { display: "flex", flexWrap: "wrap", gap: token.paddingXS }
        }
      >
        {props.options.map((option, index) => {
          const selected = isSelected(props, option.value);
          const disabled = option.disabled === true;
          const reason = disabled ? option.disabledReason : undefined;
          return (
            <button
              key={option.value}
              // The id makes the first chip the target of the field's own
              // <label htmlFor>; without an explicit aria-label that label
              // would OVERRIDE the chip's accessible name (label-element
              // beats content in accname computation) and the first answer
              // would be announced as the question. aria-label outranks the
              // label element, so the chip keeps saying what it answers.
              //
              // A caller-stated `ariaLabel` reaches EVERY chip, not only that
              // one: a label that is a node has no text form this bridge can
              // read, and a name that happens to be right in position 0 is a
              // defect waiting for a reorder.
              {...(index === 0 && props.id !== undefined ? { id: props.id } : {})}
              {...(chipAriaLabel(option, index === 0 && props.id !== undefined) !==
              undefined
                ? {
                    "aria-label": chipAriaLabel(
                      option,
                      index === 0 && props.id !== undefined
                    ),
                  }
                : {})}
              type="button"
              aria-pressed={selected}
              // `aria-disabled`, never html `disabled` — the same correction
              // `GatedControl` carries: an html-disabled chip fires nothing,
              // so it cannot take focus and the sentence its
              // `aria-describedby` points at is never announced with it. The
              // answer is withheld in the handler instead.
              {...(disabled ? { "aria-disabled": true as const } : {})}
              data-stapel-chip={option.value}
              data-analytics="none"
              data-analytics-reason="passthrough — the caller's onChange carries the tracked answer"
              {...(reason !== undefined ? { "aria-describedby": reasonId(reason) } : {})}
              onClick={() => {
                if (disabled) return;
                choose(option.value, selected);
              }}
              style={chipStyle(selected, disabled)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {reasons.length > 0 && (
        <div
          data-stapel-chip-reasons=""
          style={{ display: "flex", flexDirection: "column", gap: token.paddingXXS }}
        >
          {reasons.map((reason) => (
            <Typography.Text
              key={reason}
              id={reasonId(reason)}
              type="secondary"
              data-stapel-gated-reason=""
              style={{ fontSize: token.fontSizeSM }}
            >
              {reason}
            </Typography.Text>
          ))}
        </div>
      )}
    </div>
  );
}
