/**
 * WHO WROTE THIS ANSWER — the third argument, no longer dropped on the floor.
 *
 * `@stapel/attributes-react` 0.16.4 made `<FeatureFields onChange>` emit
 * `(slug, value, source)`, because the rendering half performs two write-backs
 * of its own: a dependent field's answer CLEARED when its parent moved
 * (`"cascade"`), and a value the narrowed config left as the only possible one
 * (`"bake"`). Both arrived through the same callback a person's typing takes.
 *
 * This composer's `bag.setFeature` took two arguments, so the storefront
 * wiring `onChange={bag.setFeature}` lost the third silently — no type error,
 * no runtime error, just provenance that could not be told apart. A host
 * recording it stamped a cascade reset as the seller's own answer and locked
 * a field that held nothing.
 *
 * What is measured here is the seam, not a mock of it: a container drives the
 * bag the way `<ListingComposerPage>` does, and the claims are about what the
 * bag then holds and what the container was told.
 */
import { describe, expect, it } from "vitest";
import { useState } from "react";
import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { actionAvailable } from "@stapel/core";
import type { FeatureChangeSource, FeatureDef } from "@stapel/attributes-react";
import { ListingComposer } from "../src/index.js";
import type { ListingComposerBag } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { DRAFT, FEATURES } from "./fixtures.js";

const GALLERY = { refs: ["image/9f2c1a"], settled: actionAvailable() };

function server() {
  return mockServer({
    "/listings/42/save-draft/": { body: DRAFT },
    "/listings/": { body: DRAFT },
  });
}

/** One recorded `onFeatureChange` call. */
interface Told {
  readonly slug: string;
  readonly value: unknown;
  readonly source: FeatureChangeSource;
}

/**
 * A container shaped like the real one: it holds the category (so a category
 * change is a real controlled move), mounts the composer, and exposes the two
 * things a test can read — buttons that write an answer with a stated source,
 * and the provenance the bag reports back.
 */
function Harness(props: { told: Told[] }): ReactElement {
  const [category, setCategory] = useState("tools/drills");
  // The schema follows the category, the way a container's
  // `useCategoryFeatures(id)` read does. The second one asks for `brand` and
  // not for `power`, which is what makes `power` a DROPPED answer.
  const [features, setFeatures] = useState<readonly FeatureDef[]>(FEATURES);
  return (
    <ListingComposer
      features={features}
      images={GALLERY}
      category={category}
      onCategoryChange={(next) => {
        setCategory(next);
        setFeatures(FEATURES.filter((f) => f.slug !== "power"));
      }}
      onFeatureChange={(slug, value, source) => {
        props.told.push({ slug, value, source });
      }}
    >
      {(bag: ListingComposerBag) => (
        <div>
          <button
            type="button"
            data-testid="type-it"
            onClick={() => {
              bag.setFeature("power", 900);
            }}
          >
            type
          </button>
          <button
            type="button"
            data-testid="cascade-it"
            onClick={() => {
              bag.setFeature("power", undefined, "cascade");
            }}
          >
            cascade
          </button>
          <button
            type="button"
            data-testid="bake-it"
            onClick={() => {
              bag.setFeature("brand", ["bosch"], "bake");
            }}
          >
            bake
          </button>
          <button
            type="button"
            data-testid="other-category"
            onClick={() => {
              bag.setCategory("cars/parts");
            }}
          >
            move
          </button>
          <span data-testid="power-source">{bag.featureSources["power"] ?? "none"}</span>
          <span data-testid="brand-source">{bag.featureSources["brand"] ?? "none"}</span>
          <span data-testid="power-value">{String(bag.values.features["power"] ?? "")}</span>
        </div>
      )}
    </ListingComposer>
  );
}

describe("the composer records who answered", () => {
  it("treats a two-argument call as the person, which is what it always meant", async () => {
    const told: Told[] = [];
    render(
      <TestProviders server={server()}>
        <Harness told={told} />
      </TestProviders>
    );
    fireEvent.click(screen.getByTestId("type-it"));
    await waitFor(() => {
      expect(screen.getByTestId("power-source").textContent).toBe("user");
    });
    expect(screen.getByTestId("power-value").textContent).toBe("900");
    expect(told).toEqual([{ slug: "power", value: 900, source: "user" }]);
  });

  it("keeps a cascade reset apart from a person clearing the same field", async () => {
    // The defect exactly: both write `undefined` into `power`, and with a
    // two-argument setter the bag could not tell them apart — so the reset was
    // stamped as the seller's answer.
    const told: Told[] = [];
    render(
      <TestProviders server={server()}>
        <Harness told={told} />
      </TestProviders>
    );
    fireEvent.click(screen.getByTestId("type-it"));
    await waitFor(() => {
      expect(screen.getByTestId("power-source").textContent).toBe("user");
    });
    fireEvent.click(screen.getByTestId("cascade-it"));
    await waitFor(() => {
      expect(screen.getByTestId("power-source").textContent).toBe("cascade");
    });
    expect(told.map((t) => t.source)).toEqual(["user", "cascade"]);
  });

  it("passes a bake through to the container as a bake", async () => {
    const told: Told[] = [];
    render(
      <TestProviders server={server()}>
        <Harness told={told} />
      </TestProviders>
    );
    fireEvent.click(screen.getByTestId("bake-it"));
    await waitFor(() => {
      expect(screen.getByTestId("brand-source").textContent).toBe("bake");
    });
    expect(told).toEqual([{ slug: "brand", value: ["bosch"], source: "bake" }]);
  });

  it("drops the provenance with the value when a category change drops the slug", async () => {
    // A slug the next category happens to ask for again must come back
    // unattributed; a provenance that outlives its answer is a claim about a
    // field nobody has touched.
    const told: Told[] = [];
    render(
      <TestProviders server={server()}>
        <Harness told={told} />
      </TestProviders>
    );
    fireEvent.click(screen.getByTestId("type-it"));
    await waitFor(() => {
      expect(screen.getByTestId("power-source").textContent).toBe("user");
    });
    // The container moves the category AND the schema with it.
    fireEvent.click(screen.getByTestId("other-category"));
    await waitFor(() => {
      expect(screen.getByTestId("power-source").textContent).toBe("none");
    });
    // The answer itself went with it — the two are pruned together or they
    // disagree.
    expect(screen.getByTestId("power-value").textContent).toBe("");
  });
});
