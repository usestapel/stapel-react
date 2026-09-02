/** The path strip: free when the navigation walked there, walked when not. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DriveBreadcrumbBar } from "../src/default/index.js";
import type { DriveBreadcrumbNode } from "../src/index.js";
import { DriveDemoHarness, neverSettles } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { FOLDER_FINANCE, ROOT_FOLDERS, WORKSPACE_ID } from "./fixtures.js";

const TRAIL: readonly DriveBreadcrumbNode[] = [
  { id: FOLDER_FINANCE.id, name: FOLDER_FINANCE.name },
  { id: "f-2026", name: "2026" },
];

const FOLDERS: DemoHandlers = { "/folders": ROOT_FOLDERS };
const STILL_LOADING: DemoHandlers = { "/folders": neverSettles };

function Bar(props: {
  handlers: DemoHandlers;
  folderId: string | null;
  trail?: readonly DriveBreadcrumbNode[];
}): ReactElement {
  return (
    <DriveDemoHarness handlers={props.handlers}>
      <DriveBreadcrumbBar
        workspaceId={WORKSPACE_ID}
        folderId={props.folderId}
        {...(props.trail !== undefined ? { trail: props.trail } : {})}
        onSelectFolder={() => undefined}
      />
    </DriveDemoHarness>
  );
}

export default defineDemo({
  id: "drive.breadcrumbs",
  title: "Breadcrumb bar",
  description:
    "Sticky, horizontally scrolling, never wrapping onto a second line. The trail is normally FREE — descending pushes the folder that was tapped, and the row was on screen a moment ago — so browsing costs one folder read per rung. Only a cold deep link has no trail, and then the docs pair's ancestor walk answers.",
  component: DriveBreadcrumbBar,
  covers: ["DriveBreadcrumb"],
  variants: {
    default: {
      viewport: "phone",
      step: "nested",
      description: "My drive › Finance › 2026, from the trail the navigation already held.",
      render: () => <Bar handlers={FOLDERS} folderId="f-2026" trail={TRAIL} />,
    },
    root: {
      viewport: "phone",
      step: "root",
      description: "At the workspace root: one crumb, and it is the truth.",
      render: () => <Bar handlers={FOLDERS} folderId={null} trail={[]} />,
    },
    loading: {
      viewport: "phone",
      step: "loading",
      description:
        "A cold deep link with the ancestor read still in flight: a skeleton, not the finished root crumb — those two look identical and mean opposite things.",
      render: () => <Bar handlers={STILL_LOADING} folderId={FOLDER_FINANCE.id} />,
    },
  },
});
