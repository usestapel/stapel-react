/**
 * Scorer SLUGS turned into the names the disclosure already gives them.
 *
 * `degraded[]` reports a scorer the engine could not evaluate as
 * `"scorer:geo_decay"` — a registry identifier, because that is the only
 * handle the query envelope has. Printed straight into a sentence it reads
 * "The ranking parameter “geo_decay” was not applied", which is a developer's
 * word in a shopper's banner (class C-DEVCOPY).
 *
 * The name is not this pair's to invent: the backend already publishes one per
 * scorer on `GET /ranking` (`description_key`, a translation key). So the
 * lookup goes there — through the SAME cache entry `<RankingDisclosure>`
 * fills, with `enabled: false`, so a result page never issues a second request
 * for a label. When the disclosure has not been read the map is empty and the
 * banner falls back to the slug, which is what it said before and is at least
 * traceable.
 */
import { useT } from "@stapel/core";
import { useRankingDisclosure } from "../model/queries.js";
import { useSearchState } from "./SearchStateProvider.js";

/** `(slug) => name`, or `undefined` when nothing in cache names that slug. */
export type ScorerNameLookup = (slug: string) => string | undefined;

export function useScorerNames(): ScorerNameLookup {
  const t = useT();
  const { state } = useSearchState();
  const query = useRankingDisclosure(state.type, { enabled: false });
  const scorers = query.data?.scorers;
  return (slug: string) => {
    const scorer = scorers?.find((candidate) => candidate.slug === slug);
    if (scorer === undefined) return undefined;
    const named = t(scorer.description_key);
    return named.length > 0 && named !== scorer.description_key ? named : undefined;
  };
}
