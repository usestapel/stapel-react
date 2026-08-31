/**
 * The categories a typed query reached, as links.
 *
 * The point of photographing this one is what it is NOT. A catalogue of
 * thousands of rows cannot be browsed by scrolling and must not be offered as
 * a modal picker or as a typeahead over the whole tree — the navigation model
 * (`catalog/tiles.ts`) rules both out. So the surface a query gets is the
 * plainest thing that answers "I typed the name of a section and only ever
 * landed in results": a heading naming the query and a short list of links.
 *
 * Three variants, and the third is the one a screenshot suite exists for: with
 * no hits the component renders NOTHING. Not an empty state — that would be a
 * second, louder "no results" beside the one the search itself already shows,
 * on a surface that is only ever a hint.
 */
import { defineDemo } from "@stapel/showcase";
import { CategorySearchHits } from "../src/default/index.js";
import { rankCategoryMatches } from "../src/index.js";
import { buildCategoryTree } from "../src/index.js";
import { CategoriesDemoHarness } from "./_harness.js";
import { DEMO_ROWS } from "./fixtures.js";

/** The tree a query is matched against — the BROWSE projection, so the
 * retired and the deleted rows in the fixture are not reachable from here
 * however well their names match. */
const INDEX = buildCategoryTree(DEMO_ROWS);
const NODES = [...INDEX.byId.values()];

/** Translated the way the pair translates everything: a category's `name` is
 * a KEY on the wire, and the caption a match is made against is what the
 * host's `t` returns for it. The demo bundle supplies the English. */
const TRANSLATE = (key: string): string =>
  ({
    "demo.category.electronics": "Electronics",
    "demo.category.phones": "Phones",
    "demo.category.laptops": "Laptops",
    "demo.category.used_phones": "Used phones",
    "demo.category.vehicles": "Vehicles",
  })[key] ?? key;

const HITS_PHONE = rankCategoryMatches(NODES, "phone", { translate: TRANSLATE });
const HITS_ONE = rankCategoryMatches(NODES, "laptops", { translate: TRANSLATE });
const HITS_NONE = rankCategoryMatches(NODES, "zzzz", { translate: TRANSLATE });

export default defineDemo({
  id: "categories.search-hits",
  title: "Category search hits",
  description:
    "The categories a search query reached, ranked exact-then-prefix-then-substring and printed as links above the results. Not a picker and not a typeahead over the tree: a short list that lets a person who typed a section's name land in that section instead of only ever landing in results. With no hits it renders nothing at all.",
  component: CategorySearchHits,
  covers: ["useCategorySearch"],
  tokens: ["surface", "text"],
  variants: {
    ranked: {
      description:
        "Two hits for one word: the exact leaf first, then the deeper match. Both are links, both go to the catalogue.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <CategoriesDemoHarness>
          <CategorySearchHits query="phone" hits={HITS_PHONE} />
        </CategoriesDemoHarness>
      ),
    },
    "one hit": {
      description: "A single destination — the list is a list of one, not a paragraph.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <CategoriesDemoHarness>
          <CategorySearchHits query="laptops" hits={HITS_ONE} />
        </CategoriesDemoHarness>
      ),
    },
    "nothing matched": {
      description:
        "Renders nothing. The search's own empty state is the one that speaks; a second one here would say it louder and mean less.",
      viewport: "phone",
      step: "empty",
      render: () => (
        <CategoriesDemoHarness>
          <CategorySearchHits query="zzzz" hits={HITS_NONE} />
        </CategoriesDemoHarness>
      ),
    },
  },
});
