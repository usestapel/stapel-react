import { describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  assertVariantsRenderDistinctly,
  renderDemoVariant,
  variantIds,
} from "@stapel/showcase";
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

/**
 * Wait until a mounted variant STOPS CHANGING, rather than for a fixed number
 * of milliseconds.
 *
 * A flat sleep was the first attempt and it was flaky in exactly the way a
 * timing assumption always is: it passed running this file alone and failed
 * when the whole suite ran in parallel, because `useLocationPicker` debounces
 * the pin's resolve by `settleMs` (400 ms) and THEN makes a request — a clock
 * that runs late on a loaded machine. A test that can fail because the CI box
 * was busy is a test people learn to re-run, which is the same disease as a
 * banner people learn to ignore.
 *
 * So: sample the markup, and accept it only after it has been identical across
 * several consecutive samples AND at least {@link MIN_SETTLE_MS} of wall clock
 * has passed. Both conditions are needed — quiescence alone would accept the
 * frame before a delayed timer had fired at all, and elapsed time alone is the
 * flaky sleep again.
 */
const SAMPLE_MS = 120;
const STABLE_SAMPLES = 4;
/** Comfortably above the 400 ms resolve debounce plus its round trip. */
const MIN_SETTLE_MS = 1_200;
const SETTLE_DEADLINE_MS = 10_000;

async function settledMarkup(container: HTMLElement): Promise<string> {
  const started = Date.now();
  let previous = container.innerHTML;
  let stable = 0;
  for (;;) {
    await new Promise((resolve) => {
      setTimeout(resolve, SAMPLE_MS);
    });
    const current = container.innerHTML;
    if (current === previous) stable += 1;
    else {
      stable = 0;
      previous = current;
    }
    const elapsed = Date.now() - started;
    if (stable >= STABLE_SAMPLES && elapsed >= MIN_SETTLE_MS) return current;
    if (elapsed >= SETTLE_DEADLINE_MS) return current;
  }
}

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

    /**
     * THE GUARD THIS PACKAGE DID NOT HAVE.
     *
     * `viewport` and `step` are static CLAIMS the demo gate can read. Whether
     * a render closure actually REACHES the state it declares is only
     * answerable by rendering it — and this package's answer was no. Sixteen of
     * thirty-six shots were three frames repeated: every `geo.address-search`
     * variant painted "Keep typing to search." (the hook starts below
     * `search_min_chars` and nothing types into a static render), and every
     * `geo.location-picker` variant painted the grey `MapPlaceholder` (its
     * config arrives over `fetch`, so it is pending on the frame a shot keeps).
     *
     * Five handler maps and five variant names documented states no picture
     * ever showed. This is what turns that back into a red test at the moment
     * it is introduced, instead of a visual review three waves later.
     */
    it(`renders each variant of ${demo.id} distinctly`, () => {
      assertVariantsRenderDistinctly(demo, (element) =>
        renderToStaticMarkup(element)
      );
    });

    /**
     * And the same question once the dust settles.
     *
     * The static check above runs no effects: no query resolves, no debounce
     * fires, no refetch lands. That is the right frame to hold a shot runner
     * to, and it is not the only one that matters — a variant can start
     * distinct and CONVERGE, which is what happens when a seeded state is
     * refetched over by a mock that answers something else. So the mounted
     * screen is asked too.
     */
    it(`each variant of ${demo.id} still renders distinctly once mounted`, async () => {
      const byMarkup = new Map<string, string[]>();
      for (const id of variantIds(demo)) {
        const { container } = render(renderDemoVariant(demo, id));
        await waitFor(() => expect(container.firstChild).not.toBeNull());
        const markup = await settledMarkup(container);
        const bucket = byMarkup.get(markup);
        if (bucket) bucket.push(id);
        else byMarkup.set(markup, [id]);
        cleanup();
      }
      const duplicates = [...byMarkup.values()].filter((ids) => ids.length > 1);
      expect(
        duplicates,
        `demo "${demo.id}": these variants settle on identical DOM once mounted —\n` +
          duplicates.map((ids) => `    ${ids.join(" == ")}`).join("\n") +
          `\n  Seed the state each variant is named for, and make the demo's handlers\n` +
          `  answer what its seed holds.`
      ).toEqual([]);
    });
  }
});
