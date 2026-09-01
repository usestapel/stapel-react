/**
 * The control the tile cap hands over to — the third step of the owner's
 * catalogue model, which had no picture and no implementation until now.
 *
 * Levels 1-2 of the tree are tiles; everything below is chosen as a
 * CHARACTERISTIC, in a ladder of child selects. The demo photographs both ends
 * of that: the composer's ladder from the catalogue root down to a leaf, and
 * the filter's ladder ROOTED at the category a person's tiles already arrived
 * at — the handover point, where the tiles stop and this starts.
 *
 * `commit` is the only thing the two disagree about, so both are here: a
 * filter takes any category (a path matches as a prefix, so a parent finds its
 * descendants), a composer takes only a leaf and says why while it has not.
 */
import { defineDemo } from "@stapel/showcase";
import { CategoryCascadeField } from "../src/default/index.js";
import { CategoriesDemoHarness } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import { DEMO_ROWS } from "./fixtures.js";

const SEEDED: DemoSeed = { rows: DEMO_ROWS };
const OUTAGE: DemoHandlers = {
  "/categories/": [503, { code: "stapel.http.503", message: "unavailable" }],
};

export default defineDemo({
  id: "categories.cascade",
  title: "Category cascade",
  description:
    "One select per level of the tree, growing a rung as each is answered and dropping every rung below when one is changed — the ladder is derived from the chain above it, never remembered, so a stale deep answer cannot survive a shallow change. It is deliberately the same gesture as a 'brand → model' characteristic, because under the owner's navigation model a deep category IS one. Counts per option are a host prop and are unfilled here: no server can currently count a category's children, and an invented number is worse than none.",
  component: CategoryCascadeField,
  covers: ["CategoryCascade", "useCategoryCascade"],
  tokens: ["surface-raised"],
  variants: {
    "on a phone": {
      description:
        "Nothing answered yet: one rung, the catalogue's roots, and the composer's gate stated rather than left silent.",
      viewport: "phone",
      step: "empty",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryCascadeField commit="leaf" value={null} />
        </CategoriesDemoHarness>
      ),
    },
    "half way": {
      description:
        "A non-leaf answered. Under `commit=leaf` it is NOT reported to the host — a listing filed there would inherit the wrong feature set — but the ladder still advances, because the cursor is not the value.",
      viewport: "phone",
      step: "blocked-not-a-leaf",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryCascadeField commit="leaf" value={null} rootId={1} />
        </CategoriesDemoHarness>
      ),
    },
    "at the leaf": {
      description:
        "The ladder finished. Every level above stays on screen and stays changeable, and the trail above them pops back to any of them in one tap.",
      viewport: "phone",
      step: "selected",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryCascadeField commit="leaf" value={4} />
        </CategoriesDemoHarness>
      ),
    },
    "inside a filter chip": {
      description:
        "The SERP's shape: rooted at the category the tiles arrived at, so it offers only what is below it, wrapping side by side, with no verdict line — there the narrowing is visible in the results themselves.",
      viewport: "phone",
      step: "filter",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryCascadeField
            commit="any"
            layout="inline"
            verdict={false}
            rootId={1}
            value={4}
          />
        </CategoriesDemoHarness>
      ),
    },
    "nothing left to narrow": {
      description:
        "Rooted at a leaf: the tiles arrived somewhere with nothing under it. Said out loud, rather than drawn as an empty box.",
      viewport: "desktop",
      step: "exhausted",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryCascadeField rootId={4} />
        </CategoriesDemoHarness>
      ),
    },
    outage: {
      description:
        "The catalogue never arrived, so there is nothing to narrow. A failed sync is never an empty catalogue.",
      viewport: "desktop",
      step: "failed",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CategoryCascadeField />
        </CategoriesDemoHarness>
      ),
    },
  },
});
