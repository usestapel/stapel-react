/**
 * The pair's own value formatters — the two facts core cannot know about.
 *
 * Dates are NOT here: `@stapel/core`'s `useFormat()` (i18n/format.ts) owns
 * `date`/`dateTime`/`relative` for the whole fleet, bound to the live engine
 * locale, so this pair renders instants through it rather than through a
 * seventeenth private copy of `Intl.DateTimeFormat`.
 */

/**
 * Is this due date in the past?
 *
 * `now` is a parameter, not `Date.now()` read inside: a card's overdue styling
 * is rendered output, and a test that could not fix the clock would either be
 * flaky or would have to mock a global.
 */
export function isOverdue(due: string | null | undefined, now: number): boolean {
  if (due === null || due === undefined || due === "") return false;
  const at = Date.parse(due);
  return Number.isFinite(at) && at < now;
}

/**
 * A UUID shortened to its first segment.
 *
 * Every actor in this module is an opaque user id and no endpoint resolves one
 * to a name (`MODULE.md`), so a board that printed 36 hex characters on an
 * avatar would be unreadable and one that printed nothing would hide who is
 * carrying the card. `createTasksRuntime({ userLabel })` is the seam a host
 * fills with a real name from whatever pair owns identities; this is what the
 * screen shows until it does.
 */
export function shortId(id: string): string {
  const head = id.split("-")[0];
  return head !== undefined && head.length > 0 ? head : id;
}

/** Initials for an avatar, derived from the same opaque id. Deterministic, so
 * the same person keeps the same two characters across renders. */
export function idInitials(id: string): string {
  return shortId(id).slice(0, 2).toUpperCase();
}
