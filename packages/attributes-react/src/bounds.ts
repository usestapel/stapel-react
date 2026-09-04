/**
 * What a numeric field currently ALLOWS, and who decided it.
 *
 * ── Why a bound needs a provenance ─────────────────────────────────────────
 *
 * `narrowConfig` folds a matching `limit` rule into `min`/`max` and then
 * forgets the rule — which is right for validation (the engine reports
 * `above_maximum` either way) and wrong for the person: "from 1900 to 2026"
 * and "for this generation, from 2018 to 2024" are two different sentences,
 * and only the second one tells a seller why the year they typed was
 * refused. So this module answers both halves in one call — the numbers, and
 * the controlling slugs of the rule that produced them.
 *
 * It obeys `narrowConfig`'s own law, because a control that constrained more
 * than the mirror would refuse a value the server accepts: **a bound is
 * replaced, never introduced.** A `limit` rule on a config that declares no
 * `max` yields no `max` here either, and then `sources` is empty — nothing
 * was decided by a rule, so nothing is attributed to one.
 *
 * React-free and antd-free: this is the main entry, and the same numbers feed
 * the mirror, the control and a host drawing its own rows.
 */
import type { FeatureDef, Rule } from "./types.js";
import { featureConfig } from "./types.js";
import { conditionSlugs, parseRules, ruleWhenMatches } from "./rules.js";

/** The live bound of one numeric feature. */
export interface FeatureBounds {
  readonly min: number | undefined;
  readonly max: number | undefined;
  /**
   * The slugs whose answers set this bound — the conditions of the `limit`
   * rule that won. Empty when the bound is the catalogue's own, which is the
   * common case and the one that gets the plain "from X to Y".
   */
  readonly sources: readonly string[];
}

function numberOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * The bound a feature's config and rules leave in force, with its provenance.
 *
 * The LAST matching `limit` wins and replaces both ends (limits do not
 * intersect — `stateOf`'s rule, mirrored here so the two cannot drift), and a
 * replacement only lands on a bound the config already declares.
 *
 * A rule set that does not parse yields the config's own bounds and no
 * sources rather than throwing: the caller is a control being drawn, and a
 * broken rule set is already reported as its own loud notice one level up.
 */
export function featureBounds(
  feature: FeatureDef,
  values?: Readonly<Record<string, unknown>>
): FeatureBounds {
  const config = featureConfig(feature);
  const declaredMin = "min" in config;
  const declaredMax = "max" in config;
  let min = numberOf(config["min"]);
  let max = numberOf(config["max"]);

  let rules: readonly Rule[];
  try {
    rules = parseRules(feature.rules, feature.slug);
  } catch {
    return { min, max, sources: [] };
  }

  let winner: Rule | undefined;
  for (const rule of rules) {
    if (rule.effect !== "limit") continue;
    if (!ruleWhenMatches(rule.when, values)) continue;
    winner = rule;
  }
  if (winner === undefined) return { min, max, sources: [] };

  let applied = false;
  if (winner.min !== undefined && declaredMin) {
    min = winner.min;
    applied = true;
  }
  if (winner.max !== undefined && declaredMax) {
    max = winner.max;
    applied = true;
  }
  return { min, max, sources: applied ? conditionSlugs(winner.when) : [] };
}
