/**
 * Runtime render helper shared by the generated CSF stories (gen:demos) and the
 * vitest smoke tests: resolve a variant, run its render closure, and apply the
 * demo's provider decorator. The theme frame (data-theme + tokens.css) is the
 * viewer's job (§4.1), not this function's — this only wires the demo's own
 * providers so a single variant renders identically in Ladle and in a test.
 */
import type { ReactElement } from "react";
import type { DemoDef } from "./defineDemo.js";

/** All variant ids of a demo, in declaration order. */
export function variantIds(demo: DemoDef): readonly string[] {
  return Object.keys(demo.variants);
}

/**
 * Render one variant of a demo, wrapped in its provider decorator. Throws if
 * the variant id is unknown (a generated story never asks for one that is not
 * declared, so this only fires on a hand-written mistake).
 */
export function renderDemoVariant(demo: DemoDef, variantId: string): ReactElement {
  const variant = demo.variants[variantId];
  if (!variant) {
    throw new Error(
      `demo "${demo.id}" has no variant "${variantId}" (have: ${variantIds(
        demo
      ).join(", ")})`
    );
  }
  const node = variant.render();
  return <>{demo.decorator ? demo.decorator(node) : node}</>;
}
