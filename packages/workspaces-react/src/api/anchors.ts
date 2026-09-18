/**
 * One place that turns a page envelope's anchor into the `?anchor=` value.
 *
 * The core anchor envelope declares `next_anchor`/`prev_anchor` as the RAW
 * value of whatever field the paginator orders by — `string | number`, because
 * the same paginator serves lists ordered by a datetime and by a sequence —
 * while the query parameter every one of these routes documents is a string.
 * Stringifying at the one boundary that carries the value back is the honest
 * bridge. Five call sites walk by anchor here — members, invitations and the
 * audit trail — and each one used to state the datetime spelling for itself,
 * so a list that switched to a sequence anchor would have had to be found and
 * fixed five times.
 */
export function pageAnchor(
  anchor: string | number | null | undefined
): string | undefined {
  return anchor === null || anchor === undefined ? undefined : String(anchor);
}
