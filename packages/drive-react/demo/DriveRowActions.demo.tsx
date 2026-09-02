/** Row actions as a bottom sheet — there is no right-click on a phone. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DriveRowActions } from "../src/default/index.js";
import { documentRow, folderRow } from "../src/index.js";
import type { DriveRow } from "../src/index.js";
import { DriveDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DOC_PHOTO, FOLDER_FINANCE, ROOT_FOLDERS, WORKSPACE_ID } from "./fixtures.js";

const FOLDERS: DemoHandlers = { "/folders": ROOT_FOLDERS };

function Sheet(props: { row: DriveRow }): ReactElement {
  return (
    <DriveDemoHarness handlers={FOLDERS}>
      <DriveRowActions
        workspaceId={WORKSPACE_ID}
        row={props.row}
        onClose={() => undefined}
      />
    </DriveDemoHarness>
  );
}

export default defineDemo({
  id: "drive.rowActions",
  title: "Row actions",
  description:
    "Open, star, rename, move, download and trash, as a full-width sheet with thumb-sized rows. Every write is the docs pair's — rename and move are both a PATCH on the object, because the backend has no separate move route — and the rename/move prompts are that pair's dialogs with this pair's copy. The star is the one write this package owns.",
  component: DriveRowActions,
  variants: {
    default: {
      viewport: "phone",
      step: "document",
      description:
        "A file: download is offered, and the star reads 'Remove star' because this one is starred.",
      render: () => <Sheet row={documentRow(DOC_PHOTO)} />,
    },
    folder: {
      viewport: "phone",
      step: "folder",
      description:
        "A folder: no download — there is no endpoint that answers a folder's bytes, so the action is absent rather than present and dead.",
      render: () => <Sheet row={folderRow(FOLDER_FINANCE)} />,
    },
  },
});
