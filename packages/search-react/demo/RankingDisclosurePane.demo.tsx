/**
 * The P2B Art. 5 disclosure as a READING surface: which parameters decide the
 * order of results, their relative weight, and — the part a hand-written page
 * always loses — which of them the configured engine cannot actually evaluate.
 *
 * Generated from the backend's scorer registry, so the page cannot drift from
 * the ranking it describes. The demo is seeded with a registry where one
 * scorer is inactive, because a disclosure that only ever shows the happy
 * registry has never shown the sentence it exists for.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RankingDisclosurePane } from "../src/default/RankingDisclosurePane.js";
import { SearchSkinHarness } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";
import { DEMO_RANKING } from "./fixtures.js";

const SEED: DemoSeed = { ranking: DEMO_RANKING };

function Disclosure(props: { phone?: boolean }): ReactElement {
  return (
    <SearchSkinHarness seed={SEED} {...(props.phone === true ? { phone: true } : {})}>
      <RankingDisclosurePane />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.ranking-pane",
  title: "Ranking disclosure",
  description:
    "The statutory ranking page in the default skin: every scorer with its weight, the sorts it applies to, and — for a scorer the deployment's engine cannot evaluate — the reason it is inactive, so the disclosure describes the ranking that actually ran rather than the one that was configured.",
  component: RankingDisclosurePane,
  tokens: ["surface-raised"],
  variants: {
    desktop: {
      description:
        "The column capped at the reading measure: past that a statutory text stops being a paragraph and becomes a banner.",
      viewport: "desktop",
      step: "disclosure",
      render: () => <Disclosure />,
    },
    phone: {
      description:
        "The same text at 390px — the weight tag stays beside the parameter it weighs rather than wrapping away from it.",
      viewport: "phone",
      step: "disclosure-phone",
      render: () => <Disclosure phone />,
    },
  },
});
