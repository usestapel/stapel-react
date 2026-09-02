/** The Recent tab: documents only, newest access first, server order kept. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RecentsPane } from "../src/default/index.js";
import { DriveDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DOC_CONTRACT, DOC_PHOTO, WORKSPACE_ID } from "./fixtures.js";

const FULL: DemoHandlers = {
  "/recents": [DOC_PHOTO, DOC_CONTRACT],
  "/thumbnail": [404, {}],
};
const EMPTY: DemoHandlers = { "/recents": [] };

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <DriveDemoHarness handlers={props.handlers}>
      <RecentsPane
        workspaceId={WORKSPACE_ID}
        onOpen={() => undefined}
        onActions={() => undefined}
      />
    </DriveDemoHarness>
  );
}

export default defineDemo({
  id: "drive.recents",
  title: "Recent",
  description:
    "Written by the service layer on content read, download-URL issuance and accepted save — never by the client, and never by this endpoint, which only reads. Folders are absent by contract, which is why this pane draws one list rather than two with an empty half.",
  component: RecentsPane,
  covers: ["Recents"],
  variants: {
    default: {
      viewport: "phone",
      step: "populated",
      description: "Two documents in the order the server returned them; nothing is re-sorted here.",
      render: () => <Pane handlers={FULL} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description: "Nothing opened yet — and the hint says what will fill it.",
      render: () => <Pane handlers={EMPTY} />,
    },
  },
});
