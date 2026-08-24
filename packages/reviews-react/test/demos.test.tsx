import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { renderDemoVariant, variantIds } from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

/**
 * The demo suite (frontend-guardrails §4.2: demos are first-class code —
 * compiled, linted, RENDERED). Discovers demos by glob so a new `*.demo.tsx`
 * is covered automatically.
 *
 * ── Why this does not call `assertVariantsRenderDistinctly` ────────────────
 *
 * `@stapel/showcase` ships the C-SAMESHOT guard as a SYNCHRONOUS check:
 * `duplicateVariantGroups(demo, renderToStaticMarkup)`. Every state in this
 * pair arrives over a mocked wire through react-query, so a synchronous render
 * shows the LOADING arm for every variant of every demo — the check would pass
 * vacuously on identical skeletons, which is worse than not running it. The
 * assertion below is the same claim, awaited: mount each variant, let its load
 * settle, and compare the DOM that a screenshot would actually capture. (A
 * request is in `SCRATCH/wave-b/REQUESTS-reviews-react.md` for an async
 * `assertVariantsRenderDistinctlyAsync` in the showcase package, so the other
 * query-driven pairs get this without writing it again.)
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

/** Mount one variant, wait for its load to settle, return the settled DOM. */
async function settledMarkup(demo: DemoDef, variantId: string): Promise<string> {
  const { container, unmount } = render(renderDemoVariant(demo, variantId));
  // A skin's loading arm is stamped by the substrate; a variant that is still
  // showing one has not reached the state it is named for.
  await waitFor(() => {
    expect(
      container.querySelector('[data-stapel-load-state="loading"]'),
      `${demo.id} / ${variantId} is still loading`
    ).toBeNull();
  });
  const markup = container.innerHTML;
  unmount();
  return markup;
}

describe("reviews-react demos", () => {
  const entries = Object.entries(modules);

  it("discovers demos via glob", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [path, mod] of entries) {
    const demo = mod.default;

    it(`renders every variant of ${demo.id} (${path})`, async () => {
      for (const id of variantIds(demo)) {
        const { container, unmount } = render(renderDemoVariant(demo, id));
        expect(container.firstChild, `${demo.id} / ${id}`).not.toBeNull();
        unmount();
      }
    });

    it(`${demo.id} draws each variant at the width it declares`, () => {
      const variants = Object.values(demo.variants);
      // Mobile-first is a rule with teeth only when something reads it.
      expect(
        variants.some((v) => v.viewport === "phone"),
        `${demo.id} has no phone variant`
      ).toBe(true);
      expect(
        variants.some((v) => v.viewport === "desktop"),
        `${demo.id} has no desktop variant`
      ).toBe(true);
      // A variant whose named state is only reachable by a click is a variant
      // a static shot never photographs: `step` says where the closure starts.
      for (const [id, variant] of Object.entries(demo.variants)) {
        expect(
          typeof variant.step,
          `${demo.id} / ${id} declares no seeded step`
        ).toBe("string");
      }
    });

    it(`${demo.id} shows something different in every variant`, async () => {
      const seen = new Map<string, string>();
      for (const id of variantIds(demo)) {
        const markup = await settledMarkup(demo, id);
        const twin = seen.get(markup);
        expect(
          twin,
          `${demo.id}: variants "${twin}" and "${id}" render identical DOM — ` +
            `the state each is named for is not reached by its render closure, ` +
            `so the showcase photographs one frame under two names`
        ).toBeUndefined();
        seen.set(markup, id);
      }
    });
  }
});
