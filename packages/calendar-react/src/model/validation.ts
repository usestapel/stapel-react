/**
 * The two refusals this backend documents, checked before the request leaves.
 *
 * `MODULE.md` states both in so many words:
 *
 *  - `end < start` is rejected with 400 (`error.400.calendar_invalid_range`);
 *    `end == start` is a valid zero-duration MARKER and must NOT be blocked.
 *  - `slot_minutes` must be a positive integer, else
 *    `error.400.calendar_invalid_slot_minutes` — and the backend's own comment
 *    says why it refuses rather than clamps: a step `<= 0` makes the slot loop
 *    run forever.
 *
 * ── Why this is a GATE and not a thrown error ─────────────────────────────
 *
 * Both come back as {@link ActionAvailability}, so the submit control is
 * switched off WITH the sentence beside it (`GatedButton`), instead of the
 * person pressing a lit button and reading a server refusal afterwards. The
 * codes are the pair's own i18n keys, so the reason is translated by the same
 * mechanism as everything else.
 *
 * The server still decides. This is not a second implementation of the rule —
 * it is the same rule said early, and every refusal the backend can raise for
 * reasons a client cannot see still arrives as an error the skin renders.
 */
import { actionAvailable, actionBlocked } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";

/** The backend's own default slot length (`DEFAULT_SLOT_MINUTES`), so an
 * unconfigured picker asks for the grid the server would have chosen. */
export const DEFAULT_SLOT_MINUTES = 30;

/**
 * Is this interval submittable? `end == start` passes (a marker); `end < start`
 * does not. An unparseable or empty bound blocks with the same sentence — a
 * half-typed date is not a range either.
 */
export function checkInterval(start: string, end: string): ActionAvailability {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return actionBlocked(CALENDAR_I18N_KEYS.validationRangeIncomplete);
  }
  return to < from
    ? actionBlocked(CALENDAR_I18N_KEYS.validationEndBeforeStart)
    : actionAvailable();
}

/** Is this slot granularity submittable? Positive integers only. */
export function checkSlotMinutes(minutes: number): ActionAvailability {
  return Number.isInteger(minutes) && minutes >= 1
    ? actionAvailable()
    : actionBlocked(CALENDAR_I18N_KEYS.validationSlotMinutes);
}

/** A title is required by `EventCreateRequest`; blank is a 400 nobody needs
 * to make a round trip for. */
export function checkTitle(title: string): ActionAvailability {
  return title.trim().length > 0
    ? actionAvailable()
    : actionBlocked(CALENDAR_I18N_KEYS.validationTitleRequired);
}
