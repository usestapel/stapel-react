/**
 * The SHIPPED admin entry point, drawn — not the headless twin's step chips.
 *
 * Both variants seed the query cache so the first render is already `ready`:
 * a story photographed statically never awaits a fetch, and an unseeded
 * variant photographs its skeleton (which is the same picture under every
 * name — the C-SAMESHOT defect this demo's `step`s exist to make visible).
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FormsListPane } from "../src/default/index.js";
import { formsQueryKeys } from "../src/index.js";
import { FormsDemoHarness, SkinFrame } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import {
  DEMO_FORM_ROW,
  DEMO_FORM_ROW_DRAFT,
  DEMO_WORKSPACE_ID,
} from "./fixtures.js";

/**
 * One variant's data, built ONCE at module scope. The harness memoizes its
 * runtime and query client on the identity of `seed`/`handlers`, so a fixture
 * rebuilt per render would hand it a new client every render and drop the
 * seeded cache on the floor.
 */
interface Fixture {
  readonly seed: readonly DemoSeed[];
  readonly handlers: DemoHandlers;
}

/** The seed is what the story photographs; the handlers answer the SAME rows,
 * so a refetch in Ladle confirms the story instead of replacing it. */
function fixture(rows: readonly unknown[]): Fixture {
  return {
    seed: [[formsQueryKeys.forms(DEMO_WORKSPACE_ID), rows]],
    handlers: { "/forms": rows },
  };
}

const FILLED = fixture([DEMO_FORM_ROW, DEMO_FORM_ROW_DRAFT]);
const NONE = fixture([]);

function Pane(props: { fixture: Fixture }): ReactElement {
  return (
    // No `workspaceId` prop anywhere: the workspace comes off the runtime,
    // which is exactly how a nav-mounted route reaches this screen.
    <FormsDemoHarness
      seed={props.fixture.seed}
      handlers={props.fixture.handlers}
      workspaceId={DEMO_WORKSPACE_ID}
    >
      <SkinFrame>
        <FormsListPane />
      </SkinFrame>
    </FormsDemoHarness>
  );
}

export default defineDemo({
  id: "forms.list-pane",
  title: "Forms list (default skin)",
  description:
    "The workspace's forms with the two acts the builder does not own: configure who gets told about a response, and delete. The delete confirmation is one SkinConfirm for the whole list — a bottom sheet on a phone — and it names the consequence, because deleting an open form stops its public link resolving immediately.",
  component: FormsListPane,
  // `FormsProvider` is covered here because the harness mounts it: this screen
  // takes its workspace off the runtime the provider carries, which is the
  // provider's whole observable behaviour.
  covers: ["FormList", "FormsProvider"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "ready",
      description: "Two forms: one open and collecting, one still a draft.",
      render: () => <Pane fixture={FILLED} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description:
        "A load that SUCCEEDED and found nothing — the designed empty state, with the one action that resolves it.",
      render: () => <Pane fixture={NONE} />,
    },
  },
});
