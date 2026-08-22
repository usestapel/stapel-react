/** The P2B Art. 5 disclosure, generated from the backend's scorer registry. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RankingDisclosure } from "../src/index.js";
import { SearchDemoHarness, DemoCard, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_RANKING, DEMO_TYPE } from "./fixtures.js";

const HANDLERS: DemoHandlers = { "/ranking": DEMO_RANKING };

function Disclosure(): ReactElement {
  return (
    <SearchDemoHarness handlers={HANDLERS}>
      <DemoCard heading="RankingDisclosure">
        <RankingDisclosure type={DEMO_TYPE}>
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              <StepBadge
                step={
                  bag.state.status === "ready"
                    ? bag.state.data.map((s) => `${s.slug}=${s.weight}`).join(" ")
                    : "—"
                }
              />
              <StepBadge step={`inactive: ${bag.inactive.map((s) => s.slug).join(", ") || "none"}`} />
            </>
          )}
        </RankingDisclosure>
      </DemoCard>
    </SearchDemoHarness>
  );
}

export default defineDemo({
  id: "search.ranking",
  title: "Ranking disclosure",
  description:
    "Which parameters order the results and how much each weighs, straight from the scorer registry. Parameters the configured engine cannot evaluate are listed with their reason rather than filtered out.",
  component: RankingDisclosure,
  tokens: ["surface-raised"],
  variants: { default: { render: () => <Disclosure /> } },
});
