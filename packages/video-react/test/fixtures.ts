/**
 * Real-shaped bodies — the field names, the snake_case and the ISO instants
 * `GET /video/api/v1/scopes/{scope_key}/usage/` actually answers with
 * (stapel-video 0.7.0 `docs/schema.json`: `ScopeUsageResponse` /
 * `ScopeUsageMonth` / `ScopeUsageRow`).
 *
 * The boundaries are the server's and they are cut at LOCAL midnight in the
 * requested zone: `2026-08` in `Europe/Berlin` starts at `2026-07-31T22:00:00Z`
 * (CEST, UTC+2), not at midnight UTC. Nothing in this pair re-derives that,
 * and the fixture is written the way the server writes it so a test cannot
 * quietly accept code that did.
 */

/** One month with three people, longest presence first (as the view sorts). */
export const AUGUST = {
  month: "2026-08",
  period_start: "2026-07-31T22:00:00Z",
  period_end: "2026-08-31T22:00:00Z",
  users: [
    {
      user_id: "u-9a1f",
      presence_seconds: 7385, // 2:03
      rooms: 4,
      connections: 6,
      first_seen: "2026-08-03T09:12:04Z",
      last_seen: "2026-08-21T16:40:11Z",
    },
    {
      user_id: "u-4c02",
      presence_seconds: 3600, // 1:00
      rooms: 2,
      connections: 2,
      first_seen: "2026-08-05T11:00:00Z",
      last_seen: "2026-08-19T12:30:00Z",
    },
    {
      user_id: "u-b7de",
      presence_seconds: 59, // 0:00 — under a minute is still presence
      rooms: 1,
      connections: 1,
      first_seen: "2026-08-11T08:59:31Z",
      last_seen: "2026-08-11T09:00:30Z",
    },
  ],
} as const;

/** A month nobody was in a call. The view returns it — `users` is `[]`, and
 * the month is present, because "the window included July" is a fact. */
export const JULY_EMPTY = {
  month: "2026-07",
  period_start: "2026-06-30T22:00:00Z",
  period_end: "2026-07-31T22:00:00Z",
  users: [],
} as const;

/**
 * A month the serializer emitted with NO `users` key at all — legal, because
 * `users` is not in `ScopeUsageMonth.required`. Same meaning as `[]`, and
 * `normalizeScopeUsage` is the one place allowed to say so.
 */
export const JUNE_NO_USERS_KEY = {
  month: "2026-06",
  period_start: "2026-05-31T22:00:00Z",
  period_end: "2026-06-30T22:00:00Z",
} as const;

export const TZ = "Europe/Berlin";

/** The window answer: three months, newest first. */
export const WINDOW_BODY = {
  scope_key: "acme-7f0c",
  tz: TZ,
  months: [AUGUST, JULY_EMPTY, JUNE_NO_USERS_KEY],
} as const;

/** A single-month answer — a one-element `months` list, per the contract. */
export const JULY_ONLY_BODY = {
  scope_key: "acme-7f0c",
  tz: TZ,
  months: [JULY_EMPTY],
} as const;

/** A single-month answer for August. */
export const AUGUST_ONLY_BODY = {
  scope_key: "acme-7f0c",
  tz: TZ,
  months: [AUGUST],
} as const;

/**
 * An answer with no `months` key at all — legal for the same reason
 * `JUNE_NO_USERS_KEY` is: `months` is not in `ScopeUsageResponse.required`.
 */
export const NO_MONTHS_BODY = {
  scope_key: "acme-7f0c",
  tz: TZ,
} as const;
