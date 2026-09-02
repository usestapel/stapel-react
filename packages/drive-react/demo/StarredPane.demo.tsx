/** The Starred tab: one list, folders first, the same row as everywhere. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { StarredPane } from "../src/default/index.js";
import { DriveDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DOC_PHOTO, FOLDER_PHOTOS, WORKSPACE_ID } from "./fixtures.js";

const FULL: DemoHandlers = {
  "/starred": { folders: [FOLDER_PHOTOS], documents: [DOC_PHOTO] },
  "/thumbnail": [404, {}],
};
const EMPTY: DemoHandlers = { "/starred": { folders: [], documents: [] } };
const OUTAGE: DemoHandlers = { "/starred": [503, { code: "stapel.http.503" }] };

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <DriveDemoHarness handlers={props.handlers}>
      <StarredPane
        workspaceId={WORKSPACE_ID}
        onOpen={() => undefined}
        onActions={() => undefined}
      />
    </DriveDemoHarness>
  );
}

export default defineDemo({
  id: "drive.starred",
  title: "Starred",
  description:
    "A star is a bookmark: the backend takes docs.view for it, both verbs answer 204 whatever the previous state was, and the icon flips before the request because the round trip is invisible only if it does. A trashed item drops out of this list but keeps its star until purge — restoring it brings the bookmark back.",
  component: StarredPane,
  covers: ["Starred"],
  variants: {
    default: {
      viewport: "phone",
      step: "populated",
      description: "One starred folder and one starred file, in one list.",
      render: () => <Pane handlers={FULL} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description:
        "Genuinely empty, and the sentence says what a star is FOR rather than 'nothing here'.",
      render: () => <Pane handlers={EMPTY} />,
    },
    failed: {
      viewport: "desktop",
      step: "failed",
      description:
        "The read answered 503: the failure arm, not the empty one. An outage must never wear the costume of an empty list.",
      render: () => <Pane handlers={OUTAGE} />,
    },
  },
});
