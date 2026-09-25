import { describe, expect, it } from "vitest";
import { partitionSides } from "../src/index.js";
import type { CategoryChild } from "../src/index.js";
import { categoryRow, virtualChild } from "./fixtures.js";

describe("partitionSides", () => {
  it("offers the parent's own rows and never a pointer into another branch", () => {
    // The cars parent: new, used, and a car-rental CategoryLink into
    // services, drawn here but living elsewhere.
    const children: CategoryChild[] = [
      categoryRow(165, "novye", "Новые", 151, "141,151", ""),
      categoryRow(166, "s-probegom", "С пробегом", 151, "141,151", ""),
      { ...categoryRow(571, "arenda-avto", "Аренда авто", 900, "900", ""), linked: true },
      virtualChild("Седан", "sedan", { body: "sedan" }),
    ];
    expect(partitionSides(children).map((one) => one.id)).toEqual([165, 166]);
  });
});
