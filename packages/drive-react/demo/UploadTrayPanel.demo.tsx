/** The upload tray: real bars, a per-file retry, and the quota state. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { UploadTrayPanel } from "../src/default/index.js";
import { StapelApiError } from "@stapel/core";
import type { UploadTrayBag } from "../src/index.js";
import { DriveDemoHarness, frozenQueue, uploadItem } from "./_harness.js";

function Tray(props: { bag: UploadTrayBag }): ReactElement {
  return (
    <DriveDemoHarness>
      <UploadTrayPanel bag={props.bag} />
    </DriveDemoHarness>
  );
}

const NETWORK_FAILURE = new StapelApiError({
  code: "stapel.http.502",
  message: "upload PUT to put_url failed",
  status: 502,
});

const QUOTA = new StapelApiError({
  code: "error.507.docs_workspace_quota",
  message: "workspace storage quota exhausted",
  status: 507,
});

export default defineDemo({
  id: "drive.uploadTray",
  title: "Upload tray",
  description:
    "One row per file with a bar that moves because bytes moved — the presigned PUT runs over XMLHttpRequest precisely because fetch cannot report request-body progress. Two files transfer at once; the rest say 'waiting', which is the truth about a queue with concurrency 2 rather than a stalled 0%.",
  component: UploadTrayPanel,
  variants: {
    default: {
      viewport: "phone",
      step: "in-flight",
      description:
        "Two uploading, one waiting, one done — the four states a queue actually holds at once.",
      render: () => (
        <Tray
          bag={frozenQueue([
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
            uploadItem({
              id: "u-4",
              name: "Floorplan.png",
              size: 640_000,
              status: "done",
              progress: 1,
            }),
          ])}
        />
      ),
    },
    failed: {
      viewport: "phone",
      step: "failed",
      description:
        "The object store refused one file. It keeps its own error and its own Retry; the other rows are untouched, because one bad file must not fail nineteen good ones.",
      render: () => (
        <Tray
          bag={frozenQueue([
            uploadItem({
              id: "u-1",
              status: "failed",
              error: NETWORK_FAILURE,
              loaded: 400_000,
              progress: 0.17,
            }),
            uploadItem({ id: "u-2", name: "Q3 budget.csv", size: 118_000, status: "done", progress: 1 }),
          ])}
        />
      ),
    },
    quota: {
      viewport: "phone",
      step: "quota",
      description:
        "507: the workspace is full. Its own banner with the two remedies, and NO Retry on the row — a button that cannot work is worse than no button.",
      render: () => (
        <Tray
          bag={frozenQueue([
            uploadItem({
              id: "u-1",
              status: "failed",
              error: QUOTA,
              quotaExceeded: true,
              loaded: 960_000,
              progress: 0.4,
            }),
          ])}
        />
      ),
    },
    empty: {
      viewport: "desktop",
      step: "empty",
      description: "Nothing queued yet — the tray says so instead of drawing an empty box.",
      render: () => <Tray bag={frozenQueue([])} />,
    },
  },
});
