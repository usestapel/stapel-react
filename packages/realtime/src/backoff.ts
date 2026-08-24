/**
 * Reconnect timing: exponential, capped, **full jitter**.
 *
 * The jitter is not decoration. A fleet of tabs that all dropped on one server
 * blip and all wait the same 4 s arrive as one wave and knock the server over
 * a second time. Full jitter (a uniform draw over the whole window, not a
 * ±10 % wobble) spreads them.
 *
 * The counter resets on `welcome`, not on the socket's `open` event: a
 * handshake that succeeds and is then refused mid-protocol has not proven
 * anything, and resetting there is how a reconnect loop becomes a hot loop.
 *
 * There is deliberately **no attempt limit**. A client that gives up after six
 * tries and lets its pair fall back to polling looks identical to a working
 * one, which is precisely the defect this substrate exists to end — so
 * `reconnecting` is a first-class state a skin must SHOW, not a budget that
 * quietly runs out.
 */

export interface BackoffOptions {
  /** First delay, doubled per consecutive failure. Default 1000 ms. */
  readonly baseDelayMs?: number;
  /** Ceiling for the exponential. Default 30000 ms. */
  readonly maxDelayMs?: number;
}

export const DEFAULT_BASE_DELAY_MS = 1_000;
export const DEFAULT_MAX_DELAY_MS = 30_000;

/**
 * Delay before retry number `attempt` (1-based). `random` is injectable so a
 * test can pin the draw.
 */
export function backoffDelay(
  attempt: number,
  options?: BackoffOptions,
  random: () => number = Math.random
): number {
  const base = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const max = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const exponential = base * 2 ** Math.max(0, attempt - 1);
  const capped = Math.min(exponential, max);
  // Full jitter: uniform over [0, capped]. A floor of one tick keeps a
  // zero draw from becoming a synchronous reconnect storm.
  return Math.max(1, Math.round(capped * random()));
}

/** Cancel handle for a scheduled callback. */
export type Cancel = () => void;

/** Injectable timer (tests drive it by hand). Returns its own cancel. */
export type Schedule = (fn: () => void, ms: number) => Cancel;

export function defaultSchedule(fn: () => void, ms: number): Cancel {
  const handle = setTimeout(fn, ms);
  return () => {
    clearTimeout(handle);
  };
}
