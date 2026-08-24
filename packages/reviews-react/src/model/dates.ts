/**
 * When a review was written, in the reader's language.
 *
 * ── Why this lives in the pair and not in a skin ───────────────────────────
 *
 * `created_at` arrives as an ISO timestamp, and the pair's rule has always
 * been that a raw ISO string never reaches a screen — so the list skin took a
 * `renderDate` slot and rendered NOTHING when the host did not fill it. That
 * is the honest failure mode, and it is also why every review in the showcase
 * was undated: a slot nobody fills is a feature nobody ships. A date on a
 * review is not a host decision, it is table stakes for reading one.
 *
 * So the pair now owns a default, and the slot survives on top of it for the
 * host that wants relative time ("3 days ago") or its own calendar. The
 * default is deliberately absolute and short — a review from March is more
 * usefully "12 Mar 2026" than "5 months ago", because the question a reader is
 * asking is whether this seller was good RECENTLY, not how long ago exactly.
 *
 * ── The candidate for core ─────────────────────────────────────────────────
 *
 * `@stapel/core`'s i18n engine ships `t`/`tPlural` and no formatters at all,
 * so every pair that needs a date writes this. It belongs in core beside
 * `useT` (recorded in `SCRATCH/wave-b/REQUESTS-reviews-react.md`); until it is
 * there, this is the pair's model layer doing it once rather than three skins
 * doing it three ways.
 */
import { useSyncExternalStore } from "react";
import { useI18n } from "@stapel/core";

/**
 * Format an ISO timestamp as a short absolute date in `locale`.
 *
 * Returns `undefined` — never the input — for a value `Date` cannot parse.
 * Echoing the raw string back would put `2026-08-20T10:00:00Z` on the screen,
 * which is the exact outcome the slot existed to prevent, and it would do it
 * only on malformed data, i.e. where nobody is looking.
 */
export function formatReviewDate(
  iso: string,
  locale: string
): string | undefined {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return undefined;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(at);
  } catch {
    // An unknown locale tag is a host wiring fault, not a reason to lose the
    // date: fall back to the runtime's own default rather than to the ISO
    // string.
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(at);
  }
}

/**
 * {@link formatReviewDate} bound to the LIVE locale of the nearest i18n
 * engine — subscribed, so a runtime language switch re-renders the dates with
 * the sentences instead of leaving August in English under a Russian page.
 */
export function useReviewDateFormat(): (iso: string) => string | undefined {
  const engine = useI18n();
  const locale = useSyncExternalStore(
    engine.subscribe,
    () => engine.locale,
    () => engine.locale
  );
  return (iso) => formatReviewDate(iso, locale);
}
