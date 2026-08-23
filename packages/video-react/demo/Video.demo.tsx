/** The usage read, in the three states a workspace admin can actually land in. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { VideoProvider, formatPresence, useScopeUsage } from "../src/index.js";
import { DemoCard, StepBadge, VideoDemoHarness } from "./_harness.js";
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
      <DemoCard heading="useScopeUsage">
        <UsageBody />
      </DemoCard>
    </VideoDemoHarness>
  );
}

function UsageBody(): ReactElement {
  const bag = useScopeUsage(SCOPE);
  return (
    <>
      <StepBadge step={bag.rows.status} />
      <StepBadge step={`month: ${bag.month ?? "—"}`} />
      <StepBadge step={`window: ${bag.monthLabels.join(" ") || "—"}`} />
      {bag.rows.status === "ready" &&
        bag.rows.data.map((row) => (
          <StepBadge
            key={row.user_id}
            step={`${row.user_id} · ${formatPresence(row.presence_seconds)} · ${row.rooms}`}
          />
        ))}
    </>
  );
}

export default defineDemo({
  id: "video.usage",
  title: "Scope usage",
  description:
    "GET /video/api/v1/scopes/{scope_key}/usage/ — who inside one partition talked how much, per calendar month. Three states, and the point of the pair is that none of them collapses into another: rows, a month that succeeded and holds nobody, and the uniform error.404.video_scope_not_found that covers a missing scope, a scope with no calls and a reader holding no USAGE_MANDATE all at once (a 403 would confirm that a guessed tenant id is real). The wire carries user ids and never names; the host resolves them through nameFor.",
  component: VideoProvider,
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <Usage handlers={WITH_ROWS} /> },
    nobody: { render: () => <Usage handlers={NOBODY} /> },
    unavailable: { render: () => <Usage handlers={UNAVAILABLE} /> },
  },
});
