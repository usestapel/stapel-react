/** Search: the debounce belongs to the box, the breadcrumb to the server. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DriveSearchField } from "../src/default/index.js";
import { DriveDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { SEARCH_HITS, WORKSPACE_ID } from "./fixtures.js";

const HITS: DemoHandlers = { "/search": SEARCH_HITS };
const NOTHING: DemoHandlers = { "/search": [] };
const OUTAGE: DemoHandlers = { "/search": [500, { code: "stapel.http.500" }] };

function Field(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <DriveDemoHarness handlers={props.handlers}>
      <DriveSearchField workspaceId={WORKSPACE_ID} onOpenHit={() => undefined} />
    </DriveDemoHarness>
  );
}

export default defineDemo({
  id: "drive.search",
  title: "Search",
  description:
    "The delay lives in the input, not in the hook: useDriveSearch takes a finished q, so a query restored from a URL runs at once and a caller that already debounced does not pay twice. An empty box asks nothing — the backend refuses a blank q with a 400 on purpose, so 'type something' is a state and not an error.",
  component: DriveSearchField,
  covers: ["DriveSearch"],
  variants: {
    default: {
      viewport: "phone",
      step: "idle",
      description:
        "Nothing typed: the idle state, distinct from 'no results' — one of them is a question nobody asked.",
      render: () => <Field handlers={HITS} />,
    },
    noResults: {
      viewport: "phone",
      step: "empty",
      description: "A query that matched nothing.",
      render: () => <Field handlers={NOTHING} />,
    },
    failed: {
      viewport: "desktop",
      step: "failed",
      description: "The search endpoint answered 500 — the failure arm with its retry.",
      render: () => <Field handlers={OUTAGE} />,
    },
  },
});
