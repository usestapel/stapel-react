/**
 * D455 — A SHARED SLUG IS NOT A SHARED ANSWER.
 *
 * Measured on ruberi.ru, 2026-09-12 (fleet probe p54, flow 5, desktop). The
 * analysis read the photo as the wristwatch leaf and answered the colour with
 * `zolotoy`, which that leaf offers. The category was then corrected to the
 * laptop leaf — which declares `color` too, so retention by SLUG kept the
 * answer — but whose sixteen options spell gold `zolotistyy`. The control
 * drew the raw code, the mirror refused the value `not_in_options`, and the
 * publish gate shut on the colour field, five rungs back:
 *
 *     "settled": [{ "owed": "<colour> (step 4)", "at": "step 4 of 9" }]
 *     "publish": { "pressed": "pressed", "url": "/new/1374?step=4" }
 *     "inFeed":  false
 *
 * over a field the catalogue marks OPTIONAL and the server publishes without
 * (`GET validate-draft/` → `{"valid": true}`, `POST publish/` → 200). The
 * seller cannot read the demand, and answering what it names is the only way
 * to clear it.
 *
 * The two claims here are the fix and its bound, and the second is the reason
 * the first is gated: a value judge that ran on every render would delete a
 * person's half-typed answer inside ONE category, which is the composer
 * editing them mid-sentence.
 */
import { describe, expect, it } from "vitest";
import { useState } from "react";
import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { actionAvailable } from "@stapel/core";
import type { FeatureDef } from "@stapel/attributes-react";
import { ListingComposer } from "../src/index.js";
import type { ListingComposerBag } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { DRAFT } from "./fixtures.js";

const GALLERY = { refs: ["image/9f2c1a"], settled: actionAvailable() };

function server() {
  return mockServer({
    "/listings/42/save-draft/": { body: DRAFT },
    "/listings/": { body: DRAFT },
  });
}

/** One `select` named the same on both leaves, offering different answers —
 * which is the whole defect, and is the ordinary shape of a catalogue built
 * per leaf rather than from one shared vocabulary. */
const colour = (options: readonly string[]): FeatureDef =>
  ({
    slug: "color",
    name: "Цвет",
    mandatory: false,
    config: {
      type: "select",
      options: options.map((value) => ({ value, label: value })),
      maxSelected: 1,
      minSelected: 0,
    },
  }) as unknown as FeatureDef;

/** The wristwatch leaf: gold is `zolotoy`. */
const WATCHES: readonly FeatureDef[] = [colour(["zolotoy", "seryy"])];
/** The laptop leaf: gold is `zolotistyy`, and `zolotoy` is not an answer it
 * offers. */
const LAPTOPS: readonly FeatureDef[] = [colour(["zolotistyy", "seryy"])];

/**
 * A container shaped like the storefront's: it holds the category, and the
 * schema follows it the way `useCategoryFeatures(id)` does.
 *
 * `features` is rebuilt as a FRESH ARRAY on every render on purpose — that is
 * what a query mapper hands back, and it is why "the schema changed" cannot be
 * read off array identity.
 */
function Harness(): ReactElement {
  const [onLaptops, setOnLaptops] = useState(false);
  const features = [...(onLaptops ? LAPTOPS : WATCHES)];
  return (
    <ListingComposer
      features={features}
      images={GALLERY}
      category={onLaptops ? "elektronika/noutbuki" : "chasy/naruchnye"}
    >
      {(bag: ListingComposerBag) => (
        <div>
          <button
            type="button"
            data-testid="ai-answers-colour"
            onClick={() => {
              bag.setFeature("color", ["zolotoy"]);
            }}
          >
            colour
          </button>
          <button
            type="button"
            data-testid="correct-the-category"
            onClick={() => {
              setOnLaptops(true);
            }}
          >
            move
          </button>
          <span data-testid="colour-value">
            {JSON.stringify(bag.values.features["color"] ?? null)}
          </span>
          <span data-testid="dropped">
            {bag.droppedOnCategoryChange.join(",") || "none"}
          </span>
          <span data-testid="colour-refused">
            {bag.mirror["color"] === undefined ? "no" : "yes"}
          </span>
        </div>
      )}
    </ListingComposer>
  );
}

describe("an answer does not survive into a category that will not take it", () => {
  it("drops a value the new leaf refuses, though both leaves declare the slug", async () => {
    render(
      <TestProviders server={server()}>
        <Harness />
      </TestProviders>
    );
    fireEvent.click(screen.getByTestId("ai-answers-colour"));
    await waitFor(() => {
      expect(screen.getByTestId("colour-value").textContent).toBe('["zolotoy"]');
    });
    // On the watches leaf the answer is perfectly good: nothing is refused.
    expect(screen.getByTestId("colour-refused").textContent).toBe("no");

    fireEvent.click(screen.getByTestId("correct-the-category"));

    // The publish gate reads `mirror`; this is the assertion the stand failed.
    await waitFor(() => {
      expect(screen.getByTestId("colour-refused").textContent).toBe("no");
    });
    expect(screen.getByTestId("colour-value").textContent).toBe("null");
    // …and it was NAMED, not lost silently — the composer can say "1 answer
    // does not apply to this category".
    expect(screen.getByTestId("dropped").textContent).toBe("color");
  });

  it("does NOT delete a refused answer while the category stays put", async () => {
    // The bound on the fix. Within one leaf a value the mirror refuses is a
    // person typing, and the mirror's job is to say so in red — not to erase
    // it. Measured by writing an answer this leaf does not offer and finding
    // it still there, still refused.
    render(
      <TestProviders server={server()}>
        <Harness />
      </TestProviders>
    );
    fireEvent.click(screen.getByTestId("correct-the-category"));
    await waitFor(() => {
      expect(screen.getByTestId("dropped").textContent).toBe("none");
    });
    fireEvent.click(screen.getByTestId("ai-answers-colour"));
    await waitFor(() => {
      expect(screen.getByTestId("colour-refused").textContent).toBe("yes");
    });
    // Still held, still the person's to fix.
    expect(screen.getByTestId("colour-value").textContent).toBe('["zolotoy"]');
    expect(screen.getByTestId("dropped").textContent).toBe("none");
  });
});
