/**
 * The availability pane, including the two answers that are NOT "here is your
 * free time": an incomplete expansion, and a calendar nobody opened for
 * booking. Both were invisible in this pair before the skin existed.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AvailabilityPane } from "../src/default/index.js";
import { DEFAULT_SLOT_MINUTES, calendarQueryKeys } from "../src/index.js";
import { CalendarDemoHarness } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";

const SLOTS = {
  busy: [{ start: "2026-07-13T10:00:00Z", end: "2026-07-13T11:00:00Z" }],
  slots: [
    { start: "2026-07-13T09:00:00Z", end: "2026-07-13T09:30:00Z" },
    { start: "2026-07-13T11:00:00Z", end: "2026-07-13T11:30:00Z" },
  ],
  truncated: false,
};

/** The same answer, but the expansion hit MAX_EXPANSION_OCCURRENCES: the later
 * slots below the banner only LOOK free. */
const TRUNCATED = { ...SLOTS, truncated: true };

/** No availability windows are set — a question never configured, which is a
 * different thing from a week that is full. */
const NO_WINDOWS = { busy: [], slots: [], truncated: false };

const WINDOW = { start: "2026-07-13T00:00:00Z", end: "2026-07-20T00:00:00Z" };

/** The availability read this pane opens on, on the pane's own default
 * granularity — the key `<Availability>` will ask for. */
function seedSlots(body: unknown): DemoSeed {
  return [
    {
      key: calendarQueryKeys.availability({
        ...WINDOW,
        slotMinutes: DEFAULT_SLOT_MINUTES,
      }),
      data: body,
    },
  ];
}

function Pane(props: { readonly seed: DemoSeed }): ReactElement {
  return (
    <CalendarDemoHarness seed={props.seed}>
      <AvailabilityPane start={WINDOW.start} end={WINDOW.end} />
    </CalendarDemoHarness>
  );
}

export default defineDemo({
  id: "calendar.availability",
  title: "Free time",
  description:
    "Free/busy and bookable slots. `truncated` is rendered as a visible warning above the slots — a degraded answer that does not say it is degraded would offer already-booked time with total confidence — and an empty slots[] is named as 'no windows are set', never as 'nothing free'.",
  component: AvailabilityPane,
  covers: ["Availability"],
  tokens: ["warning-bg", "surface-raised"],
  variants: {
    default: {
      description: "Windows are set: open slots, and what is already booked.",
      viewport: "phone",
      step: "ready",
      render: () => <Pane seed={seedSlots(SLOTS)} />,
    },
    truncated: {
      description: "The expansion hit its cap: the banner says the answer is incomplete before anyone books off it.",
      viewport: "phone",
      step: "ready.truncated",
      render: () => <Pane seed={seedSlots(TRUNCATED)} />,
    },
    "no-windows": {
      description: "No availability windows — its own named arm, with the reason.",
      viewport: "desktop",
      step: "ready.no_windows",
      render: () => <Pane seed={seedSlots(NO_WINDOWS)} />,
    },
  },
});
