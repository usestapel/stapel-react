/** Flat rows in, tree out — plus the breadcrumb the server cannot give you. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { CategoryTree } from "../src/index.js";
import {
  CategoriesDemoHarness,
  DemoCard,
  StepBadge,
  useDemoStore,
} from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_PAGE } from "./fixtures.js";

const HANDLERS: DemoHandlers = { "/categories/": DEMO_PAGE };

function Level(props: { slug?: string }): ReactElement {
  const store = useDemoStore();
  return (
    <CategoriesDemoHarness handlers={HANDLERS}>
      <DemoCard heading="CategoryTree">
        <CategoryTree store={store} {...(props.slug !== undefined ? { slug: props.slug } : {})}>
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              <StepBadge
                step={`crumbs: ${bag.breadcrumbs
                  .map((n) => n.category.slug)
                  .join(" / ") || "—"}`}
              />
              {bag.state.status === "ready" &&
                bag.state.data.map((node) => (
                  <StepBadge
                    key={node.id}
                    step={`${node.category.slug} (${String(node.children.length)} sub)`}
                  />
                ))}
            </>
          )}
        </CategoryTree>
      </DemoCard>
    </CategoriesDemoHarness>
  );
}

export default defineDemo({
  id: "categories.tree",
  title: "Category tree",
  description:
    "stapel-categories has no tree endpoint: the list returns flat rows ordered by revision, with ancestry as comma-joined pk strings. The client assembles the hierarchy, drops soft-deleted and inactive rows, and resolves /c/:slug against the result — the server has no slug lookup either.",
  component: CategoryTree,
  covers: ["CategoriesProvider"],
  tokens: ["surface-raised"],
  variants: {
    roots: { render: () => <Level /> },
    "one category": { render: () => <Level slug="phones" /> },
  },
});
