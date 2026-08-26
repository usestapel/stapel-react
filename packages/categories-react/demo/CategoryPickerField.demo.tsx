/**
 * The compose form's category chooser — the control that gates the whole form.
 *
 * Two shapes, and they are different shapes rather than different widths: on a
 * phone the drill-down is a bottom SHEET behind a trigger showing the current
 * answer, because a journey rendered inline pushes every field below it up and
 * down as the level changes; on tablet and desktop the list is inline, where
 * there is room. Both blocked reasons are photographed, because "nothing
 * chosen" and "that one still has sub-categories" are different problems with
 * different fixes.
 */
import { defineDemo } from "@stapel/showcase";
import { CategoryPickerField } from "../src/default/index.js";
import { CategoriesDemoHarness } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import { DEMO_ROWS } from "./fixtures.js";

const SEEDED: DemoSeed = { rows: DEMO_ROWS };
const OUTAGE: DemoHandlers = {
  "/categories/": [503, { code: "stapel.http.503", message: "unavailable" }],
};

export default defineDemo({
  id: "categories.picker",
  title: "Category picker",
  description:
    "Drill down or search; either way the options come out of the tree already in memory, so typing issues no request per keystroke and the control works offline once the catalogue has synced. A non-leaf selection is refused WITH ITS REASON: a listing filed under 'Electronics' instead of 'Electronics › Phones' inherits a different feature set, so the form then asks the wrong questions.",
  component: CategoryPickerField,
  covers: ["CategoryPicker"],
  tokens: ["surface-raised"],
  variants: {
    "on a phone": {
      description:
        "The sheet itself, open: a full-width drill-down with rows on the touch floor, an up-button, the crumb and Done.",
      viewport: "phone",
      step: "sheet-open",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryPickerField value={null} surface="sheet" defaultOpen />
        </CategoriesDemoHarness>
      ),
    },
    "the closed trigger": {
      description:
        "After the tap, on a phone: a labelled field carrying the chosen leaf, with a caret at the end — not a centred block of text that reads as read-only.",
      viewport: "phone",
      step: "sheet-closed",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryPickerField value={3} surface="sheet" />
        </CategoriesDemoHarness>
      ),
    },
    inline: {
      description: "Tablet and desktop: the level is on the page, with the crumb above it.",
      viewport: "desktop",
      step: "blocked-nothing-selected",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryPickerField value={null} surface="inline" />
        </CategoriesDemoHarness>
      ),
    },
    "too general": {
      description: "A chosen category that still has sub-categories — the second reason.",
      viewport: "desktop",
      step: "blocked-not-a-leaf",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryPickerField value={1} surface="inline" />
        </CategoriesDemoHarness>
      ),
    },
    chosen: {
      description: "A leaf. The control stops blocking and names what was picked.",
      viewport: "desktop",
      step: "selected",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryPickerField value={3} surface="inline" />
        </CategoriesDemoHarness>
      ),
    },
    outage: {
      description: "The catalogue never arrived, so there is nothing to choose FROM.",
      viewport: "desktop",
      step: "failed",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CategoryPickerField value={null} surface="inline" />
        </CategoriesDemoHarness>
      ),
    },
  },
});
