/**
 * Owner, 2026-09-27 — switching a partition side ("new" / "used")
 * sometimes said "1 answer was cleared". It should not say anything: the
 * one-sided field goes quietly, and an answer the seller typed there comes
 * back when they switch back.
 *
 *  - `setCategory(id, { quiet: true })` drops what the new side will not
 *    carry WITHOUT reporting it in `droppedOnCategoryChange`;
 *  - every drop on a switch is SHELVED, and a later schema that asks for the
 *    slug again gets the value (and its author) back where the form holds no
 *    answer of its own;
 *  - a non-quiet switch still names what it cleared.
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

const intFeature = (slug: string): FeatureDef =>
  ({
    slug,
    name: slug,
    mandatory: false,
    config: { type: "int", min: 0, max: 1000000 },
  }) as unknown as FeatureDef;

/** The used side asks for mileage; the new side does not. Both ask the year. */
const USED: readonly FeatureDef[] = [intFeature("year"), intFeature("kilometrage")];
const NEW: readonly FeatureDef[] = [intFeature("year")];

function Harness(props: { readonly quiet: boolean }): ReactElement {
  const [side, setSide] = useState<"used" | "new">("used");
  const features = [...(side === "used" ? USED : NEW)];
  return (
    <ListingComposer
      features={features}
      images={GALLERY}
      category={side === "used" ? "cars/used" : "cars/new"}
    >
      {(bag: ListingComposerBag) => {
        const go = (next: "used" | "new"): void => {
          setSide(next);
          bag.setCategory(next === "used" ? "cars/used" : "cars/new", {
            quiet: props.quiet,
          });
        };
        return (
          <div>
            <button type="button" data-testid="type-mileage" onClick={() => bag.setFeature("kilometrage", 90000)}>
              mileage
            </button>
            <button type="button" data-testid="type-year" onClick={() => bag.setFeature("year", 2015)}>
              year
            </button>
            <button type="button" data-testid="to-new" onClick={() => go("new")}>
              new
            </button>
            <button type="button" data-testid="to-used" onClick={() => go("used")}>
              used
            </button>
            <span data-testid="mileage">
              {JSON.stringify(bag.values.features["kilometrage"] ?? null)}
            </span>
            <span data-testid="year">{JSON.stringify(bag.values.features["year"] ?? null)}</span>
            <span data-testid="mileage-source">{bag.featureSources["kilometrage"] ?? "none"}</span>
            <span data-testid="dropped">{bag.droppedOnCategoryChange.join(",") || "none"}</span>
          </div>
        );
      }}
    </ListingComposer>
  );
}

function mount(quiet: boolean): void {
  const server = mockServer({
    "/listings/42/save-draft/": { body: DRAFT },
    "/listings/": { body: DRAFT },
  });
  render(
    <TestProviders server={server}>
      <Harness quiet={quiet} />
    </TestProviders>
  );
}

describe("a partition side switch is quiet and reversible", () => {
  it("drops the one-sided answer without reporting it, and brings it back", async () => {
    mount(true);
    fireEvent.click(screen.getByTestId("type-year"));
    fireEvent.click(screen.getByTestId("type-mileage"));
    await waitFor(() => expect(screen.getByTestId("mileage").textContent).toBe("90000"));

    fireEvent.click(screen.getByTestId("to-new"));
    await waitFor(() => expect(screen.getByTestId("mileage").textContent).toBe("null"));
    expect(screen.getByTestId("dropped").textContent).toBe("none");
    expect(screen.getByTestId("year").textContent).toBe("2015");

    fireEvent.click(screen.getByTestId("to-used"));
    await waitFor(() => expect(screen.getByTestId("mileage").textContent).toBe("90000"));
    expect(screen.getByTestId("mileage-source").textContent).toBe("user");
    expect(screen.getByTestId("dropped").textContent).toBe("none");
  });

  it("a non-quiet switch still names what it cleared, and still shelves it", async () => {
    mount(false);
    fireEvent.click(screen.getByTestId("type-mileage"));
    await waitFor(() => expect(screen.getByTestId("mileage").textContent).toBe("90000"));
    fireEvent.click(screen.getByTestId("to-new"));
    await waitFor(() => expect(screen.getByTestId("dropped").textContent).toBe("kilometrage"));
    fireEvent.click(screen.getByTestId("to-used"));
    await waitFor(() => expect(screen.getByTestId("mileage").textContent).toBe("90000"));
  });
});
