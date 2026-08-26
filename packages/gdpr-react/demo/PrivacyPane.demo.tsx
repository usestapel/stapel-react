/**
 * The account-privacy screen itself — the thing `account.privacy` mounts, and
 * for a whole release the thing nobody had ever photographed.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PrivacyPane } from "../src/default/PrivacyPane.js";
import { GdprDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  CLOSURE_IN_GRACE,
  ERASURE_ERASING,
  ERASURE_TIMEOUT,
  EXPORT_NOT_FOUND,
  EXPORT_PARTIAL,
  EXPORT_PROCESSING,
  NO_ACTIVE_CLOSURE,
} from "./_fixtures.js";

/** Nothing pending, nothing asked for — what almost every account looks like. */
const QUIET: DemoHandlers = {
  "/me/erasures": [],
  "/user/data-export/status": EXPORT_NOT_FOUND,
  "/user/account/close/status": NO_ACTIVE_CLOSURE,
};

/** The account is on its way out, an archive is being built beside it. */
const CLOSING: DemoHandlers = {
  "/me/erasures": [ERASURE_ERASING],
  "/user/data-export/status": EXPORT_PROCESSING,
  "/user/account/close/status": CLOSURE_IN_GRACE,
};

/** A finished archive, an overdue deletion — the screen with news on it. */
const BUSY: DemoHandlers = {
  "/me/erasures": [ERASURE_ERASING, ERASURE_TIMEOUT],
  "/user/data-export/status": EXPORT_PARTIAL,
  "/user/account/close/status": NO_ACTIVE_CLOSURE,
};

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <GdprDemoHarness handlers={props.handlers}>
      <PrivacyPane />
    </GdprDemoHarness>
  );
}

export default defineDemo({
  id: "gdpr.privacy-pane",
  title: "Privacy and your data",
  description:
    "The screen `account.privacy` mounts, under its own name, in the order a person needs it: a copy of your data, what is already on its way out, a formal request, and only then the account itself. The export leads because the deletions list is empty for almost every account, and a page should not open by answering a question nobody asked. The destructive control is LAST on purpose — nobody should delete an account to answer a question the export would have answered. Each of the four panels runs its own read, so a failure in one never blanks the others.",
  component: PrivacyPane,
  // Every variant here mounts the whole pair through `GdprProvider` — the
  // runtime, the query client and the i18n engine four independent panels
  // read from. It is covered by the screen it powers rather than by a story
  // of its own printing one `ready` chip.
  covers: ["GdprProvider"],
  tokens: ["surface", "surface-raised", "text", "text-muted"],
  variants: {
    default: {
      description: "Nothing pending: the state almost every account is in.",
      viewport: "phone",
      step: "idle",
      render: () => <Pane handlers={QUIET} />,
    },
    "closing-with-export": {
      description:
        "A closure inside its grace period, an archive being built, one recording already erasing.",
      viewport: "phone",
      step: "grace",
      render: () => <Pane handlers={CLOSING} />,
    },
    "archive-ready-desktop": {
      description:
        "A finished (partial) archive and an overdue deletion, at desk width.",
      viewport: "desktop",
      step: "ready",
      render: () => <Pane handlers={BUSY} />,
    },
  },
});
