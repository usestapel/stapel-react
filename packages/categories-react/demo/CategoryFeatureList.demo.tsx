/**
 * A category's feature SCHEMA, rendered — the definitions, not the values.
 *
 * The type badge is not a string this file invents: `featureType` is
 * `@stapel/attributes-react`'s single reader of `config.type` and
 * `BUILTIN_VALUE_EDITOR_TYPES` is its own statement of which types a build can
 * draw, so a type outside that set is marked HERE, on the schema, rather than
 * discovered when somebody opens the compose form and finds a missing field.
 * The `comment` line under a name is the catalogue author's note to the person
 * filling the form — a field that reached no screen in the fleet until now.
 */
import { defineDemo } from "@stapel/showcase";
import { CategoryFeatureList } from "../src/default/index.js";
import { CategoriesDemoHarness } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import { DEMO_FEATURES } from "./fixtures.js";

const SEEDED: DemoSeed = { features: { 2: DEMO_FEATURES, 3: [] } };
const OUTAGE: DemoHandlers = {
  "/features/": [503, { code: "stapel.http.503", message: "unavailable" }],
};

export default defineDemo({
  id: "categories.features",
  title: "Category feature schema",
  description:
    "GET /categories/{id}/features/ resolves inheritance and order server-side and returns config VERBATIM — no defaults filled in, so an absent key means 'the type's default', never 'off'. attributes-react owns those defaults; this pair does not restate them.",
  component: CategoryFeatureList,
  covers: ["CategoryFeatures"],
  tokens: ["surface-raised"],
  variants: {
    schema: {
      description:
        "Required markers, type badges, translator comments — and one type no builtin editor covers.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryFeatureList categoryId={2} />
        </CategoriesDemoHarness>
      ),
    },
    "no extra details": {
      description: "A category that asks for nothing — common for a root, and not an error.",
      viewport: "desktop",
      step: "empty",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryFeatureList categoryId={3} />
        </CategoriesDemoHarness>
      ),
    },
    outage: {
      description: "The schema read refused. A compose form must not guess the fields.",
      viewport: "desktop",
      step: "failed",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CategoryFeatureList categoryId={2} />
        </CategoriesDemoHarness>
      ),
    },
  },
});
