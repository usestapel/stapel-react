/** The landing strip, and the breadcrumb bar, over the same synced catalogue. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { CategoryBreadcrumbs, CategoryCarousel } from "../src/index.js";
import {
  CategoriesDemoHarness,
  DemoCard,
  StepBadge,
  useDemoStore,
} from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_CAROUSEL, DEMO_PAGE } from "./fixtures.js";

const HANDLERS: DemoHandlers = {
  "/categories/carousel/": DEMO_CAROUSEL,
  "/categories/": DEMO_PAGE,
};

function Strip(): ReactElement {
  const store = useDemoStore();
  return (
    <CategoriesDemoHarness handlers={HANDLERS}>
      <DemoCard heading="CategoryCarousel">
        <CategoryCarousel>
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              {bag.state.status === "ready" &&
                bag.state.data.map((entry) => (
                  <StepBadge
                    key={entry.category.id}
                    step={`${entry.href} · icon=${entry.icon ?? "none"} · ${entry.label.kind}`}
                  />
                ))}
            </>
          )}
        </CategoryCarousel>
      </DemoCard>
      <DemoCard heading="CategoryBreadcrumbs">
        <CategoryBreadcrumbs store={store} slug="used-phones">
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              {bag.state.status === "ready" &&
                bag.state.data.map((crumb) => (
                  <StepBadge
                    key={crumb.node.id}
                    step={`${crumb.label.value} [${crumb.label.kind}]${crumb.isCurrent ? " ←" : ""}`}
                  />
                ))}
            </>
          )}
        </CategoryBreadcrumbs>
      </DemoCard>
    </CategoriesDemoHarness>
  );
}

export default defineDemo({
  id: "categories.carousel",
  title: "Carousel and breadcrumbs",
  description:
    "The carousel is the one endpoint that arrives ready to render — the server filters active + carousel_enabled and sends its own Cache-Control. Icon references stay opaque strings: the host resolves them, the library never guesses a CDN path. Each label reports whether it is a translation key or a literal.",
  component: CategoryCarousel,
  covers: ["CategoryBreadcrumbs"],
  tokens: ["surface-raised"],
  variants: { default: { render: () => <Strip /> } },
});
