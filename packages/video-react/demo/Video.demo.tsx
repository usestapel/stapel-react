/** The usage read, in the three states a workspace admin can actually land in. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ScopeUsagePane } from "../src/default/ScopeUsagePane.js";
import { ScopeUsageTable } from "../src/default/ScopeUsageTable.js";
import { loadFailed } from "@stapel/core";
import { StapelApiError } from "@stapel/core";
import { VideoDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

const SCOPE = "acme-7f0c";

/** A window answer with three people in the newest month. */
const WITH_ROWS: DemoHandlers = {
  "/usage/": {
    scope_key: SCOPE,
    tz: "Europe/Berlin",
    months: [
      {
        month: "2026-08",
        period_start: "2026-07-31T22:00:00Z",
        period_end: "2026-08-31T22:00:00Z",
        users: [
          {
            user_id: "u-9a1f",
            presence_seconds: 7385,
            rooms: 4,
            connections: 6,
            first_seen: "2026-08-03T09:12:04Z",
            last_seen: "2026-08-21T16:40:11Z",
          },
          {
            user_id: "u-4c02",
            presence_seconds: 3600,
            rooms: 2,
            connections: 2,
            first_seen: "2026-08-05T11:00:00Z",
            last_seen: "2026-08-19T12:30:00Z",
          },
        ],
      },
      {
        month: "2026-07",
        period_start: "2026-06-30T22:00:00Z",
        period_end: "2026-07-31T22:00:00Z",
        users: [],
      },
    ],
  },
};

/** A month that succeeded and holds nobody. */
const NOBODY: DemoHandlers = {
  "/usage/": {
    scope_key: SCOPE,
    tz: "UTC",
    months: [
      {
        month: "2026-08",
        period_start: "2026-08-01T00:00:00Z",
        period_end: "2026-09-01T00:00:00Z",
        users: [],
      },
    ],
  },
};

/**
 * The uniform 404 — the scope does not exist, holds no calls, or the reader
 * holds no mandate in it. Three situations, one answer, on purpose.
 */
const UNAVAILABLE: DemoHandlers = {
  "/usage/": [404, { localizable_error: "error.404.video_scope_not_found" }],
};

function Usage(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <VideoDemoHarness handlers={props.handlers}>
      <ScopeUsagePane scopeKey={SCOPE} tz="Europe/Berlin" />
    </VideoDemoHarness>
  );
}

/** The period refusal, handed straight to the table: `months` outside 1..36 is
 * a question the pane now refuses locally, and this is the arm it renders. */
const INVALID_PERIOD = new StapelApiError({
  code: "error.400.video_invalid_usage_period",
  status: 400,
  message: "month must be YYYY-MM, months a positive integer, and tz an IANA time zone",
  params: {},
});

export default defineDemo({
  id: "video.usage",
  title: "Scope usage",
  description:
    "GET /video/api/v1/scopes/{scope_key}/usage/ — who inside one partition talked how much, per calendar month, as the workspace-admin screen the nav manifest mounts. Three states, and the point of the pair is that none of them collapses into another: rows, a month that succeeded and holds nobody, and the uniform error.404.video_scope_not_found that covers a missing scope, a scope with no calls and a reader holding no USAGE_MANDATE all at once (a 403 would confirm that a guessed tenant id is real). Below the tablet edge the four-column table becomes one card per person — measured on the pane's own box, not on the viewport, so a 320px sidebar on a desktop gets the same treatment.",
  component: ScopeUsagePane,
  covers: ["ScopeUsageTable", "VideoProvider"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      description: "Two people in the newest month, with the month selector.",
      viewport: "desktop",
      step: "ready",
      render: () => <Usage handlers={WITH_ROWS} />,
    },
    phone: {
      description:
        "The same month at 390px: cards, not a four-column table pushed off the side of the page.",
      viewport: "phone",
      step: "ready",
      render: () => <Usage handlers={WITH_ROWS} />,
    },
    nobody: {
      description:
        "A month that succeeded and holds nobody — a designed zero state, never the same screen as a refusal.",
      viewport: "phone",
      step: "empty",
      render: () => <Usage handlers={NOBODY} />,
    },
    "invalid-period": {
      description:
        "The table on its own, in the arm the pair owned a predicate for since 0.1.0 and never rendered: a reporting period the read cannot accept.",
      viewport: "phone",
      step: "invalid",
      render: () => (
        <VideoDemoHarness>
          <ScopeUsageTable rows={loadFailed(INVALID_PERIOD)} month="2026-08" />
        </VideoDemoHarness>
      ),
    },
    unavailable: {
      description:
        "The uniform 404. One sentence for three situations, and never an empty table.",
      viewport: "desktop",
      step: "unavailable",
      render: () => <Usage handlers={UNAVAILABLE} />,
    },
  },
});
