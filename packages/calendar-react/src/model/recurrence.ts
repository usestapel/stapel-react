/**
 * The recurrence presets, as a registry rather than a hardcoded switch.
 *
 * ── The backend's presets are an OPEN registry ────────────────────────────
 *
 * `stapel-calendar`'s `STAPEL_CALENDAR["PRESETS"]` merges over
 * `recurrence.BUILTIN_PRESETS`, and `register_preset()` adds more; setting a
 * name to `None` removes a built-in. A host that added `"quarterly"` has an
 * `EventCreateRequest.recurrence_type` this pair has never heard of, and a
 * host that removed `"biweekly"` has one this pair would offer and the server
 * would refuse.
 *
 * A frontend cannot read a Django setting, so it cannot MIRROR that registry —
 * what it can do is stop pretending the list is closed. {@link CALENDAR_RECURRENCE_PRESETS}
 * is the shipped default (the seven built-ins), and every surface that draws
 * the choice takes a `presets` prop that replaces it. That is the frontend
 * half of a merge registry: one place to override, no fork, and a host with a
 * custom preset writes a line of configuration instead of a component.
 *
 * ── `until` XOR `count` ───────────────────────────────────────────────────
 *
 * RRULE allows UNTIL or COUNT, never both, and a control that offers a
 * meaningless combination is a §83 defect. {@link RECURRENCE_ENDS} names the
 * three answers a person can actually give — never, on a date, after N times —
 * and {@link recurrenceEndPatch} turns the chosen one into the request fields,
 * explicitly nulling the other so an edit that switches from "after 10" to
 * "until March" does not leave a COUNT behind.
 */
import type { EventCreateRequest, RecurrenceType } from "../api/types.js";

/** One offerable recurrence rule: the wire value plus the key for its label. */
export interface RecurrencePreset {
  /** The `recurrence_type` value sent to the backend. */
  readonly value: string;
  /** i18n key for the human label. */
  readonly labelKey: string;
  /** `true` for the preset that reveals the weekday chips + interval field. */
  readonly custom?: boolean;
}

/** The i18n key namespace preset labels live under. A host adding a preset
 * registers `calendar.recurrence.preset.<value>` in its own bundle. */
export const RECURRENCE_LABEL_PREFIX = "calendar.recurrence.preset.";

/** The label key for a preset value — the one derivation, so a host preset
 * gets a key by the same rule the built-ins do. */
export function recurrenceLabelKey(value: string): string {
  return `${RECURRENCE_LABEL_PREFIX}${value}`;
}

const BUILTIN: readonly RecurrenceType[] = [
  "none",
  "daily",
  "weekdays",
  "weekly",
  "biweekly",
  "monthly",
  "custom",
];

/**
 * The seven presets stapel-calendar ships out of the box. Pass a different
 * array to a recurrence control to match a deployment that registered or
 * removed one.
 */
export const CALENDAR_RECURRENCE_PRESETS: readonly RecurrencePreset[] =
  BUILTIN.map((value) => ({
    value,
    labelKey: recurrenceLabelKey(value),
    ...(value === "custom" ? { custom: true } : {}),
  }));

/** How a series stops. RRULE takes UNTIL or COUNT — never both. */
export type RecurrenceEnd = "never" | "until" | "count";

/** The three answers, in the order a person considers them. */
export const RECURRENCE_ENDS: readonly RecurrenceEnd[] = [
  "never",
  "until",
  "count",
];

/** The recurrence half of a create/update body. */
export type RecurrencePatch = Pick<
  EventCreateRequest,
  | "recurrence_type"
  | "recurrence_interval"
  | "recurrence_weekdays"
  | "recurrence_until"
  | "recurrence_count"
>;

/** What a recurrence control holds while it is being edited. */
export interface RecurrenceValue {
  readonly type: string;
  /** RRULE INTERVAL (>= 1); only meaningful for `custom`. */
  readonly interval: number;
  /** Weekday ints, `0=Mon..6=Sun`; only meaningful for `custom`. */
  readonly weekdays: readonly number[];
  readonly end: RecurrenceEnd;
  /** Wire instant, when `end === "until"`. */
  readonly until: string;
  /** Occurrence count, when `end === "count"`. */
  readonly count: number;
}

/** A non-recurring event — what the editor opens on. */
export const NO_RECURRENCE: RecurrenceValue = {
  type: "none",
  interval: 1,
  weekdays: [],
  end: "never",
  until: "",
  count: 10,
};

/** Does this preset value recur at all? `none` is the absence of a rule. */
export function isRecurring(value: RecurrenceValue): boolean {
  return value.type !== "none";
}

/**
 * The recurrence fields of a request body.
 *
 * Both ends are always present and one of them is always `null`: editing any
 * recurrence field of a series master re-specifies the WHOLE rule (the backend
 * stores only the canonical RRULE and cannot merge constituent inputs), so a
 * patch that omitted `recurrence_count` would leave the old COUNT in place
 * while the person believes they set an end date.
 */
export function recurrenceEndPatch(value: RecurrenceValue): RecurrencePatch {
  if (!isRecurring(value)) {
    return {
      recurrence_type: value.type,
      recurrence_interval: null,
      recurrence_weekdays: [],
      recurrence_until: null,
      recurrence_count: null,
    };
  }
  return {
    recurrence_type: value.type,
    recurrence_interval: value.interval,
    recurrence_weekdays: value.type === "custom" ? [...value.weekdays] : [],
    recurrence_until: value.end === "until" && value.until !== "" ? value.until : null,
    recurrence_count: value.end === "count" ? value.count : null,
  };
}
