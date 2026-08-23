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
