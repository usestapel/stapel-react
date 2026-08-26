/**
 * `/c/:slug` — one category, and the SLOT where another pair's listings go.
 *
 * The slot is the design: the sub-category menu is this pair's, the results
 * with facets are `@stapel/search-react`'s, and a pair may not import another
 * pair. The `unfilled slot` variant exists to photograph what a container that
 * forgot the prop actually gets — a named dashed region in development, and
 * nothing at all in production — because the previous answer was silence in
 * the exact place every listing belongs.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { Card, Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { CategoryPage } from "../src/default/index.js";
import { categoryLabel, renderCategoryLabel } from "../src/catalog/labels.js";
import type { Category } from "../src/api/types.js";
import { CategoriesDemoHarness } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import { DEMO_FEATURES, DEMO_ROWS } from "./fixtures.js";

const SEEDED: DemoSeed = {
  rows: DEMO_ROWS,
  features: { 3: DEMO_FEATURES },
};
const OUTAGE: DemoHandlers = {
  "/categories/": [503, { code: "stapel.http.503", message: "unavailable" }],
};

/** What a container hands in: search's results pane, standing in here.
 *
 * It is handed the resolved CATEGORY, so the heading says "Listings in
 * Electronics" — the slug (`electronics`) is an address, and an address in a
 * sentence is the machine's vocabulary on a shopper's page. */
function Listings(props: { readonly category: Category }): ReactElement {
  const t = useT();
  return (
    <Flex vertical gap={spacing[2]} data-demo-listings={props.category.slug}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t("demo.listings.title", {
          category: renderCategoryLabel(categoryLabel(props.category), t),
        })}
      </Typography.Title>
      {["Bosch GSB 18V", "Makita DHP484", "Bosch UniversalImpact"].map((name) => (
        <Card key={name} size="small">
          {name}
        </Card>
      ))}
    </Flex>
  );
}

export default defineDemo({
  id: "categories.category",
  title: "Category page",
  description:
    "The /c/:slug route. The slug is resolved against the CLIENT-BUILT tree because the server has no slug lookup, and 'there is no category here' is shown only once the sync has succeeded — a slow network must never render a 404 for a page that exists.",
  component: CategoryPage,
  covers: ["CategoryTree"],
  tokens: ["surface-base"],
  variants: {
    composed: {
      description: "What a wired storefront shows: crumbs, sub-categories, listings.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryPage
            slug="electronics"
            renderListings={(category) => <Listings category={category} />}
          />
        </CategoriesDemoHarness>
      ),
    },
    "unfilled slot": {
      description:
        "The container forgot renderListings. Development names the gap; production renders nothing.",
      viewport: "desktop",
      step: "slot-unfilled",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryPage slug="electronics" />
        </CategoriesDemoHarness>
      ),
    },
    "leaf with its schema": {
      description:
        "A leaf category has no sub-menu; `showFeatures` turns the feature schema on for an operator view.",
      viewport: "desktop",
      step: "leaf",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryPage
            slug="laptops"
            showFeatures
            renderListings={(category) => <Listings category={category} />}
          />
        </CategoriesDemoHarness>
      ),
    },
    "no such category": {
      description: "A stale link. Said once the catalogue loaded, never before.",
      viewport: "desktop",
      step: "unknown-slug",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryPage slug="typewriters" />
        </CategoriesDemoHarness>
      ),
    },
    outage: {
      description: "The sync refused. Crumbs degrade to one line; the body says which read failed.",
      viewport: "desktop",
      step: "failed",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CategoryPage slug="electronics" />
        </CategoriesDemoHarness>
      ),
    },
  },
});
