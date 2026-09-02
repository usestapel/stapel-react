/**
 * `CountedInput` — a text field whose limit is COUNTED in front of the
 * person, in the unit the backend actually validates in.
 *
 * ## The rule it states once
 *
 * **A length limit is shown as a live counter, never enforced as a silent
 * cap.** The DOM's `maxlength` counts UTF-16 code units; a Django
 * `max_length` and this fleet's own validators count Unicode CODE POINTS. A
 * `maxlength={32}` attribute therefore stops a person two emoji short of the
 * real limit — with no message, no error, and no way to tell that the keyboard
 * has stopped working. So the limit arrives as a counter, in the engine's own
 * unit (`attributes-react` established the precedent for `string` fields;
 * this is that decision, once, for the fleet), and the field itself is never
 * capped below what the counter promises.
 *
 * ## Why it lives in `@stapel/tokens-antd/skin` and not in `@stapel/core`
 *
 * It is an antd `Input`/`Input.TextArea` plus a line of type under it: the
 * counter's colour comes from the live theme's `colorError`, the monospace
 * face from `@stapel/tokens`' font stack, the field's height from the phone
 * theme's `controlHeight`. Nothing here is design-system-free, and the state
 * is the caller's string. The counter is drawn by this component rather than
 * through antd's own `showCount` because antd hangs a textarea's counter
 * BELOW the box, absolutely positioned, on top of whatever help line the
 * field already has.
 *
 * ## `normalize` runs on PASTE and on BLUR
 *
 * A VIN copied out of a PDF arrives with spaces and a trailing newline. A
 * field that accepts it and fails validation afterwards is telling somebody
 * their correct answer is wrong. `normalize` (strip spaces, upper-case, trim)
 * is applied where the foreign text ENTERS — the paste — and once more when
 * the person leaves the field, which is the last moment a fix is still
 * invisible to them. It is never applied per keystroke: a normalizer that
 * strips spaces mid-typing makes it impossible to type two words.
 */
import { useId } from "react";
import type {
  ClipboardEvent as ReactClipboardEvent,
  CSSProperties,
  ReactElement,
  ReactNode,
} from "react";
import { Input, Typography, theme as antdTheme } from "antd";
import { fontFamily } from "@stapel/tokens";

/** The counter element's test id — fixed, so a pair's test finds it. */
export const COUNTER_TESTID: string = "stapel-counted-input-counter";

/**
 * Length in Unicode CODE POINTS — the unit the backend validates in, and the
 * unit `"👨‍👩‍👧".length === 8` is not.
 */
export function codePointLength(value: string): number {
  return [...value].length;
}

export interface CountedInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /**
   * The limit the counter promises. NOT passed to the DOM — see the module
   * doc. Omit for a counter that only counts.
   */
  readonly maxLength?: number;
  /** How length is measured. Default {@link codePointLength}. */
  readonly countOf?: (value: string) => number;
  /** Render the field in the token font stack's monospace face — for a code
   * (a VIN, an IMEI, a serial) where `0`/`O` and `1`/`l` have to be told
   * apart while it is being checked against a document. */
  readonly mono?: boolean;
  /** Applied to pasted text, and to the whole value on blur. */
  readonly normalize?: (value: string) => string;
  /** A textarea instead of one line. */
  readonly multiline?: boolean;
  /** Rows for the textarea. */
  readonly rows?: number;
  /** How the counter reads. Default `"n / max"`, or the bare count with no
   * `maxLength`. Numerals and a separator — no prose, so no i18n key. */
  readonly formatCount?: (count: number, max: number | undefined) => string;
  readonly placeholder?: string;
  readonly ariaLabel?: string;
  /** `aria-required` on the field. A prop rather than a rest-spread so the
   * one accessibility attribute a required field owes is a stated part of the
   * contract, not an accident of forwarding. */
  readonly ariaRequired?: boolean;
  readonly id?: string;
  readonly status?: "" | "error" | "warning";
  /** The refusal, in words, under the field. */
  readonly errorText?: ReactNode;
  readonly disabled?: boolean;
  readonly onBlur?: () => void;
  readonly style?: CSSProperties;
  readonly className?: string;
  readonly testId?: string;
}

function defaultFormatCount(count: number, max: number | undefined): string {
  return max === undefined ? String(count) : `${String(count)} / ${String(max)}`;
}

/**
 * A counted text field. Stamped `data-stapel-counted-input="under|over"`, so
 * a pair's test can prove that over-limit is a VISIBLE state rather than a
 * blocked keystroke.
 *
 * ```tsx
 * <CountedInput
 *   mono
 *   value={vin}
 *   onChange={setVin}
 *   maxLength={17}
 *   normalize={(text) => text.replace(/\s/g, "").toUpperCase()}
 *   ariaLabel={t(KEYS.vin)}
 * />
 * ```
 */
export function CountedInput(props: CountedInputProps): ReactElement {
  const { token } = antdTheme.useToken();
  const counterId = useId();
  const errorId = useId();
  const count = (props.countOf ?? codePointLength)(props.value);
  const over = props.maxLength !== undefined && count > props.maxLength;
  const format = props.formatCount ?? defaultFormatCount;

  const onPaste = (
    event: ReactClipboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const normalize = props.normalize;
    if (normalize === undefined) return;
    const pasted = event.clipboardData.getData("text");
    const cleaned = normalize(pasted);
    event.preventDefault();
    const target = event.currentTarget;
    // Replace the SELECTION, not the whole field: pasting over a highlighted
    // half of a code is a real edit, and a component that appends instead
    // would be corrupting it.
    const start = target.selectionStart ?? props.value.length;
    const end = target.selectionEnd ?? start;
    props.onChange(props.value.slice(0, start) + cleaned + props.value.slice(end));
  };

  const onBlur = (): void => {
    const normalize = props.normalize;
    if (normalize !== undefined) {
      const cleaned = normalize(props.value);
      if (cleaned !== props.value) props.onChange(cleaned);
    }
    props.onBlur?.();
  };

  const describedBy = [counterId, props.errorText !== undefined ? errorId : undefined]
    .filter((id): id is string => id !== undefined)
    .join(" ");

  const fieldStyle: CSSProperties | undefined =
    props.mono === true ? { fontFamily: fontFamily.mono } : undefined;

  const shared = {
    value: props.value,
    disabled: props.disabled === true,
    "aria-describedby": describedBy,
    onPaste,
    onBlur,
    onChange: (event: { readonly target: { readonly value: string } }): void => {
      props.onChange(event.target.value);
    },
    ...(props.id !== undefined ? { id: props.id } : {}),
    ...(props.ariaLabel !== undefined ? { "aria-label": props.ariaLabel } : {}),
    ...(props.ariaRequired === true ? { "aria-required": true } : {}),
    ...(props.placeholder !== undefined ? { placeholder: props.placeholder } : {}),
    ...(props.status !== undefined && props.status !== "" ? { status: props.status } : {}),
    ...(fieldStyle !== undefined ? { style: fieldStyle } : {}),
  };

  return (
    <div
      data-stapel-counted-input={over ? "over" : "under"}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      style={{ display: "flex", flexDirection: "column", gap: token.paddingXXS, ...props.style }}
    >
      {props.multiline === true ? (
        <Input.TextArea {...shared} rows={props.rows ?? 3} />
      ) : (
        <Input {...shared} />
      )}
      <Typography.Text
        id={counterId}
        data-testid={COUNTER_TESTID}
        style={{
          alignSelf: "flex-end",
          fontSize: token.fontSizeSM,
          // Over the limit the counter is the warning: the keystroke was
          // never refused, so this is the only thing that says so.
          color: over ? token.colorError : token.colorTextSecondary,
        }}
      >
        {format(count, props.maxLength)}
      </Typography.Text>
      {props.errorText !== undefined && (
        <Typography.Text
          id={errorId}
          data-stapel-counted-error=""
          style={{ fontSize: token.fontSizeSM, color: token.colorError }}
        >
          {props.errorText}
        </Typography.Text>
      )}
    </div>
  );
}
