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
import type { DemoSeed } from "./_harness.js";
import {
  DEMO_FORM_ROW,
  DEMO_FORM_ROW_DRAFT,
  DEMO_WORKSPACE_ID,
} from "./fixtures.js";

const FILLED: readonly DemoSeed[] = [
  [
    formsQueryKeys.forms(DEMO_WORKSPACE_ID),
    [DEMO_FORM_ROW, DEMO_FORM_ROW_DRAFT],
  ],
];

const NONE: readonly DemoSeed[] = [
  [formsQueryKeys.forms(DEMO_WORKSPACE_ID), []],
];

function Pane(props: { seed: readonly DemoSeed[] }): ReactElement {
  return (
    // No `workspaceId` prop anywhere: the workspace comes off the runtime,
    // which is exactly how a nav-mounted route reaches this screen.
    <FormsDemoHarness seed={props.seed} workspaceId={DEMO_WORKSPACE_ID}>
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
  covers: ["FormList"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "ready",
      description: "Two forms: one open and collecting, one still a draft.",
      render: () => <Pane seed={FILLED} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description:
        "A load that SUCCEEDED and found nothing — the designed empty state, with the one action that resolves it.",
      render: () => <Pane seed={NONE} />,
    },
  },
});
