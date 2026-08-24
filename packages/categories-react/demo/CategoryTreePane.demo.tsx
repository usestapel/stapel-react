/**
 * One level of the catalogue as a list of links — the pane both screens reuse.
 *
 * Its four load arms are the subject: "still syncing", "the sync failed",
 * "this category has no sub-categories" and "here they are" are four different
 * sentences, and the third is the one a LEAF legitimately gets. A fifth
 * condition rides alongside them — `truncated`, the sync walk having hit its
 * page budget — which is neither empty nor failed and says so on its own line.
 */
import { defineDemo } from "@stapel/showcase";
import { CategoryTreePane } from "../src/default/index.js";
import { CATEGORIES_I18N_KEYS } from "../src/index.js";
import { CategoriesDemoHarness } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import { DEMO_ROWS } from "./fixtures.js";

const SEEDED: DemoSeed = { rows: DEMO_ROWS };
const PARTIAL: DemoSeed = { rows: DEMO_ROWS, truncated: true };
const OUTAGE: DemoHandlers = {
  "/categories/": [503, { code: "stapel.http.503", message: "unavailable" }],
};

export default defineDemo({
  id: "categories.tree",
  title: "Category tree pane",
  description:
    "stapel-categories has no tree endpoint: the list returns FLAT rows ordered by revision, with ancestry as comma-joined pk strings. The client assembles the hierarchy, drops soft-deleted and inactive rows for DIFFERENT reasons, and resolves /c/:slug against the result — the server has no slug lookup either.",
  component: CategoryTreePane,
  covers: ["CategoriesProvider"],
  tokens: ["surface-raised"],
  variants: {
    roots: {
      description: "The top level, each row saying how many sub-categories it has.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryTreePane />
        </CategoriesDemoHarness>
      ),
    },
    "one level down": {
      description: "The sub-menu of a category, with the heading the page gives it.",
      viewport: "desktop",
      step: "ready-level",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryTreePane
            slug="electronics"
            titleKey={CATEGORIES_I18N_KEYS.categorySubcategories}
          />
        </CategoriesDemoHarness>
      ),
    },
    leaf: {
      description: "A leaf category. Not an error, and not an empty catalogue — its own sentence.",
      viewport: "desktop",
      step: "empty",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryTreePane slug="laptops" />
        </CategoriesDemoHarness>
      ),
    },
    "partial catalogue": {
      description:
        "The sync walk hit its page budget: a branch missing here was NOT read, it was not removed.",
      viewport: "desktop",
      step: "truncated",
      render: () => (
        <CategoriesDemoHarness seed={PARTIAL}>
          <CategoryTreePane />
        </CategoriesDemoHarness>
      ),
    },
    outage: {
      description: "A refusal. A failed sync never degrades to 'the catalogue is empty'.",
      viewport: "desktop",
      step: "failed",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CategoryTreePane />
        </CategoriesDemoHarness>
      ),
    },
  },
});
