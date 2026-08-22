/** A result page: rows, the honesty block, and the keyset controls. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SearchResults } from "../src/index.js";
import { SearchStateDemoHarness, DemoCard, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_SEARCH_RESPONSE } from "./fixtures.js";

const HANDLERS: DemoHandlers = { "/query": DEMO_SEARCH_RESPONSE };

function Results(): ReactElement {
  return (
    <SearchStateDemoHarness handlers={HANDLERS}>
      <DemoCard heading="SearchResults">
        <SearchResults>
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              <StepBadge
                step={
                  bag.page === null
                    ? "—"
                    : `count ${bag.page.count}${bag.page.countIsEstimate ? "~" : ""} · promoted ${bag.page.promotedCount}`
                }
              />
              <StepBadge
                step={`degraded: ${bag.degradations.map((d) => d.kind).join(", ") || "none"}`}
              />
              <StepBadge
                step={`next ${bag.next.available ? "available" : (bag.next.block?.code ?? "?")}`}
              />
            </>
          )}
        </SearchResults>
      </DemoCard>
    </SearchStateDemoHarness>
  );
}

export default defineDemo({
  id: "search.results",
  title: "Search results",
  description:
    "One keyset page, rendered through matchList so 'nothing found' can only be said about a search that actually ran. The count is marked as an estimate when the envelope says so, and degraded[] is surfaced rather than swallowed.",
  component: SearchResults,
  covers: ["SearchProvider", "SearchStateProvider"],
  tokens: ["surface-raised"],
  variants: { default: { render: () => <Results /> } },
});
