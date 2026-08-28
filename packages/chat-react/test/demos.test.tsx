import { describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  assertVariantsRenderDistinctly,
  playVariantIds,
  renderDemoVariant,
  runDemoPlay,
  variantIds,
} from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

/**
 * Smoke render for every chat-react demo (frontend-guardrails §4.2: demos
 * are first-class code — compiled, linted, RENDERED). Discovers demos by glob so
 * a new `*.demo.tsx` is covered automatically, mounts each default variant with
 * its mock harness, and asserts it renders without throwing.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

/**
 * Wait until a mounted variant STOPS CHANGING, rather than for a fixed number
 * of milliseconds.
 *
 * A flat sleep is flaky in exactly the way a timing assumption always is: it
 * passes running one file and fails when the whole suite runs in parallel and
 * a timer lands late on a loaded machine. A test that can fail because the box
 * was busy is a test people learn to re-run, which is the same disease as a
 * banner people learn to ignore.
 *
 * Both conditions are required. Quiescence alone would accept the frame before
 * a delayed effect had run at all; elapsed time alone is the flaky sleep.
 */
const SAMPLE_MS = 100;
const STABLE_SAMPLES = 4;
const MIN_SETTLE_MS = 600;
const SETTLE_DEADLINE_MS = 8_000;

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

describe("chat-react demos", () => {
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

    // The runtime half of the C-SAMESHOT guard. `viewport`/`step` are static
    // claims the demo gate can read; whether the render closure actually
    // REACHES the state it declares is only answerable by rendering it. A
    // variant whose state arrives over fetch paints a spinner on its first
    // frame — which is the frame a shot runner keeps — so this is what forces
    // the demos to seed their cache instead of documenting three spinners.
    // A variant with a `play` step is EXEMPT from the distinctness checks —
    // its first frame is legitimately its sibling's — so nothing else in this
    // file looks at it, and a step whose selector rotted would leave the
    // catalogue photographing the closed button under a name that says open.
    // The step is the only evidence that state is reachable at all, so it is
    // run: a failed one throws.
    const played = playVariantIds(demo);
    if (played.length > 0) {
      it.each(played)(`runs the play step of ${demo.id} (%s)`, async (id) => {
        const { container } = render(renderDemoVariant(demo, id));
        await runDemoPlay(demo, id, container);
        cleanup();
      });
    }

    it(`renders each variant of ${demo.id} distinctly`, () => {
      assertVariantsRenderDistinctly(demo, (element) =>
        renderToStaticMarkup(element)
      );
    });

    // The MOUNTED half, and the one the visual review needed.
    //
    // `assertVariantsRenderDistinctly` renders to static markup: no effects, no
    // microtasks, no refetch. That is exactly the frame a seeded demo gets
    // right — and it is not the frame anybody looks at. The showcase mounts,
    // React runs the effects, TanStack sees a seeded query it considers stale,
    // refetches it, and whatever the mock answers replaces the state the
    // variant is NAMED for.
    //
    // That gap let three thread variants settle on the ERROR card and three
    // inbox variants on the EMPTY card while this file stayed green: the seeds
    // were real, the static frame was correct, and the screen a person saw was
    // neither. So the same distinctness question is asked again after the dust
    // settles, which is the only place "all three render the error card" is
    // visible at all.
    it(`each variant of ${demo.id} still renders distinctly once mounted`, async () => {
      const byMarkup = new Map<string, string[]>();
      for (const id of variantIds(demo)) {
        const { container } = render(renderDemoVariant(demo, id));
        // Let the mount refetch land — a query that resolves synchronously in
        // a microtask still repaints after this frame.
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
          `\n  The seed reached the first frame and was then refetched over. Make the\n` +
          `  demo's handlers answer what its seed holds, and pin the query.`
      ).toEqual([]);
    });
  }
});
