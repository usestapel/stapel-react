/** Drill-down facets with their remaining counts, labelled from the category schema. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FacetPanel } from "../src/index.js";
import { SearchStateDemoHarness, DemoCard, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_FEATURES, DEMO_SEARCH_RESPONSE } from "./fixtures.js";

const HANDLERS: DemoHandlers = { "/query": DEMO_SEARCH_RESPONSE };

function Panel(): ReactElement {
  return (
    <SearchStateDemoHarness handlers={HANDLERS} initialSearch="type=listing&f.brand=bosch">
      <DemoCard heading="FacetPanel">
        <FacetPanel categoryFeatures={DEMO_FEATURES}>
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              <StepBadge step={`approximate: ${String(bag.approximate)}`} />
              <StepBadge step={`skipped: ${bag.skipped.join(", ") || "none"}`} />
              {bag.state.status === "ready" &&
                bag.state.data.map((group) => (
                  <StepBadge
                    key={group.slug}
                    step={`${group.label}: ${group.options
                      .map((o) => `${o.label}=${o.count === null ? "not counted" : o.count}`)
                      .join(" ")}`}
                  />
                ))}
            </>
          )}
        </FacetPanel>
      </DemoCard>
    </SearchStateDemoHarness>
  );
}

export default defineDemo({
  id: "search.facets",
  title: "Facet panel",
  description:
    "Counts are computed with each facet's own filter removed, so picking one value does not zero its siblings. Labels come from the category schema through @stapel/attributes-react; a slug the server skipped shows 'not counted', never 0.",
  component: FacetPanel,
  tokens: ["surface-raised"],
  variants: { default: { render: () => <Panel /> } },
});
