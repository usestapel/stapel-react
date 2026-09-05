/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "keys are
 * namespaced"). Everything under the `"video"` root so a host can invalidate
 * the whole module, one scope, or one period. Persist scope is per-user via
 * core's query runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`.
 *
 * ── The time zone is part of the key, and that is not decoration ───────────
 *
 * `?tz=` decides where the month boundaries are CUT — LOCAL midnight in the
 * requested zone — so the same scope and the same `2026-08` are genuinely
 * different numbers in `UTC` and in `Europe/Berlin`, and a DST month is 743 or
 * 745 hours rather than 744. A key that omitted `tz` would serve one zone's
 * arithmetic under another zone's label the moment a host offered the choice.
 *
 * ── Why a window and a month are two entries, not one ──────────────────────
 *
 * `?months=6` and `?month=2026-08` are different requests answering different
 * bodies, and the screen wants BOTH: the window supplies the month selector's
 * options and stays cached while a person clicks through months, while each
 * month is fetched under its own key. Folding them together would either
 * re-fetch the whole window on every click or serve one month's rows as if
 * they were the window.
 */
const ROOT = "video" as const;
const USAGE = "usage" as const;
const ROOM = "room" as const;
const PARTICIPANTS = "participants" as const;
const CALL = "call" as const;

export const videoQueryKeys: {
  readonly all: readonly ["video"];
} = {
  all: [ROOT],
};

export const usageQueryKeys: {
  /** Every usage read, for every scope. */
  readonly all: readonly ["video", "usage"];
  /** Everything cached about one partition, in every zone and period. */
  scope(scopeKey: string): readonly ["video", "usage", string];
  /** The last `months` calendar months of one scope, cut in `tz`. */
  window(
    scopeKey: string,
    months: number,
    tz: string
  ): readonly ["video", "usage", string, string, "window", number];
  /** One `YYYY-MM` of one scope, cut in `tz`. */
  month(
    scopeKey: string,
    month: string,
    tz: string
  ): readonly ["video", "usage", string, string, "month", string];
} = {
  all: [ROOT, USAGE],
  scope: (scopeKey) => [ROOT, USAGE, scopeKey],
  window: (scopeKey, months, tz) => [ROOT, USAGE, scopeKey, tz, "window", months],
  month: (scopeKey, month, tz) => [ROOT, USAGE, scopeKey, tz, "month", month],
};

/**
 * The meeting half. A room is addressed by its JOIN CODE and by nothing else —
 * there is no room list on the wire, so there is no list key either: a factory
 * entry for a collection this contract cannot answer would be a promise the
 * cache could never keep.
 *
 * The participant page is keyed by its anchor, because an anchored page is a
 * different answer from the page before it and the two must not overwrite each
 * other in the cache.
 */
export const roomQueryKeys: {
  /** Everything cached about every room. */
  readonly all: readonly ["video", "room"];
  /** One room, by join code. */
  room(joinCode: string): readonly ["video", "room", string];
  /** Every participant page of one room — the invalidation target after a
   * lobby verdict. */
  participants(
    joinCode: string
  ): readonly ["video", "room", string, "participants"];
  /** One anchored page of one room's participants. */
  participantPage(
    joinCode: string,
    anchor: string
  ): readonly ["video", "room", string, "participants", string];
} = {
  all: [ROOT, ROOM],
  room: (joinCode) => [ROOT, ROOM, joinCode],
  participants: (joinCode) => [ROOT, ROOM, joinCode, PARTICIPANTS],
  participantPage: (joinCode, anchor) => [
    ROOT,
    ROOM,
    joinCode,
    PARTICIPANTS,
    anchor,
  ],
};

/**
 * The call half. TWO entries, and the interesting one is `active`.
 *
 * `active` is keyed on nothing but its own name — no user id — because it is
 * a read ABOUT THE CALLER, answered from the session the client already holds.
 * Putting a user id in it would invite a screen to ask about somebody else,
 * which the endpoint does not answer, and would leave a stale entry behind on
 * every sign-out that the cache would happily serve to the next person.
 * Signing out clears the query cache; the key does not need to encode that.
 */
export const callQueryKeys: {
  /** Everything cached about calls. */
  readonly all: readonly ["video", "call"];
  /** The caller's own live call, or its absence. */
  readonly active: readonly ["video", "call", "active"];
  /** One call by id, for a screen that holds one. */
  call(callId: string): readonly ["video", "call", string];
} = {
  all: [ROOT, CALL],
  active: [ROOT, CALL, "active"],
  call: (callId) => [ROOT, CALL, callId],
};
