/**
 * `degraded[]` — the backend declaring, per query, what the configured engine
 * could not do. The UI's job is to say it, not to smooth it over: a result
 * page that quietly drops "typo tolerance is off" is a page that looks like a
 * complete answer and is not one.
 *
 * The literals are produced in `stapel-search/services.py::_degradations` plus
 * whatever the backend and the facet counter contribute; the concatenation is
 * NOT de-duplicated upstream, so `"typo_tolerance"` can genuinely arrive
 * twice. {@link parseDegradations} de-duplicates by the raw literal.
 *
 * An unrecognised literal is kept, not dropped — the honest failure mode for
 * "the backend degraded in a way this build predates" is a generic sentence
 * with the literal beside it, not silence.
 */
import type { SearchDegradation, SearchDegradationKind } from "../api/types.js";

const SCORER_PREFIX = "scorer:";

const KNOWN: Readonly<Record<string, SearchDegradationKind>> = {
  typo_tolerance: "typo_tolerance",
  phrase_synonyms: "phrase_synonyms",
  exact_total: "exact_total",
  exact_facet_counts: "exact_facet_counts",
  category_rollup: "category_rollup",
};

/** i18n key per kind (`search.degraded.*`). */
export function degradationMessageKey(kind: SearchDegradationKind): string {
  return `search.degraded.${kind}`;
}

/** Parse and de-duplicate the envelope's `degraded[]`. */
export function parseDegradations(
  degraded: readonly string[] | undefined
): readonly SearchDegradation[] {
  if (degraded === undefined) return [];
  const seen = new Set<string>();
  const out: SearchDegradation[] = [];
  for (const raw of degraded) {
    if (seen.has(raw)) continue;
    seen.add(raw);
    if (raw.startsWith(SCORER_PREFIX)) {
      out.push({
        kind: "scorer",
        raw,
        scorer: raw.slice(SCORER_PREFIX.length),
        messageKey: degradationMessageKey("scorer"),
      });
      continue;
    }
    const kind = KNOWN[raw];
    out.push({
      kind: kind ?? "unknown",
      raw,
      messageKey: degradationMessageKey(kind ?? "unknown"),
    });
  }
  return out;
}

/**
 * Does this set of degradations mean the RESULT COUNT is an estimate?
 *
 * Two independent signals say so and a skin must not have to know which:
 * the envelope's own `exact_total: false`, and the `"exact_total"`
 * degradation. They agree in practice; treating either as decisive is what
 * keeps "≈1 200" from ever being rendered as "1 200".
 */
export function countIsEstimate(
  exactTotal: boolean,
  degradations: readonly SearchDegradation[]
): boolean {
  return !exactTotal || degradations.some((d) => d.kind === "exact_total");
}
