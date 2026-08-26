/**
 * Every default-skin surface, on both widths and both theme sides.
 *
 * §54's promise is that a pair ships a DESIGNED default skin, not a set of
 * components that happen to compile. Two properties make that machine-checkable
 * and neither is visible in a single-width, single-mode smoke test:
 *
 *  - **mobile first** — the surface renders at 390px, and the dialogs are
 *    bottom SHEETS there and centred modals on a desktop. That rule lives once
 *    (`@stapel/tokens-antd/skin`), so what this asserts is that the pair
 *    INHERITS it rather than re-deciding per screen.
 *  - **no hardcoded light** — every skin root in the document reports the
 *    document's live mode. `mode = "light"` defaults are exactly the defect
 *    the shared `useThemeMode()` substrate replaced, and they survive any test
 *    that only ever renders one side.
 *
 * Ten surfaces × phone/desktop × light/dark. The reads are seeded, so a screen
 * is asserted in the state it ships in rather than as a skeleton.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, StapelApiError, actionAvailable, createI18n } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { ReactElement, ReactNode } from "react";
import {
  AvailabilityPane,
  Calendar,
  CalendarAgenda,
  CalendarMonthGrid,
  DeleteEventAction,
  EventEditorSheet,
  EventSheet,
  ParticipantsField,
  RecurrenceField,
  RsvpControl,
} from "../src/default/index.js";
import {
  CalendarProvider,
  DEFAULT_SLOT_MINUTES,
  NO_RECURRENCE,
  calendarQueryKeys,
  createCalendarRuntime,
  registerCalendarI18n,
  viewRange,
} from "../src/index.js";
import type { CalendarEvent, CalendarInstance } from "../src/index.js";

const BASE = "https://calendar.test/calendar/api/v1/";
const ANCHOR = "2026-07-13T09:00:00Z";
const WINDOW = { start: "2026-07-13T00:00:00Z", end: "2026-07-20T00:00:00Z" };
const EVENT_ID = "e-standalone";

/** The two widths the skin is designed against (the sheet rule's own break). */
const PHONE_WIDTH = 390;
const DESKTOP_WIDTH = 1280;

const EVENT: CalendarEvent = {
  id: EVENT_ID,
  title: "Design review",
  description: "Weekly sync on the new booking flow.",
  start: "2026-07-13T10:00:00Z",
  end: "2026-07-13T11:00:00Z",
  owner_id: "u-1",
  scope_key: "ws-1",
  status: "confirmed",
  recurrence_type: "none",
  rrule: "",
  participants: [{ user_id: "u-2", rsvp: "accepted" }],
};

const INSTANCE: CalendarInstance = {
  key: EVENT_ID,
  eventId: EVENT_ID,
  seriesId: null,
  title: EVENT.title,
  start: EVENT.start,
  end: EVENT.end,
  status: "confirmed",
  isVirtual: false,
  event: null,
};

const AVAILABILITY = {
  busy: [{ start: "2026-07-13T10:00:00Z", end: "2026-07-13T11:00:00Z" }],
  slots: [{ start: "2026-07-13T09:00:00Z", end: "2026-07-13T09:30:00Z" }],
  truncated: false,
};

/**
 * A transport that refuses everything.
 *
 * Every read this matrix cares about is seeded, so a request reaching the wire
 * would mean the seed missed its key — and a canned 200 would hide that by
 * quietly painting an empty screen. A refusal makes the miss visible.
 */
const refusingFetch = (() =>
  Promise.reject(
    new StapelApiError({
      code: "error.503.mandate_unavailable",
      message: "no transport in a render test",
      status: 503,
    })
  )) as unknown as typeof globalThis.fetch;

function Wrap(props: { children: ReactNode }): ReactElement {
  const engine = createI18n({ locale: "en" });
  registerCalendarI18n(engine);
  const runtime = createCalendarRuntime({ baseUrl: BASE, fetch: refusingFetch });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  });
  queryClient.setQueryData(calendarQueryKeys.event(EVENT_ID), EVENT);
  queryClient.setQueryData(
    calendarQueryKeys.availability({ ...WINDOW, slotMinutes: DEFAULT_SLOT_MINUTES }),
    AVAILABILITY
  );
  for (const mode of ["month", "week", "day"] as const) {
    queryClient.setQueryData(calendarQueryKeys.range(viewRange(mode, ANCHOR)), {
      events: [EVENT],
      occurrences: [],
    });
  }
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={engine}>
        <CalendarProvider runtime={runtime}>{props.children}</CalendarProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** One default-skin surface, and how to find it once it is on screen. */
interface Surface {
  readonly name: string;
  /** The testid the surface stamps on itself. */
  readonly testId: string;
  /** `true` when the surface is a dialog: a sheet on a phone, a modal above. */
  readonly dialog?: boolean;
  readonly render: () => ReactElement;
}

const SURFACES: readonly Surface[] = [
  {
    name: "Calendar",
    testId: "calendar",
    render: () => (
      <Calendar defaultAnchor={ANCHOR} defaultView="month" viewerId="u-1" baseUrl={BASE} />
    ),
  },
  {
    name: "CalendarMonthGrid",
    testId: "calendar-grid",
    render: () => (
      <CalendarMonthGrid
        data-testid="calendar-grid"
        days={[EVENT.start]}
        anchor={ANCHOR}
        instances={[INSTANCE]}
      />
    ),
  },
  {
    name: "CalendarAgenda",
    testId: "calendar-agenda",
    render: () => <CalendarAgenda instances={[INSTANCE]} />,
  },
  {
    name: "EventSheet",
    testId: "calendar-event",
    dialog: true,
    render: () => (
      <EventSheet
        eventId={EVENT_ID}
        open
        onClose={() => undefined}
        viewerId="u-1"
        baseUrl={BASE}
      />
    ),
  },
  {
    name: "EventEditorSheet",
    testId: "calendar-editor",
    dialog: true,
    render: () => (
      <EventEditorSheet open onClose={() => undefined} event={EVENT} />
    ),
  },
  {
    name: "RecurrenceField",
    testId: "calendar-recurrence",
    render: () => (
      <RecurrenceField
        value={{ ...NO_RECURRENCE, type: "weekly", end: "count", count: 8 }}
        onChange={() => undefined}
      />
    ),
  },
  {
    name: "ParticipantsField",
    testId: "calendar-participants",
    render: () => (
      <ParticipantsField eventId={EVENT_ID} participants={EVENT.participants ?? []} />
    ),
  },
  {
    name: "RsvpControl",
    testId: "calendar-rsvp",
    render: () => (
      <RsvpControl eventId={EVENT_ID} current="accepted" gate={actionAvailable()} />
    ),
  },
  {
    name: "DeleteEventAction",
    testId: "calendar-delete",
    dialog: true,
    render: () => (
      <DeleteEventAction
        eventId={EVENT_ID}
        open
        onOpenChange={() => undefined}
        gate={actionAvailable()}
      />
    ),
  },
  {
    name: "AvailabilityPane",
    testId: "calendar-availability",
    render: () => <AvailabilityPane start={WINDOW.start} end={WINDOW.end} />,
  },
];

const VIEWPORTS = [
  { name: "phone", width: PHONE_WIDTH, dialogSurface: "sheet" },
  { name: "desktop", width: DESKTOP_WIDTH, dialogSurface: "modal" },
] as const;

const MODES = ["light", "dark"] as const;

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe.each(SURFACES)("$name renders on every side of the matrix", (surface) => {
  for (const viewport of VIEWPORTS) {
    for (const mode of MODES) {
      it(`${viewport.name} · ${mode}`, () => {
        window.innerWidth = viewport.width;
        document.documentElement.setAttribute("data-theme", mode);

        render(
          <Wrap>
            <SkinTheme>{surface.render()}</SkinTheme>
          </Wrap>
        );

        expect(screen.getByTestId(surface.testId)).toBeDefined();

        // Nothing in the tree may pin a side: every skin root — the wrapper's
        // and any the surface mounts itself — reports the document's mode.
        const roots = Array.from(
          document.querySelectorAll("[data-stapel-skin-mode]")
        );
        expect(roots.length).toBeGreaterThan(0);
        for (const root of roots) {
          expect(root.getAttribute("data-stapel-skin-mode")).toBe(mode);
        }

        if (surface.dialog === true) {
          const dialogs = Array.from(
            document.querySelectorAll("[data-stapel-dialog-surface]")
          );
          expect(dialogs.length).toBeGreaterThan(0);
          for (const dialog of dialogs) {
            expect(dialog.getAttribute("data-stapel-dialog-surface")).toBe(
              viewport.dialogSurface
            );
          }
        }
      });
    }
  }
});
