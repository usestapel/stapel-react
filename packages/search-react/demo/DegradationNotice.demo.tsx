/**
 * `degraded[]`, on the screen — and the two volumes it can be said at.
 *
 * The backend declares per query what it could not do, precisely so a client
 * can tell the person; swallowing that is the same class of defect as
 * `data ?? []`. But a warning box over every landing page teaches a reader
 * that the page is broken, so a surface with no room for one passes
 * `"inline"`. Both variants say the same sentences; only the loudness differs.
 *
 * The notice takes its list as a prop, which is why this demo needs no wire at
 * all: the parsing lives in `state/degradations.ts` and is tested there.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DegradationNotice } from "../src/default/DegradationNotice.js";
import { SearchDemoHarness, DemoFrame } from "./_harness.js";
import { parseDegradations } from "../src/index.js";
import type { DegradationNoticeVariant } from "../src/default/DegradationNotice.js";

/** What the demo response reports: a typo pass skipped, sampled facet counts,
 * and a scorer the engine could not evaluate (the named `scorer:` form). */
const DEGRADED = parseDegradations([
  "typo_tolerance",
  "exact_facet_counts",
  "scorer:geo_decay",
]);

function Notice(props: {
  phone?: boolean;
  variant: DegradationNoticeVariant;
}): ReactElement {
  return (
    <SearchDemoHarness>
      <DemoFrame {...(props.phone === true ? { phone: true } : {})}>
        <DegradationNotice degradations={DEGRADED} variant={props.variant} />
      </DemoFrame>
    </SearchDemoHarness>
  );
}

export default defineDemo({
  id: "search.degradation-notice",
  title: "Degradation notice",
  description:
    "What the engine could not do for THIS query, in words: the typo pass it skipped, the facet counts it sampled rather than counted, the scorer it could not evaluate. An unknown degradation still renders — with its raw literal — because a build that predates a limitation should say 'the engine reported something we have no wording for', not nothing.",
  component: DegradationNotice,
  tokens: ["surface-raised"],
  variants: {
    banner: {
      description:
        "A catalogue page has room for the warning box, and a catalogue page is where the caveat changes what the results MEAN.",
      viewport: "desktop",
      step: "banner",
      render: () => <Notice variant="banner" />,
    },
    inline: {
      description:
        "A landing page showing six cards under a hero has no room for a box: the same sentences as quiet secondary text at 390px.",
      viewport: "phone",
      step: "inline",
      render: () => <Notice phone variant="inline" />,
    },
  },
});
