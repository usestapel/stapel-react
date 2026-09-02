/**
 * The antd BUILTIN value editors — one per value type `stapel_attributes`
 * ships (`types/`: thirteen of them), and the table that resolves them.
 *
 * ── Where these sit in the resolution ladder ───────────────────────────────
 *
 *   explicit `registerValueEditor(type, …)`   ← a host's, always wins
 *   → this table                               ← the skin's default
 *   → `<UnsupportedValueEditor/>`              ← loud, never silent
 *
 * ── Where the editors themselves live ──────────────────────────────────────
 *
 * The file used to hold all thirteen. The picker rework roughly doubled what
 * a choice-shaped editor does, so the set is split by SHAPE — each file
 * stating the one rule its editors obey — and this module keeps the types
 * that are neither a choice nor a number nor text, plus the table:
 *
 *  - `editorKit.tsx`     — the config readers, the lock wrapper, the chips
 *                          and trigger both halves of a choice share.
 *  - `editorsChoice.tsx` — `select`, `bool`. "A closed list is picked, not
 *                          unfolded"; an unanswered required bool is neither
 *                          yes nor no.
 *  - `editorsNumber.tsx` — `int`, `float`, `convertible_unit`. "A bound is a
 *                          hint, never a clamp."
 *  - `editorsText.tsx`   — `string`. "A length limit is counted, never
 *                          capped."
 *  - `editorsRef.tsx`    — `ref_select`, `ref_hierarchical_select`. "A list
 *                          that does not answer the box is never pickable."
 *  - here                — `date`, `header`, `hex_color`,
 *                          `hierarchical_select`, `group`.
 *
 * The public API is unchanged: {@link BUILTIN_VALUE_EDITORS},
 * {@link BUILTIN_VALUE_EDITOR_TYPES} and the two timestamp helpers are
 * exported from here exactly as before, and `/default`'s barrel is untouched.
 *
 * ── The rule this set is held to ───────────────────────────────────────────
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
 * `config[...]` keys the MIRROR reads must be a SUBSET of the set that type's
 * editor reads, both extracted from the source — now across the files above,
 * which the gate resolves by declaration name.
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
 *    one-element array, and a chip's scalar is wrapped on the way out.
 *
 * `convertible_unit` is the fourth object-valued type (`{value, unit}`), and
 * the editor must NOT convert anything itself: the server converts the number
 * from the submitted unit into the family's base unit before validating.
 */
import { useCallback, useMemo } from "react";
import type { ReactElement } from "react";
import { Cascader, ColorPicker, Flex, Select, Typography } from "antd";
import { SkinButton as Button, SkinInput as Input } from "@stapel/tokens-antd/skin";
import { actionBlocked, useI18n, useT } from "@stapel/core";
import {
  GatedControl,
  PHONE_CONTROL_HEIGHT,
  SkinNumberField,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { ValueEditor, ValueEditorProps } from "../registry.js";
import { resolveValueEditor } from "../registry.js";
import { featureName, featureType } from "../types.js";
import type { FeatureConfig } from "../types.js";
import { SIMPLE_COLORS, groupChildren, groupRowBounds, isBlank } from "../validate.js";
import { UnsupportedValueEditor } from "./notice.js";
import { formatFeatureValue } from "../format.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";
import { optionLabel } from "./labels.js";
import { useTouchFloor } from "./touchFloor.js";
import {
  HintLine,
  Lockable,
  configOf,
  errorStatus,
  numberish,
  rangePlaceholder,
  requiredAria,
  str,
  useRangeHint,
} from "./editorKit.js";
import { BoolEditor, SelectEditor } from "./editorsChoice.js";
import { ConvertibleUnitEditor, makeNumberEditor } from "./editorsNumber.js";
import { StringEditor } from "./editorsText.js";
import { RefHierarchicalSelectEditor, RefSelectEditor } from "./editorsRef.js";

/** One row of a composite: the cells a `group` holds, keyed by child slug. */
type GroupRow = Readonly<Record<string, unknown>>;

/** A blank row — a module constant so an added row is referentially stable. */
const EMPTY_ROW: GroupRow = {};

/** The subform's frame. antd's own `colorBorder` is not reachable outside a
 * `ConfigProvider` consumer, and a group's box is chrome, not a control, so it
 * takes the same neutral border every bordered surface in the skin does. */
const GROUP_BORDER = "var(--stapel-border, rgba(128,128,128,0.35))";

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

/**
 * `date` → the NATIVE input for its precision, with its bounds carried twice:
 * as the input's own `min`/`max` (so the platform's own picker greys out what
 * the engine would refuse) and as a line under the field in words.
 *
 * The native control is deliberate. A phone renders it as the OS date wheel a
 * person already knows, with their locale, their first day of the week and
 * their calendar — none of which a JS widget gets right for free, and all of
 * which cost a runtime dependency (dayjs) this package does not otherwise
 * need. The value on the wire is a Unix timestamp either way.
 */
const DateEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const { locale } = useI18n();
  const rangeHint = useRangeHint();
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

  const spell = useCallback(
    (seconds: number): string =>
      formatFeatureValue(props.feature, { type: "date", value: seconds }, { t, locale }) ??
      timestampToInputValue(seconds, precision),
    [props.feature, t, locale, precision]
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
      .map((seconds) => ({ value: String(seconds), label: spell(seconds) }));
  }, [cfg, spell]);

  const placeholder = str(cfg["placeholder"]);
  const hint = rangeHint(
    min === undefined ? undefined : spell(min),
    max === undefined ? undefined : spell(max)
  );

  return (
    <Flex vertical gap={spacing[1]}>
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
            const years = [
              min === undefined ? undefined : new Date(min * 1000).getFullYear(),
              max === undefined ? undefined : new Date(max * 1000).getFullYear(),
            ] as const;
            const box = rangePlaceholder(years[0], years[1]);
            return (
              <SkinNumberField
                id={props.id}
                integer
                ariaLabel={featureName(props.feature)}
                {...(props.required === true ? { ariaRequired: true } : {})}
                value={
                  current === undefined ? undefined : new Date(current * 1000).getFullYear()
                }
                disabled={bind.disabled}
                testId="attributes-date-year"
                {...errorStatus(props.error)}
                {...(placeholder.length > 0
                  ? { hintPlaceholder: placeholder }
                  : box !== undefined
                    ? { hintPlaceholder: box }
                    : {})}
                onValueChange={(year) => {
                  props.onChange(
                    year === undefined
                      ? undefined
                      : Math.floor(new Date(year, 0, 1).getTime() / 1000)
                  );
                }}
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
      {hint !== undefined && <HintLine testId="attributes-date-hint">{hint}</HintLine>}
    </Flex>
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
 * It keeps the `Cascader` where its vocabulary-backed cousin no longer does,
 * and the difference is the size of the tree: here the WHOLE tree is inlined
 * in the config (a category's body types, a size grid), so every column is
 * already in the browser and the control never shows a level that is empty
 * because something has not loaded. `ref_hierarchical_select` cannot say that
 * about an 812k-term vocabulary, which is why it became a chain of rungs.
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

// ── group (the composite) ────────────────────────────────────────────────────

/**
 * `group` → a bordered subform: a list of ROW CARDS, each row a set of child
 * features of the ordinary kinds.
 *
 * The value is `[{child_slug: value}, …]` — one object per row — and the whole
 * array travels through the ONE `onChange` this editor owns, per the registry
 * contract (an editor writes its own slug and nothing else). A cell's editor
 * is resolved through the same ladder as a top-level row, so a host's
 * registered editor is used inside a group too, and a kind that reaches the
 * notice at the top level reaches it in a cell.
 *
 * Three things it deliberately does NOT do, because the engine does not:
 *
 *  - **No nested groups.** A child of type `group` is refused by
 *    `validate_config` upstream; here it simply resolves to the notice like
 *    any undrawable type, rather than recursing.
 *  - **No rules inside.** A child carrying `rules` is a refused config
 *    upstream, so there is no rule pre-pass per row and no `narrowConfig`
 *    here — a cell's config is what the catalogue wrote.
 *  - **No per-cell error.** The server's refusal names the composite, not the
 *    cell (the batch result reduces `params` to `{feature, slug}`), so the
 *    row's own `Form.Item` carries it. Inventing a cell to blame would be a
 *    guess drawn as a fact.
 *
 * `repeat: null` is a SINGLE-row group: no add, no remove, no row numbers —
 * a plain fieldset. Repeatable, the remove button DISAPPEARS at `repeat.min`
 * (there is nothing to explain: one row is visibly the last one) while the
 * add button STAYS at `repeat.max` with the reason beside it — "five is the
 * most this catalogue allows" is a fact only the config knows, and a button
 * that vanishes at the cap looks like a bug.
 */
const GroupEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const touch = useTouchFloor();
  const children = useMemo(() => groupChildren(cfg), [cfg]);
  const [minRows, maxRows] = groupRowBounds(cfg);
  const repeatable = cfg["repeat"] !== null && cfg["repeat"] !== undefined;

  const stored: readonly GroupRow[] = useMemo(
    () =>
      (Array.isArray(props.value) ? props.value : []).filter(
        (row): row is GroupRow => row !== null && typeof row === "object" && !Array.isArray(row)
      ),
    [props.value]
  );
  // A single-row group always draws its one row: with no add button, an empty
  // one would be a labelled box with nothing in it. A repeatable one draws a
  // blank row when an answer is REQUIRED — the fields a person must fill are
  // not something to make them press a button to see — and nothing otherwise.
  const rows: readonly GroupRow[] =
    stored.length > 0 ? stored : !repeatable || props.required === true ? [EMPTY_ROW] : [];

  const emit = useCallback(
    (next: readonly GroupRow[]): void => {
      const kept = next.filter((row) => Object.values(row).some((cell) => !isBlank(cell)));
      props.onChange(kept.length > 0 ? kept : undefined);
    },
    [props]
  );

  const setCell = (index: number, slug: string, value: unknown): void => {
    emit(
      rows.map((row, at) =>
        at === index
          ? Object.fromEntries(
              Object.entries({ ...row, [slug]: value }).filter(([, cell]) => !isBlank(cell))
            )
          : row
      )
    );
  };

  const disabled = props.disabled === true;
  const atMax = maxRows !== undefined && rows.length >= maxRows;
  const canAdd = repeatable && !disabled && !atMax;
  const canRemove = repeatable && !disabled && rows.length > Math.max(minRows, 1);

  const addButton = (bind?: {
    readonly disabled: boolean;
    readonly "aria-describedby": string | undefined;
  }): ReactElement => (
    <Button
      size="small"
      disabled={bind === undefined ? !canAdd : bind.disabled}
      data-analytics="none"
      data-analytics-reason="local form edit — the funnel step is the submit, not a row"
      style={{ minHeight: touch ? PHONE_CONTROL_HEIGHT : undefined }}
      {...(bind?.["aria-describedby"] !== undefined
        ? { "aria-describedby": bind["aria-describedby"] }
        : {})}
      onClick={() => emit([...rows, EMPTY_ROW])}
    >
      {t(ATTRIBUTES_I18N_KEYS.groupAddRow)}
    </Button>
  );

  // `props.id` lands on the CONTAINER, not on a cell.
  //
  // The registry contract says the id goes on "the primary control" so the
  // row's `<label for>` reaches it — but a composite has no primary control,
  // and picking the first cell of the first row would give that one `int` two
  // labels ("Wholesale discount" and "From, units") and make the row's label
  // read as a question about it. `role="group"` is what this box actually is:
  // a set of controls the row's label names as a whole.
  return (
    <Flex
      vertical
      gap={spacing[2]}
      style={{ width: "100%" }}
      id={props.id}
      role="group"
      data-attributes-composite={rows.length}
    >
      {rows.map((row, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key -- the index IS the row's identity: the value is an ordered array and the engine addresses a cell by position (`rows[1].discount`); a row carries no id of its own
          key={index}
          data-attributes-row={index}
          style={{
            border: `1px solid ${GROUP_BORDER}`,
            borderRadius: spacing[1],
            padding: spacing[2],
          }}
        >
          {repeatable && (
            <Flex justify="space-between" align="center" style={{ marginBottom: spacing[1] }}>
              <Typography.Text type="secondary">
                {t(ATTRIBUTES_I18N_KEYS.groupRow, { index: index + 1 })}
              </Typography.Text>
              {canRemove && (
                <Button
                  size="small"
                  type="text"
                  danger
                  data-analytics="none"
                  data-analytics-reason="local form edit — the funnel step is the submit, not a row"
                  style={{ minHeight: touch ? PHONE_CONTROL_HEIGHT : undefined }}
                  onClick={() => emit(rows.filter((_row, at) => at !== index))}
                >
                  {t(ATTRIBUTES_I18N_KEYS.groupRemoveRow)}
                </Button>
              )}
            </Flex>
          )}
          {/* Side by side while there is room; stacked in a narrow column.
              The basis only applies horizontally — in a column, `flex-basis`
              sizes HEIGHT, and a 12rem floor turned every stacked cell into a
              third of a phone screen of empty space. */}
          <Flex vertical={touch} wrap={!touch} gap={spacing[2]}>
            {children.map((child) => {
              const cellId = `${props.id}-${index}-${child.slug}`;
              const type = featureType(child);
              const Editor =
                (type === undefined ? null : resolveValueEditor(type)) ??
                (type === undefined ? undefined : BUILTIN_VALUE_EDITORS[type]);
              return (
                <div
                  key={child.slug}
                  style={{ flex: touch ? "0 0 auto" : "1 1 12rem", minWidth: 0 }}
                >
                  <label htmlFor={cellId} style={{ display: "block", marginBottom: spacing[1] }}>
                    <Typography.Text strong>{t(featureName(child))}</Typography.Text>
                    {child.mandatory === true && (
                      <Typography.Text type="danger" aria-hidden="true">
                        {" *"}
                      </Typography.Text>
                    )}
                  </label>
                  {Editor === undefined || Editor === null ? (
                    <UnsupportedValueEditor feature={child} />
                  ) : (
                    <Editor
                      id={cellId}
                      feature={child}
                      value={row[child.slug]}
                      siblings={row}
                      onChange={(value) => setCell(index, child.slug, value)}
                      disabled={disabled}
                      required={child.mandatory === true}
                    />
                  )}
                </div>
              );
            })}
          </Flex>
        </div>
      ))}
      {repeatable && (
        <div data-attributes-group-add="">
          {atMax && !disabled ? (
            <GatedControl
              gate={actionBlocked(ATTRIBUTES_I18N_KEYS.groupAtMaxRows, { count: maxRows })}
              testId="attributes-group-at-max"
            >
              {(bind) => addButton(bind)}
            </GatedControl>
          ) : (
            addButton()
          )}
        </div>
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
  ref_select: skinned("RefSelect", RefSelectEditor),
  ref_hierarchical_select: skinned("RefHierarchicalSelect", RefHierarchicalSelectEditor),
  group: skinned("Group", GroupEditor),
};

/** The types this skin can draw — handed to `unsupportedTypes` so the
 * headless half can judge renderability without importing the skin. */
export const BUILTIN_VALUE_EDITOR_TYPES: readonly string[] =
  Object.keys(BUILTIN_VALUE_EDITORS).sort();
