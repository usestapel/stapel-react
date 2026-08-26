import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  assertVariantsRenderDistinctly,
  assertVariantsSettleDistinctly,
  renderDemoVariant,
  variantIds,
} from "@stapel/showcase";
import type { DemoDef, MountedVariant } from "@stapel/showcase";

/**
 * Smoke render for every notifications-react demo (frontend-guardrails §4.2: demos
 * are first-class code — compiled, linted, RENDERED). Discovers demos by glob so
 * a new `*.demo.tsx` is covered automatically, mounts each default variant with
 * its mock harness, and asserts it renders without throwing.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

describe("notifications-react demos", () => {
  const entries = Object.entries(modules);

  it("discovers demos via glob", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [path, mod] of entries) {
    const demo = mod.default;
    const first = variantIds(demo)[0];
    it(`renders ${demo.id} (${path})`, () => {
      expect(first).toBeDefined();
      if (!first) return;
      const { container } = render(renderDemoVariant(demo, first));
      expect(container.firstChild).not.toBeNull();
    });

    // A demo declares variants because the states DIFFER. When the named state
    // is only reachable by a click, every variant paints the same first frame
    // and the showcase photographs one screen under three names — worse than
    // declaring one, because the gap is invisible exactly where it is being
    // documented. Seed the state (see `demo/_harness.tsx`'s `seed`) or drop
    // the variant.
    it(`${demo.id} paints something different for every variant`, () => {
      assertVariantsRenderDistinctly(demo, (element) =>
        renderToStaticMarkup(element)
      );
    });

    // The FIRST frame being right is not the same claim as the SCREEN being
    // right, and the read-state variants are exactly where the two come apart:
    // every one of them is a seeded cache, and a mount effect that refetched
    // over the seed would answer from the harness's catch-all `{}` and settle
    // three differently-named variants onto one empty card — green under the
    // static guard above, because its seeds were real. This mounts each
    // variant into jsdom, lets the effects run, and asks whether the state the
    // variant is NAMED for is the one still on screen.
    it(`${demo.id} still shows its own state once mounted`, async () => {
      await assertVariantsSettleDistinctly(demo, {
        render: (element): MountedVariant => {
          const view = render(element);
          return {
            container: view.container,
            unmount: () => {
              view.unmount();
            },
          };
        },
      });
    });
  }
});
