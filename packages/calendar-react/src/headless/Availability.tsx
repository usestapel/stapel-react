import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { AvailabilityParams, Interval } from "../api/types.js";
import { DEFAULT_SLOT_MINUTES, checkSlotMinutes } from "../model/validation.js";
import { useAvailability } from "../model/queries.js";

/** A `GET /availability` body, with its degraded-mode flag named. */
export interface AvailabilityData {
  /** Coalesced busy intervals in the range. */
  readonly busy: readonly Interval[];
  /** Open booking slots. */
  readonly slots: readonly Interval[];
  /**
   * `true` when a series expansion hit `MAX_EXPANSION_OCCURRENCES` inside the
   * range, so later times in this answer **only LOOK free**.
   */
  readonly truncated: boolean;
  /**
   * `true` when the response offers no bookable slots at all.
   *
   * The contract documents ONE cause for it — "empty if no availability
   * windows set" (`AvailabilityResponse.slots`) — and that is a different
   * answer from "everything is taken". A screen that renders an empty slot
   * list as "nothing free" tells somebody their week is full when in fact
   * nobody ever opened it, so this arm is named and its copy says which
   * situation it is.
   */
  readonly noWindows: boolean;
}

/** Render-prop bag for {@link Availability}. */
export interface AvailabilityBag {
  readonly state: LoadState<AvailabilityData>;
  /** The slot granularity currently asked for. */
  readonly slotMinutes: number;
  /**
   * Is the current slot granularity submittable? A positive integer, per
   * `error.400.calendar_invalid_slot_minutes` — the backend refuses rather
   * than clamping, because a step `<= 0` makes its slot loop run forever.
   */
  readonly slotMinutesValid: ActionAvailability;
  refetch(): void;
}

/**
 * Headless availability — free/busy plus open booking slots over a range
 * (`GET /availability`), with the incompleteness of the answer surfaced.
 *
 * ── `truncated` is the whole reason this bag has a shape ──────────────────
 *
 * `AvailabilityResponse.truncated` means a series expansion hit the safety cap
 * and the tail of the range was never expanded — later times in the answer are
 * unproven, not free. A "pick a time" screen that renders those slots without
 * saying so is the silent-degraded-mode defect exactly: it will cheerfully
 * offer a slot that is already booked. So the flag travels in the bag under a
 * name, and `@stapel/calendar-react/default`'s `<AvailabilityPane/>` renders it
 * as visible copy above the slots rather than as a console warning.
 */
export function Availability(props: {
  start?: string;
  end?: string;
  /** Slot length in minutes (positive integer). */
  slotMinutes?: number;
  children: (bag: AvailabilityBag) => ReactNode;
}): ReactNode {
  const slotMinutes = props.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const slotMinutesValid = checkSlotMinutes(slotMinutes);
  const params: AvailabilityParams = {
    ...(props.start !== undefined ? { start: props.start } : {}),
    ...(props.end !== undefined ? { end: props.end } : {}),
    // A granularity the backend would refuse is not sent: the local gate has
    // already told the person why, and a guaranteed 400 is not a request.
    ...(slotMinutesValid.available ? { slotMinutes } : {}),
  };
  const query = useAvailability(params);
  const state = mapLoad(
    loadStateFromQuery(query),
    (body): AvailabilityData => ({
      busy: body.busy ?? [],
      slots: body.slots ?? [],
      truncated: body.truncated ?? false,
      noWindows: (body.slots ?? []).length === 0,
    })
  );
  return props.children({
    state,
    slotMinutes,
    slotMinutesValid,
    refetch: () => {
      void query.refetch();
    },
  });
}
