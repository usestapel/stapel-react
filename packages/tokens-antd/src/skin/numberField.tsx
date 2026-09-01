/**
 * `SkinNumberField` — a number typed on a phone, with its unit beside it and
 * its limits stated rather than enforced.
 *
 * ## The rule it states once
 *
 * **A numeric field raises the numeric keyboard, shows its unit as a postfix
 * that is not part of the value, and treats `min`/`max` as HINTS — never as
 * silent clamping or refusal while somebody is typing.**
 *
 * ## Why this is not antd's `InputNumber`
 *
 * `InputNumber` clamps. Typing `9` into a field with `max: 50` while aiming
 * for `95` leaves `9`; blurring a `120` in a `max: 100` field silently
 * rewrites it to `100` — a value the person never entered, in a field they
 * have stopped looking at, with no sentence anywhere saying what happened.
 * It also raises the full alphabetic keyboard on iOS unless it is talked out
 * of it. So this wraps a plain `Input`: `inputMode` decides the keypad,
 * nothing is rewritten, and an out-of-range value is the CALLER's validation
 * to display (`status` + `errorText`), beside the field, in words.
 *
 * ## Why it lives in `@stapel/tokens-antd/skin` and not in `@stapel/core`
 *
 * The whole component is the paint and the platform behaviour around one
 * string: the antd `Input` it wraps, the suffix slot the unit sits in, the
 * error tone, the 44px control height a phone theme sets. There is no
 * design-system-free half to lift into core — the "state" is a string the
 * caller already holds — and every default skin that draws a number already
 * depends on this package.
 *
 * ## The raw text is kept, deliberately
 *
 * A decimal field that re-derives its text from `String(value)` on every
 * keystroke deletes the `.` the moment it is typed (`"1."` → `1` → `"1"`),
 * so `1.5` cannot be typed at all. The component therefore owns the TEXT and
 * publishes the parsed number beside it; `value` from the outside only
 * overwrites the text when it disagrees with what the text already means.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Input, Typography, theme as antdTheme } from "antd";

export interface SkinNumberFieldProps {
  /** The value the caller holds. `undefined` = the field is empty. */
  readonly value?: number | undefined;
  /**
   * The parsed value, or `undefined` while the text is empty or not yet a
   * number ("-", "1."). Never a clamped or rounded one.
   */
  readonly onValueChange: (value: number | undefined) => void;
  /** Whole numbers only: decides the keypad (`numeric` vs `decimal`). Not a
   * filter — a person who pastes `1.5` into an integer field must be TOLD, by
   * the caller's validation, not silently corrected. */
  readonly integer?: boolean;
  /**
   * Rendered inside the box, after the number, as a suffix ("km", "m²").
   * It is never part of the value and never reaches `onValueChange`.
   */
  readonly unit?: ReactNode;
  /**
   * The limits as the caller has already phrased them ("20–500"). Shown as
   * the placeholder while the field is empty; the copy is the caller's
   * because the bridge owns no i18n and a range separator is a locale
   * decision.
   */
  readonly hintPlaceholder?: string;
  /** A line under the field — the units in words, what the limit means. */
  readonly helpText?: ReactNode;
  /** antd's status ring. The caller decides; nothing here validates. */
  readonly status?: "" | "error" | "warning";
  /** The refusal, in words, under the field. Linked by `aria-describedby`. */
  readonly errorText?: ReactNode;
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
  readonly id?: string;
  readonly onBlur?: () => void;
  readonly style?: CSSProperties;
  readonly className?: string;
  readonly testId?: string;
}

/**
 * Text → number, without ever rewriting the text.
 *
 * A comma is accepted as a decimal separator (half of Europe types one) and a
 * space is ignored (a pasted `1 250` is a number in most of the world's
 * grouping conventions). Anything that is not yet a number — `""`, `"-"`,
 * `"1."`, `"abc"` — is `undefined`: the absence of a value, which is what an
 * unfinished number IS.
 */
export function parseNumericText(raw: string): number | undefined {
  // `\s` already covers the non-breaking space; the class is spelled out so a
  // number pasted with a thin or narrow no-break group separator (`1 250` off
  // a spec sheet) parses the same way.
  const cleaned = raw.replace(/[\s\u00A0\u202F\u2009]/g, "").replace(",", ".");
  if (cleaned.length === 0) return undefined;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return undefined;
  if (!/\d/.test(cleaned)) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * A number input that keeps what was typed. Stamped
 * `data-stapel-number-field` with the keypad it asked for, so a pair's test
 * can prove the phone behaviour instead of describing it.
 *
 * ```tsx
 * <SkinNumberField
 *   integer
 *   value={mileage}
 *   onValueChange={setMileage}
 *   unit={t(KEYS.km)}
 *   hintPlaceholder="0–1 000 000"
 *   ariaLabel={t(KEYS.mileage)}
 * />
 * ```
 */
export function SkinNumberField(props: SkinNumberFieldProps): ReactElement {
  const { token } = antdTheme.useToken();
  const errorId = useId();
  const [text, setText] = useState<string>(props.value === undefined ? "" : String(props.value));
  const textRef = useRef(text);
  textRef.current = text;

  // The outside value wins only where it DISAGREES with the text: a form that
  // resets the field, a mirror that filled it in. `1.` stays `1.` while the
  // caller holds 1, because those are the same number.
  useEffect(() => {
    const own = parseNumericText(textRef.current);
    if (own === props.value) return;
    setText(props.value === undefined ? "" : String(props.value));
  }, [props.value]);

  const describedBy = props.errorText !== undefined ? errorId : undefined;

  return (
    <div
      data-stapel-number-field={props.integer === true ? "numeric" : "decimal"}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      style={{ display: "flex", flexDirection: "column", gap: token.paddingXXS, ...props.style }}
    >
      <Input
        value={text}
        // The keypad, and nothing else: `type="number"` would hand the browser
        // a spinner nobody can hit on a phone and a value the DOM reports as
        // "" for anything it dislikes — including the half-typed decimal this
        // component exists to preserve.
        inputMode={props.integer === true ? "numeric" : "decimal"}
        disabled={props.disabled === true}
        {...(props.id !== undefined ? { id: props.id } : {})}
        {...(props.ariaLabel !== undefined ? { "aria-label": props.ariaLabel } : {})}
        {...(describedBy !== undefined ? { "aria-describedby": describedBy } : {})}
        {...(props.status !== undefined && props.status !== "" ? { status: props.status } : {})}
        {...(props.hintPlaceholder !== undefined ? { placeholder: props.hintPlaceholder } : {})}
        {...(props.unit !== undefined ? { suffix: props.unit } : {})}
        {...(props.onBlur !== undefined ? { onBlur: props.onBlur } : {})}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          props.onValueChange(parseNumericText(next));
        }}
      />
      {props.helpText !== undefined && (
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {props.helpText}
        </Typography.Text>
      )}
      {props.errorText !== undefined && (
        <Typography.Text
          id={errorId}
          data-stapel-number-error=""
          style={{ fontSize: token.fontSizeSM, color: token.colorError }}
        >
          {props.errorText}
        </Typography.Text>
      )}
    </div>
  );
}
