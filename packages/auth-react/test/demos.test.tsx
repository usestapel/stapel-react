/**
 * Smoke render for every auth-react demo (frontend-guardrails §4.2: demos are
 * first-class code — compiled, linted, RENDERED).
 *
 * "It mounted" is not the assertion. The visual pass found four stories that
 * mounted, threw nothing a page-error listener could see, and painted an
 * all-white rectangle — including the flagship composed security page — and a
 * gate asserting `container.firstChild !== null` waved every one of them
 * through, because the throw happens on the UPDATE that lands when the mocked
 * query resolves, not on the first render.
 *
 * So this file renders EVERY variant of EVERY demo, lets the mocked reads
 * settle, and then asserts what a reviewer would look for:
 *
 *   1. **Ink** — the variant paints readable text, not an empty canvas.
 *   2. **No raw i18n key** — nothing in the rendered text looks like
 *      `error.500.server` or `wallet.withdraw`; a dotted lowercase token is a
 *      translation someone forgot, shown to a user.
 *   3. **No console error** — React logs the "The above error occurred in…"
 *      report through `console.error` even when an ancestor swallows the
 *      throw, which is exactly how the four blank stories stayed silent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { renderDemoVariant, variantIds } from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

/**
 * A dotted lowercase identifier with at least two dots — the shape of every
 * i18n key this pair owns (`auth.error.unknown`, `error.503.unavailable`) and
 * of the scope names the verification screen used as a heading. Anything the
 * user is meant to read is a sentence, and a sentence has spaces.
 */
const RAW_KEY = /^[a-z][a-z0-9]*(\.[a-z0-9_]+){2,}$/;

/** Below this, a "render" is a card frame with a title and nothing in it. */
const MIN_INK = 8;

/** Rendered words, split the way a reader sees them. */
function words(text: string): readonly string[] {
  return text.split(/[\s,;:()"'—–]+/).filter((w) => w.length > 0);
}

/** One more turn of the loop, so a pending query update is flushed inside
 *  `act` rather than warned about. */
async function tick(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("auth-react demos", () => {
  const entries = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));

  it("discovers demos via glob", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  let errors: string[] = [];
  let spy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    errors = [];
    spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map((a) => String(a)).join(" "));
    });
  });

  afterEach(() => {
    spy?.mockRestore();
    spy = null;
  });

  for (const [path, mod] of entries) {
    const demo = mod.default;
    for (const variant of variantIds(demo)) {
      it(`renders ${demo.id} / ${variant} (${path})`, async () => {
        const { container } = render(renderDemoVariant(demo, variant));

        // 1. Ink on the canvas — awaited, because every one of these variants
        //    paints only once its mocked reads have landed.
        await waitFor(
          () => {
            expect(
              (container.textContent ?? "").trim().length,
              `${demo.id}/${variant} rendered no text`
            ).toBeGreaterThan(MIN_INK);
          },
          { timeout: 5000 }
        );
        await tick();
        const text = (container.textContent ?? "").trim();

        // 3. Nothing threw on the way there.
        expect(errors.join("\n")).not.toMatch(
          /error occurred in|Uncaught|is not a function|of undefined|Cannot read/
        );

        // 2. No raw translation key in what the reader sees.
        const leaked = words(text).filter((w) => RAW_KEY.test(w));
        expect(leaked, `${demo.id}/${variant} shows raw i18n key(s)`).toEqual([]);
      });
    }
  }
});
