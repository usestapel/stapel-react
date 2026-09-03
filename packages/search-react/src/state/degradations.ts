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

/**
 * "This answer's facet plan could not be drawn from evidence."
 *
 * Named rather than inlined because the FACET PANEL reads the raw literal
 * off the envelope: whether "this search offers no filters" is a true
 * sentence is a question about THIS answer, not about the banner, and the
 * panel must not have to parse the whole list to ask it.
 */
export const FACET_PLAN_EVIDENCE = "facet_plan_evidence";

const KNOWN: Readonly<Record<string, SearchDegradationKind>> = {
  typo_tolerance: "typo_tolerance",
  phrase_synonyms: "phrase_synonyms",
  exact_total: "exact_total",
  exact_facet_counts: "exact_facet_counts",
  category_rollup: "category_rollup",
  // Reader-facing by omission from OPERATOR_KINDS below, and deliberately:
  // it changes what an empty filter panel MEANS, which is the one thing on
  // the page a buyer can act on (widen, or filter by category instead).
  [FACET_PLAN_EVIDENCE]: "facet_plan_evidence",
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
 *
 * @deprecated Since stapel-search 0.2.0 the envelope answers this directly
 * with `count_is_lower_bound`, and "not exact" now means a FLOOR rather than
 * a fuzzy number. Use {@link countKind}, which reads the wire field and also
 * handles `count: null`.
 */
export function countIsEstimate(
  exactTotal: boolean,
  degradations: readonly SearchDegradation[]
): boolean {
  return !exactTotal || degradations.some((d) => d.kind === "exact_total");
}

/**
 * How a count may be spoken: as a number, as a floor, or not at all.
 *
 * The three states stapel-search 0.2.0 made explicit, because the version
 * before it had only two and used `0` for both "none match" and "we do not
 * know" — which is how a storefront came to print "About 0 listings" over
 * four visible cards.
 */
export type SearchCountKind = "exact" | "at_least" | "unknown";

/**
 * Read the envelope's three count fields as one decision.
 *
 * `null` is UNKNOWN and renders as no count line — never as `0`, and never
 * as "about 0". Anything the server declines to call exact is rendered as a
 * floor ("N+"), including the defensive case of an `exact_total: false` from
 * a server that predates `count_is_lower_bound`: claiming "at least N" over
 * a page that shows N rows is the one reading that cannot be contradicted by
 * what the reader can see.
 */
export function countKind(
  count: number | null | undefined,
  isLowerBound: boolean | undefined,
  exactTotal: boolean,
  degradations: readonly SearchDegradation[]
): SearchCountKind {
  if (count === null || count === undefined) return "unknown";
  if (isLowerBound === true) return "at_least";
  return countIsEstimate(exactTotal, degradations) ? "at_least" : "exact";
}

/**
 * Is `exact_total` the ONLY thing the engine could not do?
 *
 * It is a count NUANCE, not a failed search: the answer is complete, the
 * rows are the right rows, and the single consequence — that the total is a
 * floor — is already spoken by the count itself as "N+". Raising a warning
 * banner over it teaches a reader that a perfectly good result page is
 * broken, and a banner that cries wolf on every landing page is a banner
 * nobody reads on the day `category_rollup` shows up in it.
 *
 * Every other degradation changes what the page MEANS ("typos were not
 * corrected", "subcategories may be missing", "counts are approximate") and
 * still renders. So does `exact_total` when it arrives BESIDE one of them —
 * the list is then a description of a genuinely degraded answer.
 */
export function isCountNuanceOnly(
  degradations: readonly SearchDegradation[]
): boolean {
  return (
    degradations.length > 0 &&
    degradations.every((degradation) => degradation.kind === "exact_total")
  );
}

/**
 * Who a degradation is addressed to.
 *
 * - `"reader"` — it changes what THIS PAGE MEANS. "Counts are approximate",
 *   "subcategories may be missing", "a ranking parameter is inactive", and
 *   anything this build has no wording for. A buyer can act on these: read
 *   the numbers as estimates, widen the category, distrust the order.
 * - `"operator"` — it describes the ENGINE THIS DEPLOYMENT CHOSE. Nothing a
 *   buyer does changes it, and it is the same sentence on every query
 *   forever, which is precisely what makes it invisible by the time it
 *   matters.
 */
export type SearchDegradationAudience = "reader" | "operator";

const OPERATOR_KINDS: ReadonlySet<string> = new Set<SearchDegradationKind>([
  // Both of these say, in the shipped copy, "the search engine in use
  // cannot do this" — a sentence about a procurement decision, printed at a
  // person trying to buy a phone.
  "typo_tolerance",
  "phrase_synonyms",
  // A count nuance the count itself already speaks, as "N+". This is the
  // rule `isCountNuanceOnly` encoded for one kind, generalized.
  "exact_total",
]);

/** {@link SearchDegradationAudience} for one kind. */
export function degradationAudience(
  kind: SearchDegradationKind
): SearchDegradationAudience {
  return OPERATOR_KINDS.has(kind) ? "operator" : "reader";
}

/**
 * The degradations a buyer should be told about.
 *
 * The live defect this exists for: a classified board raised a full-screen
 * yellow "What this search could not do: synonyms were not substituted —
 * the search engine in use cannot do this" between the sort control and
 * the first card, on every query, for every buyer. It was not a lie about a
 * broken thing — stapel-search really did report `phrase_synonyms` on every
 * query with text — which is exactly why deleting the STRING would have been
 * the wrong fix: the next engine-capability literal would have grown its own
 * copy of it. What is wrong is the AUDIENCE, so the audience is the thing
 * that got a name.
 *
 * `variant="debug"` on `<DegradationNotice>` shows the operator's half; a
 * host that wants it on a status page renders that.
 */
export function readerFacing(
  degradations: readonly SearchDegradation[]
): readonly SearchDegradation[] {
  return degradations.filter(
    (degradation) => degradationAudience(degradation.kind) === "reader"
  );
}
