/** The drive itself: one column, folders first, tabs, tray and sheet. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DriveScreen } from "../src/default/index.js";
import type { UploadTrayBag } from "../src/index.js";
import {
  DriveDemoHarness,
  frozenQueue,
  uploadItem,
} from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DOC_CONTRACT,
  DOC_PHOTO,
  FOLDER_PHOTOS,
  ROOT_DOCUMENTS,
  ROOT_FOLDERS,
  SEARCH_HITS,
  WORKSPACE_ID,
} from "./fixtures.js";

const POPULATED: DemoHandlers = {
  "/folders": ROOT_FOLDERS,
  "/documents": ROOT_DOCUMENTS,
  "/starred": { folders: [FOLDER_PHOTOS], documents: [DOC_PHOTO] },
  "/recents": [DOC_PHOTO, DOC_CONTRACT],
  "/search": SEARCH_HITS,
  "/trash": { folders: [], documents: [] },
  // No preview bytes in a demo: the 404 is the fallback path, drawn.
  "/thumbnail": [404, {}],
};

const EMPTY: DemoHandlers = {
  ...POPULATED,
  "/folders": [],
  "/documents": [],
};

const NO_STARS: DemoHandlers = {
  ...POPULATED,
  "/starred": { folders: [], documents: [] },
};

const NO_RECENTS: DemoHandlers = { ...POPULATED, "/recents": [] };

function Screen(props: {
  handlers: DemoHandlers;
  uploads?: UploadTrayBag;
}): ReactElement {
  return (
    <DriveDemoHarness handlers={props.handlers}>
      <DriveScreen
        workspaceId={WORKSPACE_ID}
        {...(props.uploads !== undefined ? { uploads: props.uploads } : {})}
      />
    </DriveDemoHarness>
  );
}

const UPLOADING = frozenQueue([
  uploadItem({ id: "u-1", status: "uploading", loaded: 1_500_000, progress: 0.62 }),
  uploadItem({
    id: "u-2",
    name: "Supplier contract.pdf",
    size: 840_000,
    status: "uploading",
    loaded: 90_000,
    progress: 0.11,
  }),
  uploadItem({ id: "u-3", name: "Q3 budget.csv", size: 118_000 }),
  uploadItem({ id: "u-4", name: "Floorplan.png", size: 640_000, status: "done", progress: 1 }),
]);

export default defineDemo({
  id: "drive.screen",
  title: "Drive",
  description:
    "The whole product on one screen: a sticky path strip, one scrolling column of folders-then-files, a list/grid toggle, per-row star and overflow, the Starred/Recent/Trash tabs, and the upload tray under a FAB. On a wide window the column stops at a measure and centres — that is the entire desktop story, because the two-pane file manager already exists in @stapel/docs-react and a second one would be two screens to fix every bug in.",
  component: DriveScreen,
  covers: [
    "DriveProvider",
    "DriveList",
    "DriveGrid",
    "DriveBreadcrumb",
    "UploadTray",
    "Starred",
    "Recents",
    "DriveSearch",
  ],
  variants: {
    default: {
      viewport: "phone",
      step: "browse",
      description:
        "The workspace root: two folders, then three files, newest first — the server's order inside each group, never re-sorted here.",
      render: () => <Screen handlers={POPULATED} />,
    },
    uploading: {
      viewport: "phone",
      step: "uploading",
      description:
        "Two files in flight and one waiting: concurrency is 2, so the third row says 'waiting' instead of animating a bar that is not moving. The percentages come from real XHR progress events.",
      render: () => <Screen handlers={POPULATED} uploads={UPLOADING} />,
    },
    quotaExceeded: {
      viewport: "phone",
      step: "quota",
      description:
        "The workspace is full. A 507 is not 'the upload failed' — it is a state with its own banner and its own two remedies, and the failed rows deliberately offer no Retry, because retrying a full workspace is the same refusal one second later.",
      render: () => (
        <Screen
          handlers={POPULATED}
          uploads={frozenQueue([
            uploadItem({
              id: "u-1",
              status: "failed",
              quotaExceeded: true,
              progress: 0.4,
              loaded: 960_000,
            }),
          ])}
        />
      ),
    },
    emptyFolder: {
      viewport: "phone",
      step: "empty",
      description:
        "A folder with nothing in it — a sentence only sayable about a read that actually succeeded (matchList's four arms).",
      render: () => <Screen handlers={EMPTY} />,
    },
    starred: {
      viewport: "phone",
      step: "starred",
      description:
        "The Starred tab: folders and documents in one list, the same row component the folder listing uses.",
      render: () => <Screen handlers={POPULATED} />,
    },
    recents: {
      viewport: "phone",
      step: "recents",
      description:
        "The Recent tab: documents only, newest access first — folders are not 'opened' in the sense the backend records.",
      render: () => <Screen handlers={NO_RECENTS} />,
    },
    searchResults: {
      viewport: "phone",
      step: "search",
      description:
        "A tree-wide name search. Each hit carries the breadcrumb of its container, materialized server-side, so a result list costs one request and still says where the match lives.",
      render: () => <Screen handlers={POPULATED} />,
    },
    desktop: {
      viewport: "desktop",
      step: "browse",
      description:
        "The same single column on a wide window: capped at a reading measure and centred. No second layout.",
      render: () => <Screen handlers={NO_STARS} />,
    },
  },
});
