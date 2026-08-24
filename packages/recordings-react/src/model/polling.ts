/**
 * When to ask again — read off the payload, never guessed.
 *
 * stapel-recordings serves no socket (no consumer, no routing module), so a
 * client learns that a recording moved by reading it again. Before backend
 * 0.20.0 there was no number to poll at, and this pair shipped two hooks whose
 * docstrings PROMISED polling and whose code set no interval: a recording sat
 * on `transcribing` forever unless the host wired its own timer.
 *
 * 0.20.0 put the number in the payload. `poll_after_seconds` is present exactly
 * while the pipeline owns the next transition, and `null` when it does not —
 * terminal (`completed`/`error`/`deleted`) or waiting on the client's own
 * upload (`created`/`uploading`). **That absence is the instruction to stop**,
 * and it is the whole reason this is a function of the data rather than a
 * constant: a client polling a failed recording forever is the defect the shape
 * exists to prevent.
 *
 * The same number rides as a `Retry-After` header, and `GET …/transcript`
 * carries it too (a client watching a transcript fill in polls the transcript,
 * not the recording).
 */

/** The narrow shape both the recording payload and the transcript page satisfy. */
export interface PollHint {
  readonly poll_after_seconds?: number | null;
}

/**
 * Milliseconds until the next read, or `false` when the payload says stop.
 * `false` — not `0`, not `undefined` — because that is what TanStack Query's
 * `refetchInterval` reads as "do not schedule another one".
 *
 * A non-positive or non-finite hint is treated as "stop": a zero interval would
 * spin the query loop as fast as the network allows, which is worse than not
 * polling at all.
 */
export function pollIntervalMs(hint: PollHint | undefined): number | false {
  const seconds = hint?.poll_after_seconds;
  if (seconds === undefined || seconds === null) return false;
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  return seconds * 1000;
}

/**
 * Milliseconds after which a minted media URL should be re-minted, from
 * `MediaURLDTO.expires_in`.
 *
 * Refreshed at 80 % of the lifetime, never at 100 %: the URL is handed to a
 * media element that may be mid-buffer when it dies, and a player that
 * re-mints only after playback has already broken has not solved anything. A
 * lifetime too short to leave any margin (under two seconds) is not polled —
 * re-minting in a tight loop is not a working player either.
 */
export function mediaRefreshMs(expiresInSeconds: number | undefined): number | false {
  if (expiresInSeconds === undefined) return false;
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 2) return false;
  return Math.floor(expiresInSeconds * 1000 * 0.8);
}
