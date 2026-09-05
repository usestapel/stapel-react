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
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Flex, Select, Spin, Typography } from "antd";
import { SkinButton as Button } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { SkinNumberField, SkinPickerSheet } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { ValueEditor, ValueEditorProps } from "../registry.js";
import { featureName } from "../types.js";
import { firstCode, optionsRefOf, termPageOf, useVocabularyClient } from "../vocabulary.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";
import { ERROR_CODE_TO_KEY } from "../errors.js";
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
 * At most this many values a BOUNDED int offers as a list.
 *
 * A year (1900–2026) is 127 rows and a scroll a person can reach the end of;
 * a mileage cap (0–1 000 000) is not a list at all, and materializing one
 * would be a megabyte of DOM offering nothing the keypad does not. Above the
 * cap the control is the keypad and the steppers, with the range said under
 * it — which is the state this package was already in, kept for the fields
 * where a list is genuinely the wrong shape.
 */
export const BOUNDED_INT_MAX_OPTIONS = 300;

/** The values a closed integer range contains, or `null` when it is not a
 * listable set — an open end, a fractional bound, or more values than a
 * person can be handed ({@link BOUNDED_INT_MAX_OPTIONS}). */
export function boundedIntValues(
  min: number | undefined,
  max: number | undefined
): readonly number[] | null {
  if (min === undefined || max === undefined) return null;
  if (!Number.isInteger(min) || !Number.isInteger(max)) return null;
  const count = max - min + 1;
  if (count < 1 || count > BOUNDED_INT_MAX_OPTIONS) return null;
  return Array.from({ length: count }, (_, index) => min + index);
}

/** The two arrows that walk an allowed set. A target of `undefined` is the
 * end of the set, and the arrow greys there — the boundary the control
 * communicates by being unable to cross it. */
function IntSteppers(props: {
  readonly disabled: boolean;
  readonly down: number | undefined;
  readonly up: number | undefined;
  readonly onPick: (value: number) => void;
}): ReactElement {
  const t = useT();
  return (
    <>
      <Button
        aria-label={t(ATTRIBUTES_I18N_KEYS.intStepDown)}
        data-testid="attributes-int-step-down"
        disabled={props.disabled || props.down === undefined}
        data-disabled-reason="already at the lowest allowed value — the boundary the greyed arrow itself communicates"
        data-analytics="none"
        data-analytics-reason="passthrough — the committed value lands in the form's own onChange"
        onClick={() => props.down !== undefined && props.onPick(props.down)}
      >
        −
      </Button>
      <Button
        aria-label={t(ATTRIBUTES_I18N_KEYS.intStepUp)}
        data-testid="attributes-int-step-up"
        disabled={props.disabled || props.up === undefined}
        data-disabled-reason="already at the highest allowed value — the boundary the greyed arrow itself communicates"
        data-analytics="none"
        data-analytics-reason="passthrough — the committed value lands in the form's own onChange"
        onClick={() => props.up !== undefined && props.onPick(props.up)}
      >
        +
      </Button>
    </>
  );
}

/** The allowed values, as rows a thumb can hit. One panel for both int
 * controls, so the vocabulary-backed set and the bounded range cannot drift
 * apart in shape, geometry or test id. */
function IntSuggestions(props: {
  readonly label: string;
  readonly values: readonly number[];
  readonly onPick: (value: number) => void;
}): ReactElement {
  return (
    <div
      role="listbox"
      aria-label={props.label}
      data-testid="attributes-int-suggestions"
      style={{
        maxHeight: INT_SUGGESTIONS_MAX_HEIGHT,
        overflowY: "auto",
        marginTop: spacing[1],
      }}
    >
      {props.values.map((one) => (
        <Button
          key={one}
          type="text"
          block
          role="option"
          data-int-suggestion=""
          data-analytics="none"
          data-analytics-reason="passthrough — the caller's onChange carries the tracked pick"
          onClick={() => props.onPick(one)}
        >
          {String(one)}
        </Button>
      ))}
    </div>
  );
}

/**
 * The allowed set as the ELEMENT states it.
 *
 * The suggestions panel above is what a thumb operates; this is what a
 * MACHINE reads — the browser's own autofill, an accessibility tree, and the
 * walker that measures the deployed field. Both int editors knew their set
 * and neither put a word of it on the input: a deployed year field answered
 * `min: null, max: null, list: null` while the page beside it printed the
 * range in words (walker D392), so nothing could tell a bounded field from a
 * free one without reading the prose.
 *
 * It is a statement, never a gate: the control is a text input with a keypad
 * (`SkinNumberField` refuses `type="number"` on purpose), so the browser
 * enforces none of this and the server stays the only judge.
 */
function IntAllowedList(props: {
  readonly id: string;
  readonly values: readonly number[];
}): ReactElement {
  return (
    <datalist id={props.id} data-testid="attributes-int-datalist">
      {props.values.map((one) => (
        <option key={one} value={String(one)} />
      ))}
    </datalist>
  );
}

/**
 * The DOM half of a bound. `pattern` admits a leading minus only where the
 * bound itself does — a pattern stricter than the values the field accepts
 * would be native validation refusing something this package permits.
 */
function intDomBounds(
  min: number | undefined,
  max: number | undefined,
  listId: string | undefined
): {
  readonly min?: number;
  readonly max?: number;
  readonly pattern: string;
  readonly list?: string;
} {
  return {
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    pattern: min !== undefined && min >= 0 ? "[0-9]*" : "-?[0-9]*",
    ...(listId !== undefined ? { list: listId } : {}),
  };
}

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
 *
 * ── The two states that used to be A BARE KEYPAD ─────────────────────────
 *
 * `allowed === null` covers three different situations and this editor drew
 * one control for all of them: a plain number box with no steppers, no list
 * and nothing said. Two of the three are not "there is no set" at all —
 *
 *  - the FETCH IS IN FLIGHT. The set is coming; the box that will gain
 *    steppers and a list is on screen claiming it is a free-text number, and
 *    the controls then appear under the hand. It is now marked busy while it
 *    waits.
 *  - the PARENT IS UNANSWERED. A year scoped by a generation has no allowed
 *    set until a generation is chosen, and the useful thing to say is which
 *    field to fill in first — not to offer a box that will refuse every
 *    number it is given. The keypad is switched off with that sentence beside
 *    it, which is the house rule for anything switched off.
 *
 * The third — no client, a failed fetch, a page-capped answer — genuinely is
 * "this side cannot know the set", and the keypad stays exactly as it was:
 * the fetch is a convenience and the server is the gate.
 *
 * ── A refusal says what IS allowed ───────────────────────────────────────
 *
 * `not_in_options` renders as "Value is not in allowed options for Year",
 * which tells a person the number they typed is wrong and nothing about
 * which number is right. Where the set IS loaded, its ends are said beside
 * the refusal — the same sentence a typed out-of-set number already gets.
 *
 * ── The ELEMENT says it too ──────────────────────────────────────────────
 *
 * All of the above is what a thumb operates. `min`/`max`/`pattern` and a
 * `<datalist>` of the loaded set are the same facts written on the input, for
 * everything that READS the field instead of tapping it — the browser's
 * autofill, assistive tech, and the walker that measured this exact field
 * answering `min: null, max: null, list: null` beside a page that printed the
 * range in words (D392). Stated, never enforced: see {@link intDomBounds}.
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
  // The catalogue's own bound. The live set replaces it as the CONSTRAINT
  // (the hint under the control is suppressed for exactly that reason), but
  // while there is no set — no parent yet, a fetch in flight, a level this
  // side cannot know — it is still the truest thing the element can say.
  const cfgMin = numberish(cfg["min"]);
  const cfgMax = numberish(cfg["max"]);
  const listId = useId();

  // The allowed set for the CURRENT parent, ascending; `null` while loading
  // or when it cannot be trusted (no client, a failed fetch, a page-capped
  // answer, a non-numeric code). `null` renders a plain keypad — the fetch
  // is a convenience, the server is the gate.
  const [allowed, setAllowed] = useState<readonly number[] | null>(null);
  /** The set is COMING — distinct from "there is none", which is what a bare
   * keypad used to say for both. */
  const [pending, setPending] = useState(false);
  // A parent this pointer names and nobody has answered: there is no allowed
  // set to fetch, and the whole level is not "the allowed set of this parent".
  // Progressive disclosure normally keeps the row unmounted until then, but a
  // host drawing rows itself may not gate — and this is the state it lands in.
  const awaitingParent = parentFeature !== undefined && parent === undefined;
  useEffect(() => {
    setAllowed(null);
    setPending(false);
    if (client === null || vocabulary.length === 0 || level.length === 0) return;
    if (parentFeature !== undefined && parent === undefined) return;
    let stale = false;
    setPending(true);
    client
      .search(vocabulary, level, "", parent)
      .then((answered) => {
        // The allowed set is the whole level, in any order — the band tells a
        // picker where to draw a rule and says nothing about which integers
        // are permitted, so only the rows are read here.
        const { terms } = termPageOf(answered);
        if (stale) return;
        if (terms.length === 0 || terms.length >= REF_INT_PAGE) return;
        const numbers = terms.map((term) => Number.parseInt(term.code, 10));
        if (numbers.some((one) => !Number.isFinite(one))) return;
        setAllowed([...numbers].sort((left, right) => left - right));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!stale) setPending(false);
      });
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

  // The refusal that names WHAT IS ALLOWED. `not_in_options` on its own says
  // the number is wrong and nothing about which number is right; the ends of
  // the loaded set are the missing half, and they are already the sentence a
  // typed out-of-set number gets.
  const refusedNotInOptions =
    props.error?.code === ERROR_CODE_TO_KEY.not_in_options;

  // What the ELEMENT says about the set, beside what the panel and the
  // steppers do with it. The ends of the loaded set win over the catalogue's
  // static bound, because they are the constraint the server will apply.
  const listed = loaded && (allowed?.length ?? 0) > 0;
  const dom = intDomBounds(
    lowest ?? cfgMin,
    highest ?? cfgMax,
    listed ? listId : undefined
  );

  return (
    <div
      {...touchFloorMarker(touchFloor)}
      data-testid="attributes-int-ref"
      {...(pending ? { "aria-busy": true as const } : {})}
      data-state={
        awaitingParent
          ? "awaiting-parent"
          : pending
            ? "loading"
            : allowed === null
              ? "unbounded"
              : "bounded"
      }
    >
      <Flex align="center" gap={spacing[1]}>
        <div style={{ flex: 1 }}>
          <SkinNumberField
            id={props.id}
            value={current}
            integer
            disabled={props.disabled === true || baked || awaitingParent}
            ariaLabel={featureName(props.feature)}
            {...(props.required === true ? { ariaRequired: true } : {})}
            testId="attributes-number-field"
            {...errorStatus(props.error)}
            {...dom}
            {...(postfix.length > 0 ? { unit: postfix } : {})}
            {...(placeholder.length > 0 ? { hintPlaceholder: placeholder } : {})}
            onValueChange={commit}
          />
          {listed && <IntAllowedList id={listId} values={allowed ?? []} />}
        </div>
        {loaded && (
          <IntSteppers
            disabled={props.disabled === true}
            down={downTarget}
            up={upTarget}
            onPick={commit}
          />
        )}
        {/* The set is on its way. A spinner where the steppers will be, so
            the row is the height it will keep and the box does not claim to
            be a free-text number while the constraint is in flight. */}
        {pending && !awaitingParent && (
          <Spin size="small" data-testid="attributes-int-loading" />
        )}
      </Flex>
      {/* Switched off WITH ITS REASON — the house rule. A year scoped by a
          generation has no allowed set until a generation is chosen, and a
          live box that refuses every number is worse than one that says which
          field to fill in first. */}
      {awaitingParent && (
        <HintLine>
          <span data-testid="attributes-int-parent-first">
            {t(ATTRIBUTES_I18N_KEYS.refParentFirst, {
              parent: props.siblingNames?.[parentFeature ?? ""] ?? "",
            })}
          </span>
        </HintLine>
      )}
      {panel.length > 0 && (
        <IntSuggestions
          label={featureName(props.feature)}
          values={panel}
          onPick={commit}
        />
      )}
      {(outOfSet || refusedNotInOptions) &&
        lowest !== undefined &&
        highest !== undefined && (
          <HintLine>
            <span
              data-testid={
                outOfSet
                  ? "attributes-int-out-of-set"
                  : "attributes-int-refusal-range"
              }
            >
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

// ── int with a static or rule-given bound ───────────────────────────────────

/** Is this value inside the (possibly one-ended) bound? */
function withinBounds(
  value: number,
  min: number | undefined,
  max: number | undefined
): boolean {
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

/**
 * The bounded `int` — a year, a capacity, a number of doors.
 *
 * The founder's verdict on the state this replaces: *the prose was removed
 * but the mechanism for the person was not delivered* — the range travelled
 * as a placeholder and a grey line, and the control under it was a bare text
 * box that took 1899 as happily as 1999 and let the server say no. So the
 * bound is now something a person can OPERATE, in the shape the vocabulary-
 * backed int already had (they share this file's two pieces on purpose):
 *
 *  - the numeric KEYPAD stays the primary path, and nothing it is given is
 *    ever clamped or rewritten — `SkinNumberField`'s own rule;
 *  - a dropdown of the allowed values rides along whenever the range is
 *    listable ({@link BOUNDED_INT_MAX_OPTIONS}); a typed prefix filters it, a
 *    typed value inside the bound hides it, a typed value OUTSIDE the bound
 *    opens the whole set with the bound said in words — the dropdown is the
 *    recovery path, not a second control;
 *  - the steppers walk by one and grey at the ends;
 *  - the bound is on the ELEMENT as well as in the prose — `min`/`max`,
 *    `pattern`, and the `<datalist>` the dropdown draws from, for everything
 *    that reads the field rather than taps it ({@link intDomBounds});
 *  - when the bound MOVES under a parent's answer and the value no longer
 *    fits, the value is CLEARED and the hint shown. Never coerced: a year
 *    silently rewritten from 2016 to 2018 is a listing that says something
 *    nobody typed, in a field nobody is looking at any more.
 *
 * `min === max` (a `limit` rule pinning both ends) is the BAKE, and it is not
 * performed here: `<FeatureFields>` owns the write-back and the reason beside
 * the control (`soleAllowedValue`), so this file does not become a second
 * owner of the attribute. The control renders inert, which is what a baked
 * field looks like from the inside.
 */
function BoundedIntEditor(props: ValueEditorProps): ReactElement {
  const t = useT();
  const cfg = configOf(props);
  const touchFloor = useTouchFloor();
  const rangeHint = useRangeHint();
  const min = numberish(cfg["min"]);
  const max = numberish(cfg["max"]);
  const current = numberish(props.value);
  const placeholder = str(cfg["placeholder"]);
  const prefix = configLabel(t, cfg["prefix"]);
  const postfix = configLabel(t, cfg["postfix"]);
  const postfix1000 = configLabel(t, cfg["postfix1000"]);
  const suffix =
    postfix1000.length > 0 && current !== undefined && Math.abs(current) >= 1000
      ? postfix1000
      : postfix;
  const values = useMemo(() => boundedIntValues(min, max), [min, max]);
  const baked = min !== undefined && max !== undefined && min === max;
  const listId = useId();

  // What the person is TYPING, before the host round-trips it — so a
  // half-typed «201» filters the list on the keystroke rather than a render
  // later. External moves (a clear, a bake) are adopted back.
  const [typed, setTyped] = useState<number | undefined>(current);
  useEffect(() => {
    setTyped(current);
  }, [current]);

  // The list, opened by hand. Typing a value that fits closes it again: the
  // question has been answered, and a list standing open over the next field
  // is chrome the person did not ask for.
  const [open, setOpen] = useState(false);
  // The bound moved out from under the answer, and the answer was dropped.
  // Held so the sentence survives the value going away — without it the field
  // would simply empty itself and say nothing.
  const [cleared, setCleared] = useState(false);

  const onChange = props.onChange;
  const seenBound = useRef<string | undefined>(undefined);
  useEffect(() => {
    const canon = `${min ?? ""}:${max ?? ""}`;
    const before = seenBound.current;
    seenBound.current = canon;
    // A MOUNT is not a change: a seeded draft whose value no longer fits its
    // bound is the server's to refuse, and clearing it on first paint would
    // delete an answer the person never saw questioned.
    if (before === undefined || before === canon) return;
    if (current === undefined || withinBounds(current, min, max)) {
      setCleared(false);
      return;
    }
    setCleared(true);
    onChange(undefined);
  }, [min, max, current, onChange]);

  const commit = (next: number | undefined): void => {
    setTyped(next);
    setCleared(false);
    if (next !== undefined && withinBounds(next, min, max)) setOpen(false);
    onChange(next);
  };

  const inBounds = typed !== undefined && withinBounds(typed, min, max);
  const prefixMatched =
    values !== null && typed !== undefined && !inBounds
      ? values.filter((one) => String(one).startsWith(String(typed)))
      : [];
  const outOfBounds = typed !== undefined && !inBounds && prefixMatched.length === 0;
  const panel: readonly number[] =
    values === null || baked || props.disabled === true
      ? []
      : typed === undefined || inBounds
        ? open
          ? values
          : []
        : prefixMatched.length > 0
          ? prefixMatched
          : values;

  const up =
    values !== null
      ? typed === undefined
        ? values[0]
        : values.find((one) => one > typed)
      : typed === undefined
        ? min
        : max !== undefined && Math.floor(typed) + 1 > max
          ? undefined
          : Math.floor(typed) + 1;
  const down =
    values !== null
      ? typed === undefined
        ? values[values.length - 1]
        : [...values].reverse().find((one) => one < typed)
      : typed === undefined
        ? max
        : min !== undefined && Math.ceil(typed) - 1 < min
          ? undefined
          : Math.ceil(typed) - 1;

  // The bound, three ways, and never twice at once: as the empty box's
  // placeholder, as a grey line under it while the answer fits, and as the
  // out-of-bounds sentence — which NAMES the answers that set it when a rule
  // did, because "for this generation, from 2018 to 2024" is actionable and
  // "from 2018 to 2024" beside a year field is arithmetic.
  const both = min !== undefined && max !== undefined;
  const parents = (props.boundSources ?? []).filter((one) => one.length > 0);
  const refusal = !both
    ? rangeHint(
        min === undefined ? undefined : String(min),
        max === undefined ? undefined : String(max)
      )
    : parents.length > 0
      ? t(ATTRIBUTES_I18N_KEYS.intOutOfAllowedFor, {
          parents: parents.join(", "),
          min: String(min),
          max: String(max),
        })
      : t(ATTRIBUTES_I18N_KEYS.intOutOfAllowed, { min: String(min), max: String(max) });
  const shout = outOfBounds || cleared;
  const settled = rangeHint(
    min === undefined ? undefined : String(min),
    max === undefined ? undefined : String(max)
  );
  const box = rangePlaceholder(min, max);
  // The same bound, on the element — see {@link intDomBounds}. The list is
  // attached only where the range IS one (`boundedIntValues` caps it), so a
  // mileage field states its ends and offers no million-row datalist.
  const dom = intDomBounds(
    min,
    max,
    values !== null && !baked ? listId : undefined
  );

  const field = (
    <SkinNumberField
      id={props.id}
      value={current}
      integer
      disabled={props.disabled === true || baked}
      ariaLabel={featureName(props.feature)}
      {...(props.required === true ? { ariaRequired: true } : {})}
      testId="attributes-number-field"
      {...errorStatus(props.error)}
      {...dom}
      {...(suffix.length > 0 ? { unit: suffix } : {})}
      {...(placeholder.length > 0
        ? { hintPlaceholder: placeholder }
        : box !== undefined
          ? { hintPlaceholder: box }
          : {})}
      {...(!shout && settled !== undefined ? { helpText: <HintLine>{settled}</HintLine> } : {})}
      onValueChange={commit}
    />
  );

  return (
    <div {...touchFloorMarker(touchFloor)} data-testid="attributes-int-bounded">
      <Flex align="center" gap={spacing[1]}>
        {prefix.length > 0 && (
          <Typography.Text type="secondary" data-attributes-prefix="">
            {prefix}
          </Typography.Text>
        )}
        <div style={{ flex: 1 }}>
          {field}
          {values !== null && !baked && (
            <IntAllowedList id={listId} values={values} />
          )}
        </div>
        {!baked && values !== null && (
          <Button
            aria-label={t(ATTRIBUTES_I18N_KEYS.intChooseValue)}
            aria-expanded={panel.length > 0}
            data-testid="attributes-int-open"
            disabled={props.disabled === true}
            data-analytics="none"
            data-analytics-reason="passthrough — the tracked step is the submit, not opening a list"
            onClick={() => setOpen((was) => !was)}
          >
            ▾
          </Button>
        )}
        {!baked && (
          <IntSteppers
            disabled={props.disabled === true}
            down={down}
            up={up}
            onPick={commit}
          />
        )}
      </Flex>
      {panel.length > 0 && (
        <IntSuggestions
          label={featureName(props.feature)}
          values={panel}
          onPick={commit}
        />
      )}
      {shout && refusal !== undefined && (
        <HintLine>
          <span data-testid="attributes-int-out-of-range">{refusal}</span>
        </HintLine>
      )}
    </div>
  );
}

// ── int / float ──────────────────────────────────────────────────────────────

function makeNumberEditor(isInt: boolean): ValueEditor {
  const Editor = (props: ValueEditorProps): ReactElement => {
    // Both branches are taken BEFORE any hook, on config shape alone: a
    // pointer and a bound are properties of the catalogue's config, stable
    // for the life of the row.
    const cfg = configOf(props);
    if (isInt && optionsRefOf(cfg) !== undefined) {
      return <RefIntEditor {...props} />;
    }
    // A closed options list is a CHOICE, not a range — it keeps the chips and
    // the picker sheet `FreeNumberEditor` draws, whatever `min`/`max` say.
    const listed = Array.isArray(cfg["options"]) && cfg["options"].length > 0;
    const bounded =
      numberish(cfg["min"]) !== undefined || numberish(cfg["max"]) !== undefined;
    if (isInt && bounded && !(listed && cfg["allowCustom"] === false)) {
      return <BoundedIntEditor {...props} />;
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
