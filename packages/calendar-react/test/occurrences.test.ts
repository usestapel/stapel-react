import { describe, expect, it } from "vitest";
import { dedupeCalendarRange, instancesFromEvents } from "../src/index.js";
import type { CalendarEvent, Occurrence } from "../src/index.js";
import type { components } from "../src/api/generated/schema.js";

/**
 * The wire rule this pair is required to implement, tested against the
 * GENERATED schema types (not hand-written shapes): a materialized occurrence
 * arrives twice — once in `events[]`, once in `occurrences[]` — and a client
 * that does not dedup draws a repeating meeting twice at the same instant.
 * `stapel-calendar/MODULE.md`: "Clients must dedup by
 * `occurrences[].materialized_id == events[].id`. Cancelled (tombstoned)
 * occurrences appear only in `events[]` with `status=cancelled`, never in
 * `occurrences[]`."
 */
type WireEvent = components["schemas"]["EventResponse"];
type WireOccurrence = components["schemas"]["OccurrenceResponse"];

function event(over: Partial<WireEvent> & { id: string; start: string }): CalendarEvent {
  return {
    title: "Stand-up",
    description: "",
    end: over.start,
    owner_id: "u-owner",
    scope_key: "",
    status: "confirmed",
    recurrence_type: "none",
    rrule: "",
    ...over,
  };
}

function occurrence(over: Partial<WireOccurrence> & { event_id: string; start: string }): Occurrence {
  return {
    end: over.start,
    is_materialized: false,
    ...over,
  };
}

describe("dedupeCalendarRange (the module's stated wire rule)", () => {
  it("draws a materialized occurrence ONCE, not twice", () => {
    const materialized = event({ id: "e-1", start: "2026-07-13T10:00:00Z" });
    const range = dedupeCalendarRange(
      [materialized],
      [
        occurrence({
          event_id: "series-1",
          start: "2026-07-13T10:00:00Z",
          is_materialized: true,
          materialized_id: "e-1",
        }),
      ]
    );
    expect(range.instances).toHaveLength(1);
    // …and the one instance keeps BOTH identities: the concrete row it can be
    // edited through, and the series it belongs to.
    expect(range.instances[0]?.eventId).toBe("e-1");
    expect(range.instances[0]?.seriesId).toBe("series-1");
    expect(range.instances[0]?.isVirtual).toBe(false);
    // The raw row is no longer offered as a standalone event.
    expect(range.events).toHaveLength(0);
  });

  it("keeps a standalone event that no occurrence claims", () => {
    const range = dedupeCalendarRange(
      [event({ id: "e-2", start: "2026-07-14T09:00:00Z", title: "One-off" })],
      []
    );
    expect(range.events.map((e) => e.id)).toEqual(["e-2"]);
    expect(range.instances.map((i) => i.eventId)).toEqual(["e-2"]);
    expect(range.instances[0]?.seriesId).toBeNull();
  });

  it("exposes cancelled rows as their own arm and never as a plain event", () => {
    const range = dedupeCalendarRange(
      [
        event({ id: "e-3", start: "2026-07-15T10:00:00Z", status: "cancelled" }),
        event({ id: "e-4", start: "2026-07-15T12:00:00Z" }),
      ],
      []
    );
    expect(range.cancelled.map((e) => e.id)).toEqual(["e-3"]);
    expect(range.events.map((e) => e.id)).toEqual(["e-4"]);
    // Still drawable — a cancelled meeting is information, not an empty slot.
    const cancelled = range.instances.find((i) => i.eventId === "e-3");
    expect(cancelled?.status).toBe("cancelled");
  });

  it("marks a virtual instant as virtual and points it at the series", () => {
    const range = dedupeCalendarRange(
      [],
      [occurrence({ event_id: "series-9", start: "2026-07-20T08:00:00Z" })]
    );
    expect(range.instances[0]?.isVirtual).toBe(true);
    expect(range.instances[0]?.eventId).toBe("series-9");
    expect(range.instances[0]?.event).toBeNull();
  });

  it("drops an occurrence whose concrete row is a tombstone (defence in depth)", () => {
    const range = dedupeCalendarRange(
      [event({ id: "e-5", start: "2026-07-21T10:00:00Z", status: "cancelled" })],
      [
        occurrence({
          event_id: "series-5",
          start: "2026-07-21T10:00:00Z",
          is_materialized: true,
          materialized_id: "e-5",
        }),
      ]
    );
    // Once, in the cancelled arm — never once struck through and once live.
    expect(range.instances).toHaveLength(1);
    expect(range.instances[0]?.status).toBe("cancelled");
  });

  it("sorts everything it draws by start", () => {
    const range = dedupeCalendarRange(
      [
        event({ id: "late", start: "2026-07-22T18:00:00Z" }),
        event({ id: "early", start: "2026-07-22T08:00:00Z" }),
      ],
      []
    );
    expect(range.instances.map((i) => i.eventId)).toEqual(["early", "late"]);
  });
});

describe("instancesFromEvents (the flat GET /events list)", () => {
  it("needs no dedup and keeps every row, ascending", () => {
    const instances = instancesFromEvents([
      event({ id: "b", start: "2026-07-23T10:00:00Z" }),
      event({ id: "a", start: "2026-07-23T09:00:00Z" }),
    ]);
    expect(instances.map((i) => i.eventId)).toEqual(["a", "b"]);
  });
});
