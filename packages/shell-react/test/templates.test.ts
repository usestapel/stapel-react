/**
 * Inversion check 7 (docs/composition-and-slots.md §5): the published
 * `shell-templates.json` and the `SHELL_TEMPLATES` constant are one table,
 * and its slot list is core's vocabulary — neither can drift alone.
 */
import { describe, expect, it } from "vitest";
import { SHELL_SLOT_IDS } from "@stapel/core";
import { SHELL_TEMPLATES } from "../src/index.js";
import json from "../shell-templates.json";

describe("shell-templates.json", () => {
  it("equals SHELL_TEMPLATES", () => {
    expect(json.templates).toEqual(SHELL_TEMPLATES);
  });

  it("lists core's SHELL_SLOT_IDS, in order", () => {
    expect(json.slots).toEqual([...SHELL_SLOT_IDS]);
  });

  it("names only vocabulary slots, and exclusive slots the template renders", () => {
    for (const template of Object.values(SHELL_TEMPLATES)) {
      for (const slot of template.slots) expect(SHELL_SLOT_IDS).toContain(slot);
      for (const slot of template.exclusive) expect(template.slots).toContain(slot);
    }
  });
});
