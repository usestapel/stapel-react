import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderDemoVariant, variantIds } from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

/**
 * Smoke render for every geo-react demo (frontend-guardrails §4.2: demos are
 * first-class code — compiled, linted, RENDERED). Discovers demos by glob so a
 * new `*.demo.tsx` is covered automatically, mounts EVERY variant with its mock
 * harness, and asserts it renders without throwing.
 *
 * Every variant, not just the first, because the variants of these demos ARE
 * the states that matter — anonymous, throttled, config-failed — and a demo of
 * a failure state that itself throws is the one that would go unnoticed.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

describe("geo-react demos", () => {
  const entries = Object.entries(modules);

  it("discovers demos via glob", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [path, mod] of entries) {
    const demo = mod.default;
    for (const variant of variantIds(demo)) {
      it(`renders ${demo.id}/${variant} (${path})`, () => {
        const { container } = render(renderDemoVariant(demo, variant));
        expect(container.firstChild).not.toBeNull();
      });
    }
  }
});
