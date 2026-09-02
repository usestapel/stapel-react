/**
 * `string` — the one type that is a text box, a code box, a suggestion list
 * and a closed vocabulary depending on four config keys.
 *
 * ── The rule this file states ──────────────────────────────────────────────
 *
 * **A length limit is COUNTED, never capped.** The DOM's `maxlength` counts
 * UTF-16 code units and the engine counts Unicode CODE POINTS, so a hard cap
 * stops a person two emoji short of the real limit with no message, no error
 * and no way to tell the keyboard has stopped working. `CountedInput` draws
 * the counter in the engine's own unit — the same `codePointLength` the
 * mirror refuses with, imported from `validate.ts` rather than re-derived, so
 * the number under the box and the number in the refusal cannot disagree.
 *
 * ── When the box is monospace, and why it is a heuristic ───────────────────
 *
 * A VIN, an IMEI, a serial: seventeen characters a person checks against a
 * document, where `0`/`O` and `1`/`l` have to be told apart. The catalogue
 * does not say "this is a code", so {@link looksLikeCode} infers it from what
 * a code's config actually looks like, in two arms:
 *
 *  - a `pattern` that cannot match a space (no literal space, no `\s`, no
 *    `.`) — a field whose grammar forbids spaces is not prose; or
 *  - a FIXED length ({@link CODE_MAX_LENGTH} or shorter, with `minLength ===
 *    maxLength`) — "exactly 17 characters" is an identifier, while "up to 17"
 *    is a short headline.
 *
 * Both arms are conservative on purpose: guessing "code" for prose costs a
 * person a typeface they did not ask for, so the wrong answer must be the
 * rare one. A multiline field is never a code.
 *
 * The same inference turns on `normalize`: a code pasted out of a PDF arrives
 * with spaces and a trailing newline, and a field that accepts it and then
 * fails validation is telling somebody their correct answer is wrong. Spaces
 * are stripped on PASTE and on blur — never per keystroke, which would make
 * two words impossible to type. Case is left alone: a pattern that demands
 * lower case exists, and upper-casing would break exactly the fields this
 * helps.
 */
import { AutoComplete, Flex, Typography } from "antd";
import { SkinInput as Input } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { CountedInput, SkinPickerSheet } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { ValueEditor, ValueEditorProps } from "../registry.js";
import { featureName } from "../types.js";
import { codePointLength } from "../validate.js";
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
  requiredAria,
  str,
  touchFloorMarker,
  useChoices,
  useDisclosure,
  useRangeHint,
} from "./editorKit.js";

/** The longest a value can be and still read as a code. Above it, a fixed
 * length is a sentence somebody was told to write exactly. */
const CODE_MAX_LENGTH = 32;

/** Whitespace, as a paste strips it out of a code. */
const WHITESPACE = /\s+/g;

/** See the module note. Pure and parameterised rather than config-reading, so
 * `test/configKeys.test.ts` still sees every key IN the editor's own body. */
export function looksLikeCode(
  pattern: string,
  minLength: number | undefined,
  maxLength: number | undefined,
  multiline: boolean
): boolean {
  if (multiline) return false;
  if (pattern.length > 0) {
    return !/[ ]/.test(pattern) && !pattern.includes("\\s") && !pattern.includes(".");
  }
  return (
    maxLength !== undefined && maxLength <= CODE_MAX_LENGTH && minLength === maxLength
  );
}

/**
 * `string` → a counted text box, a closed picker when the options are a fixed
 * vocabulary, and an `AutoComplete` when they are suggestions.
 */
const StringEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const touchFloor = useTouchFloor();
  const rangeHint = useRangeHint();
  const choices = useChoices(cfg);
  const closed = isClosedList(cfg, choices.length);
  const sheet = useDisclosure();
  const placeholder = str(cfg["placeholder"]);
  const value = str(props.value);
  const minLength = numberish(cfg["minLength"]);
  const maxLength = numberish(cfg["maxLength"]);
  const pattern = str(cfg["pattern"]);
  const multiline = cfg["multiline"] === true;
  // `prefix`/`postfix` are TRANSLATION KEYS upstream
  // (`types/string/type.py:get_translation_keys`), never literal copy.
  const prefix = configLabel(t, cfg["prefix"]);
  const postfix = configLabel(t, cfg["postfix"]);

  if (closed) {
    const chosen = choices.find((choice) => choice.value === value);
    if (choices.length <= CHIPS_MAX_OPTIONS) {
      return (
        <div id={props.id} {...touchFloorMarker(touchFloor)}>
          <ChoiceChips
            mode="single"
            ariaLabel={featureName(props.feature)}
            options={chipOptions(choices, { touchFloor, disabled: props.disabled === true })}
            testId="attributes-string-chips"
            {...(chosen !== undefined ? { value: chosen.value } : {})}
            onChange={(next) => props.onChange(next)}
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
          testId="attributes-string-trigger"
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
          options={pickerOptions(choices)}
          searchPlaceholder={t(ATTRIBUTES_I18N_KEYS.pickerSearch)}
          refineLabel={t(ATTRIBUTES_I18N_KEYS.pickerRefine)}
          emptyLabel={t(ATTRIBUTES_I18N_KEYS.vocabularyNoMatches)}
          testId="attributes-string-sheet"
          {...(chosen !== undefined ? { value: chosen.value } : {})}
          onChange={(next) => props.onChange(next.length > 0 ? next : undefined)}
        />
      </>
    );
  }

  // Options + `allowCustom` (the default): the list is a SUGGESTION, so the
  // control must SHOW it and still take anything typed. This branch keeps
  // antd's own counter rather than `CountedInput`, because `AutoComplete`
  // CLONES its child and injects `value`/`onChange`/`disabled` into it — a
  // component with its own paste and blur normalization underneath that is a
  // second owner of the same string.
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
        <Input
          {...errorStatus(props.error)}
          {...requiredAria(props)}
          {...(placeholder.length > 0 ? { placeholder } : {})}
          {...(minLength !== undefined ? { minLength } : {})}
          {...(prefix.length > 0 ? { prefix } : {})}
          {...(postfix.length > 0 ? { suffix: postfix } : {})}
          {...(pattern.length > 0 ? { pattern } : {})}
          {...(maxLength !== undefined
            ? {
                showCount: {
                  formatter: ({ value: text }: { value: string }): string =>
                    `${codePointLength(text)} / ${maxLength}`,
                },
              }
            : {})}
        />
      </AutoComplete>
    );
  }

  const code = looksLikeCode(pattern, minLength, maxLength, multiline);
  const hint = rangeHint(
    minLength === undefined ? undefined : String(minLength),
    // The counter already carries the ceiling; the line under the field is
    // for the FLOOR, which nothing else on screen says.
    undefined
  );

  const field = (
    <CountedInput
      id={props.id}
      value={value}
      // The engine's own unit, from the engine's own mirror.
      countOf={codePointLength}
      disabled={props.disabled === true}
      ariaLabel={featureName(props.feature)}
      {...(props.required === true ? { ariaRequired: true } : {})}
      testId="attributes-string-field"
      {...errorStatus(props.error)}
      {...(maxLength !== undefined ? { maxLength } : {})}
      {...(multiline ? { multiline: true, rows: 3 } : {})}
      {...(code ? { mono: true, normalize: stripSpaces } : {})}
      {...(placeholder.length > 0 ? { placeholder } : {})}
      onChange={(next) => props.onChange(next.length > 0 ? next : undefined)}
    />
  );

  const boxed =
    prefix.length === 0 && postfix.length === 0 ? (
      field
    ) : (
      // `CountedInput` owns one box and no affixes; the catalogue's
      // `prefix`/`postfix` are drawn beside it rather than inside, so the
      // counted string never contains a currency symbol or a unit.
      <Flex align="center" gap={spacing[2]}>
        {prefix.length > 0 && (
          <Typography.Text type="secondary" data-attributes-prefix="">
            {prefix}
          </Typography.Text>
        )}
        <div style={{ flex: 1 }}>{field}</div>
        {postfix.length > 0 && (
          <Typography.Text type="secondary" data-attributes-postfix="">
            {postfix}
          </Typography.Text>
        )}
      </Flex>
    );

  if (hint === undefined) return boxed;
  return (
    <Flex vertical gap={spacing[1]}>
      {boxed}
      <HintLine testId="attributes-length-hint">{hint}</HintLine>
    </Flex>
  );
};

/** A code pasted out of a document arrives with the document's whitespace. */
function stripSpaces(text: string): string {
  return text.replace(WHITESPACE, "");
}

export { StringEditor };
