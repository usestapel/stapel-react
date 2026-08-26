/**
 * The response review surface as it ships: per-version columns, keyset paging
 * with the reason printed when a button is off, CSV export driven by the
 * `X-Forms-Next-Before` cursor, and a detail dialog that is a bottom sheet on
 * a phone.
 *
 * It also shows the pair's FRESHNESS POLICY on screen. stapel-forms ships no
 * realtime consumer (MODULE.md §11 reserves `forms:ws:<workspace_id>` for one
 * that does not exist), so this list is refetch-only — and says so, with a
 * visible control, rather than implying live counts.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ResponsesPane } from "../src/default/index.js";
import { formsQueryKeys } from "../src/index.js";
import { FormsDemoHarness, SkinFrame } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import {
  DEMO_FORM_ID,
  DEMO_SUBMISSIONS,
  DEMO_VERSIONS,
  DEMO_WORKSPACE_ID,
} from "./fixtures.js";

const PAGE = { workspaceId: DEMO_WORKSPACE_ID, formId: DEMO_FORM_ID, limit: 50 };

/**
 * One variant's data, built ONCE at module scope: the harness memoizes its
 * runtime and query client on the identity of `seed`/`handlers`, so a fixture
 * rebuilt per render would drop the seeded cache on the floor.
 *
 * The seed is what the story photographs; the handlers answer the SAME data,
 * so a refetch in Ladle confirms the story instead of replacing it.
 */
interface Fixture {
  readonly seed: readonly DemoSeed[];
  readonly handlers: DemoHandlers;
}

function fixture(rows: readonly unknown[]): Fixture {
  return {
    seed: [
      [formsQueryKeys.submissions(PAGE), rows],
      [formsQueryKeys.versions(DEMO_WORKSPACE_ID, DEMO_FORM_ID), DEMO_VERSIONS],
    ],
    handlers: { "/submissions": rows, "/versions": DEMO_VERSIONS },
  };
}

const ANSWERED = fixture(DEMO_SUBMISSIONS);
const NONE = fixture([]);

function Pane(props: { fixture: Fixture }): ReactElement {
  return (
    <FormsDemoHarness
      seed={props.fixture.seed}
      handlers={props.fixture.handlers}
      workspaceId={DEMO_WORKSPACE_ID}
    >
      <SkinFrame>
        <ResponsesPane formId={DEMO_FORM_ID} />
      </SkinFrame>
    </FormsDemoHarness>
  );
}

export default defineDemo({
  id: "forms.responses-pane",
  title: "Responses (default skin)",
  description:
    "Answers as their own version asked them: a submission records WHICH schema it answered, so reviewing an old response shows the questions that were actually put, not today's. Deleting and resending sit behind forms.responses.manage — the capability stapel-forms projects — so a host that declares the caller's grants gets the write block switched off with the permission NAMED beside it, and a host that declares nothing keeps it live and lets the server answer. An ERASED row is gated the same way. A refusal and an outage are drawn as different states: a 403 is a decision and offers no retry, a 503 says it is on our side and does.",
  component: ResponsesPane,
  covers: ["ResponsesTable"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "ready",
      description: "Two responses to version 3, with the per-question columns.",
      render: () => <Pane fixture={ANSWERED} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description:
        "A load that SUCCEEDED and found nothing — never an empty grid, which reads as 'nobody answered' even during an outage.",
      render: () => <Pane fixture={NONE} />,
    },
  },
});
