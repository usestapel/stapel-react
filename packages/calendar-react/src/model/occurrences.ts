/**
 * The dedup the wire contract demands, in one function.
 *
 * ── The rule, verbatim from the module that emits the body ────────────────
 *
 * `stapel-calendar/MODULE.md` ("API contract notes"):
 *
 * > `CalendarView` returns a materialized occurrence **twice by design**: as a
 * > concrete row in `events[]` (it *is* an Event) and as an entry in
 * > `occurrences[]` (`is_materialized=true`). Clients must dedup by
 * > `occurrences[].materialized_id == events[].id`. Cancelled (tombstoned)
 * > occurrences appear only in `events[]` with `status=cancelled`, never in
 * > `occurrences[]`.
 *
 * The backend's own view confirms the shape: `events[]` is filtered to
 * `rrule=""`, so a series MASTER never appears there — only standalone events,
 * materialized occurrences (which carry an empty rrule and a
 * `recurrence_parent_id`), and tombstones. Everything recurring reaches a
 * client through `occurrences[]`.
 *
 * ── Why this is not the caller's problem ──────────────────────────────────
 *
 * Handing both arrays through raw is what this pair used to do, and every
 * consumer of that bag drew a materialized occurrence of a series twice — a
 * meeting that was moved, or that somebody RSVP'd to, appears on the grid as
 * two meetings at the same instant. A rule stated in prose in the backend's
 * MODULE.md and implemented in nobody's code is not a contract; it is a trap
 * with documentation. So the pair keeps ONE list of drawable instants and the
 * raw arrays beside it, and the deduplication cannot be forgotten by the next
 * screen because there is no screen-side step to forget.
 *
 * ── Cancelled is an ARM, not a filter ─────────────────────────────────────
 *
 * A tombstone is a fact a calendar has to show: "the 14:00 stand-up on
 * Thursday is cancelled" is different information from an empty slot, and
 * dropping it silently is the same defect class as an empty state that is
 * really a failure. So cancelled rows come back as their own list AND as
 * instances whose `status` is `"cancelled"`, for a skin to strike through
 * rather than omit.
 */
import type { CalendarEvent, EventStatus, Occurrence } from "../api/types.js";

/**
 * One drawable instant on a calendar: a standalone event, a virtual instance
 * of a series, or the concrete row a materialized instance resolved to —
 * never the same instant twice.
 */
export interface CalendarInstance {
  /** Stable React key: the concrete row id, else `<seriesId>@<start>`. */
  readonly key: string;
  /**
   * The id a detail read / edit / RSVP call must use. For a virtual instant
   * this is the SERIES MASTER's id — the backend has no row for the instant
   * itself until something writes to it.
   */
  readonly eventId: string;
  /** The series this instant belongs to, or `null` for a standalone event. */
  readonly seriesId: string | null;
  readonly title: string;
  /** Instant start (tz-aware ISO 8601, verbatim from the wire). */
  readonly start: string;
  /** Instant end (tz-aware ISO 8601, verbatim from the wire). */
  readonly end: string;
  readonly status: EventStatus;
  /**
   * `true` when no concrete row exists at this instant yet (the backend
   * materializes on first write). A skin draws it differently: there is
   * nothing to open a detail view of but the series, and per-instant actions
   * will create the row.
   */
  readonly isVirtual: boolean;
  /** The concrete row, when one exists. `null` for a virtual instant. */
  readonly event: CalendarEvent | null;
}

/**
 * Concrete rows as drawable instants, ascending. For the flat `GET /events`
 * list, which does no series expansion and therefore needs no dedup — the
 * agenda renders the same shape whichever read it came from.
 */
export function instancesFromEvents(
  events: readonly CalendarEvent[]
): readonly CalendarInstance[] {
  return [...events]
    .map(instanceFromEvent)
    .sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
}

/** A `GET /calendar` body, deduped. */
export interface DedupedRange {
  /**
   * Concrete rows a skin may draw as events in their own right: tombstones
   * removed, and every row that is the `materialized_id` of an occurrence
   * removed (it is drawn from `occurrences[]` instead).
   */
  readonly events: readonly CalendarEvent[];
  /** The expanded series instances, verbatim from the wire. */
  readonly occurrences: readonly Occurrence[];
  /** Tombstoned rows (`status === "cancelled"`) — their own arm, never dropped. */
  readonly cancelled: readonly CalendarEvent[];
  /** Everything drawable, once each, ascending by start then key. */
  readonly instances: readonly CalendarInstance[];
}

/** The wire types `status` as a bare string; narrow it to the values the
 * backend sets, defaulting an unknown one to `confirmed` rather than
 * inventing a fourth state a skin has no arm for. */
function asStatus(raw: string): EventStatus {
  return raw === "cancelled" || raw === "tentative" ? raw : "confirmed";
}

function instanceFromEvent(event: CalendarEvent): CalendarInstance {
  return {
    key: event.id,
    eventId: event.id,
    seriesId: event.recurrence_parent_id ?? null,
    title: event.title,
    start: event.start,
    end: event.end,
    status: asStatus(event.status),
    isVirtual: false,
    event,
  };
}

/**
 * Dedup a `GET /calendar` body per the module's stated rule.
 *
 * Both arguments are optional on the wire; inside a read that SUCCEEDED an
 * absent key honestly means "nothing of that kind in this range", so they are
 * normalized to empty rather than treated as a failure.
 */
export function dedupeCalendarRange(
  events: readonly CalendarEvent[],
  occurrences: readonly Occurrence[]
): DedupedRange {
  const byId = new Map<string, CalendarEvent>();
  for (const event of events) byId.set(event.id, event);

  const materializedIds = new Set<string>();
  for (const occurrence of occurrences) {
    const id = occurrence.materialized_id;
    if (typeof id === "string" && id.length > 0) materializedIds.add(id);
  }

  // What a series is CALLED. A virtual instant carries no title of its own —
  // the backend expands times, not rows — and the series master never reaches
  // `events[]` (the view filters it out by `rrule=""`), so the only title in
  // the body is on the series' materialized siblings. Without this every
  // expanded instant drew as "Untitled event" beside its own concrete twin.
  const seriesTitles = new Map<string, string>();
  for (const event of events) {
    const parent = event.recurrence_parent_id;
    if (
      typeof parent === "string" &&
      parent.length > 0 &&
      event.title.length > 0 &&
      !seriesTitles.has(parent)
    ) {
      seriesTitles.set(parent, event.title);
    }
  }

  const cancelled: CalendarEvent[] = [];
  const standalone: CalendarEvent[] = [];
  for (const event of events) {
    if (asStatus(event.status) === "cancelled") {
      cancelled.push(event);
      continue;
    }
    // THE DEDUP: this row is the concrete half of an entry in `occurrences[]`.
    // It is drawn from there, with its series identity intact.
    if (materializedIds.has(event.id)) continue;
    standalone.push(event);
  }

  const instances: CalendarInstance[] = standalone.map(instanceFromEvent);

  for (const occurrence of occurrences) {
    const id = occurrence.materialized_id;
    const row = typeof id === "string" ? byId.get(id) : undefined;
    // Defensive: the module states a tombstone never reaches `occurrences[]`.
    // If one ever did, it belongs in the cancelled arm, not on the grid twice.
    if (row !== undefined && asStatus(row.status) === "cancelled") continue;
    instances.push({
      key: row?.id ?? `${occurrence.event_id}@${occurrence.start}`,
      eventId: row?.id ?? occurrence.event_id,
      seriesId: occurrence.event_id,
      title:
        row?.title ??
        byId.get(occurrence.event_id)?.title ??
        seriesTitles.get(occurrence.event_id) ??
        "",
      start: occurrence.start,
      end: occurrence.end,
      status: row !== undefined ? asStatus(row.status) : "confirmed",
      isVirtual: !occurrence.is_materialized,
      event: row ?? null,
    });
  }

  // Cancelled instants stay on the list so a skin can strike them through.
  for (const event of cancelled) instances.push(instanceFromEvent(event));

  instances.sort(
    (a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key)
  );

  return {
    events: standalone,
    occurrences,
    cancelled,
    instances,
  };
}
