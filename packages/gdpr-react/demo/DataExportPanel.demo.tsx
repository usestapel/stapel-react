/**
 * The Art. 15 / 20 archive with a button attached — including the state that
 * used to be a screen that never changed.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DataExportPanel } from "../src/default/DataExportPanel.js";
import { GdprDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  EXPORT_NOT_FOUND,
  EXPORT_PARTIAL,
  EXPORT_PROCESSING,
} from "./_fixtures.js";

/** The 404 that means "you have never asked for an archive". */
const NEVER_ASKED: DemoHandlers = {
  "/user/data-export/status": EXPORT_NOT_FOUND,
};

/** A worker is building it: the request control is off, with the reason
 * beside it, and the status read polls itself until this changes. */
const BUILDING: DemoHandlers = {
  "/user/data-export/status": EXPORT_PROCESSING,
};

/** Ready, partial, and downloadable — but only for a caller holding the
 * emailed token, which is why this variant passes one. */
const READY: DemoHandlers = {
  "/user/data-export/status": EXPORT_PARTIAL,
};

function Panel(props: {
  handlers: DemoHandlers;
  token?: string;
}): ReactElement {
  return (
    <GdprDemoHarness handlers={props.handlers}>
      <DataExportPanel {...(props.token !== undefined ? { token: props.token } : {})} />
    </GdprDemoHarness>
  );
}

export default defineDemo({
  id: "gdpr.data-export",
  title: "Download your data",
  description:
    "Four states that never collapse into each other. While a worker is building the archive the request button is OFF with its reason printed beside it — read from the wire status, not learned from the 409 a second request would earn — and the status re-reads itself every 15s, so a person who asks for their data and waits sees it finish. The download appears only when the server says the single-use token is still unspent AND the host passes the token from the email; without one, the panel says where the link is instead of inventing an input box for it.",
  component: DataExportPanel,
  tokens: ["surface-raised", "info", "warning"],
  variants: {
    default: {
      description: "Never asked for one — a state, not a failure.",
      viewport: "phone",
      step: "none",
      render: () => <Panel handlers={NEVER_ASKED} />,
    },
    building: {
      description:
        "1 of 5 sections ready; the request control is off and says why. This is the state that polls.",
      viewport: "phone",
      step: "processing",
      render: () => <Panel handlers={BUILDING} />,
    },
    "ready-with-token": {
      description:
        "Ready but partial: the missing section is named, the expiry is a date, and the download is offered because the host routed a page carrying the emailed token.",
      viewport: "phone",
      step: "ready",
      render: () => <Panel handlers={READY} token="tok-from-the-email" />,
    },
    "ready-desktop": {
      description: "The same finished archive at desk width, with no token in the URL.",
      viewport: "desktop",
      step: "ready",
      render: () => <Panel handlers={READY} />,
    },
  },
});
