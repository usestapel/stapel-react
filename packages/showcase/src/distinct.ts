/**
 * The variant-distinctness guard (frontend-guardrails §4.2, visual pass
 * C-SAMESHOT / M-6).
 *
 * A demo declares variants because the states differ. When the named state is
 * only reachable by an interaction — a 429 that fires after a click, a dedup
 * branch that renders after a file is picked — the static render of every
 * variant is the SAME `idle` frame. The showcase then photographs one screen
 * three times and the catalog claims three states, which is worse than
 * declaring one: the gap is invisible precisely where it is being documented.
 *
 * This is checked by RENDERING, not by reading source: the two closures
 * `() => <D deduped={false}/>` and `() => <D deduped/>` differ textually and
 * paint identical DOM, so a static comparison would pass them. The renderer is
 * injected (`renderToStaticMarkup` in a pair's vitest, the real DOM in a shot
 * runner) so this package stays viewer-agnostic and pulls in no react-dom.
 */
import type { DemoDef } from "./defineDemo.js";
import { renderDemoVariant, variantIds } from "./render.js";

/** Renders a variant element to a comparable string (e.g. `renderToStaticMarkup`). */
export type MarkupRenderer = (element: ReturnType<typeof renderDemoVariant>) => string;

/** One group of variant ids whose rendered markup is byte-identical. */
export interface DuplicateVariantGroup {
  /** The markup all of these produced — the evidence, kept for the message. */
  readonly markup: string;
  /** Two or more variant ids that rendered it. */
  readonly variants: readonly string[];
}

/**
 * Render every variant of a demo and group the ids by identical markup.
 * Returns only the groups with more than one member — empty means the demo's
 * variants each show something of their own.
 */
export function duplicateVariantGroups(
  demo: DemoDef,
  render: MarkupRenderer
): readonly DuplicateVariantGroup[] {
  const byMarkup = new Map<string, string[]>();
  for (const id of variantIds(demo)) {
    const markup = render(renderDemoVariant(demo, id));
    const bucket = byMarkup.get(markup);
    if (bucket) bucket.push(id);
    else byMarkup.set(markup, [id]);
  }
  const groups: DuplicateVariantGroup[] = [];
  for (const [markup, variants] of byMarkup) {
    if (variants.length > 1) groups.push({ markup, variants });
  }
  return groups;
}

/**
 * Throw unless every variant of `demo` renders something distinct. Call it from
 * the pair's demo smoke test — one line per package, and a variant that stopped
 * being seeded turns red where it was introduced instead of in a screenshot
 * review three waves later.
 */
export function assertVariantsRenderDistinctly(
  demo: DemoDef,
  render: MarkupRenderer
): void {
  const groups = duplicateVariantGroups(demo, render);
  if (groups.length === 0) return;
  const detail = groups
    .map((g) => {
      const seeded = g.variants
        .map((id) => demo.variants[id]?.step)
        .filter((s): s is string => typeof s === "string");
      const stepNote =
        seeded.length > 0 ? ` (declared step${seeded.length > 1 ? "s" : ""}: ${seeded.join(", ")})` : "";
      return `    ${g.variants.join(" == ")}${stepNote}`;
    })
    .join("\n");
  throw new Error(
    `demo "${demo.id}": variants render byte-identical DOM — the state each one is\n` +
      `  named for is not reached by its static render, so the showcase photographs\n` +
      `  the same frame under several names:\n` +
      `${detail}\n` +
      `  Seed the state in the render closure (a pre-stepped machine, a bag fixture)\n` +
      `  and declare it with \`step: "<state>"\`, or drop the variant.`
  );
}
