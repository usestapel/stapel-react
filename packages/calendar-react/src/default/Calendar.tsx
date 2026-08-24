/**
 * `<Calendar>` — the wired screen. One component, a view SWITCH, not three
 * exports.
 *
 * ── Geometry is the box's, not the viewport's ─────────────────────────────
 *
 * The component measures itself (`useElementWidth`). Above `GRID_MIN_WIDTH` a
 * month renders as a six-week grid; below it — a phone, a side panel, a
 * dashboard column — it renders `<CalendarAgenda>` over the same deduped
 * instants, so a repeating stand-up still appears on each of its days. A month
 * grid never scrolls sideways: a grid you have to pan is not a month view.
 * Between those two, `CELL_DENSE_WIDTH` drops cell titles for dots.
 *
 * ── One read, deduped once ────────────────────────────────────────────────
 *
 * `GET /calendar` returns a materialized occurrence twice by design, and the
 * dedup rule is stated only in the backend's MODULE.md. It is applied in the
 * headless layer (`model/occurrences.ts`), so this screen — and any other
 * consumer — draws each instant once without knowing the rule exists.
 *
 * ── Every arm is designed ─────────────────────────────────────────────────
 *
 * Loading, failed and empty come from the shared substrate (`LoadBoundary`,
 * `EmptyState`, `ErrorAlert`), and the empty arm is reachable only from a read
 * that ANSWERED — an outage renders as an outage with a retry, never as a
 * quiet month.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, Segmented, Typography } from "antd";
import { EmptyState, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useI18n, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { CalendarView } from "../headless/CalendarView.js";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";
import { formatDayHeading, formatMonthLabel } from "../model/format.js";
import { shiftAnchor, viewDays, viewRange } from "../model/range.js";
import type { CalendarViewMode } from "../model/range.js";
import { CalendarAgenda } from "./CalendarAgenda.js";
import { CalendarMonthGrid } from "./CalendarMonthGrid.js";
import { EventEditorSheet } from "./EventEditorSheet.js";
import { EventSheet } from "./EventSheet.js";
import { CELL_DENSE_WIDTH, GRID_MIN_WIDTH, useElementWidth } from "./useElementWidth.js";

const MODE_KEY: Readonly<Record<CalendarViewMode, string>> = {
  month: CALENDAR_I18N_KEYS.viewModeMonth,
  week: CALENDAR_I18N_KEYS.viewModeWeek,
  day: CALENDAR_I18N_KEYS.viewModeDay,
};

const MODES: readonly CalendarViewMode[] = ["month", "week", "day"];

export interface CalendarProps {
  /** Which shape to open on. Default `"month"`. */
  readonly defaultView?: CalendarViewMode;
  /** The instant the view is centred on. Default: now. */
  readonly defaultAnchor?: string;
  /** The signed-in user's id — owner-only controls need it to say anything. */
  readonly viewerId?: string;
  /** The runtime's base URL, for the `.ics` download on the detail sheet. */
  readonly baseUrl?: string;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
  /** What the skin paints under itself. Default `"base"` — a full screen. */
  readonly surface?: SkinSurface;
  readonly "data-testid"?: string;
}

export function Calendar(props: CalendarProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const testId = props["data-testid"] ?? "calendar";
  const { ref, width } = useElementWidth<HTMLDivElement>();

  const [view, setView] = useState<CalendarViewMode>(props.defaultView ?? "month");
  const [anchor, setAnchor] = useState(
    props.defaultAnchor ?? new Date().toISOString()
  );
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const days = viewDays(view, anchor);
  const range = viewRange(view, anchor);
  // Narrow until measured: a list degrades gracefully into a wide box, and a
  // seven-column grid does not degrade into a narrow one.
  const wide = width !== undefined && width >= GRID_MIN_WIDTH;
  const dense = width !== undefined && width < CELL_DENSE_WIDTH;
  const heading =
    view === "day" ? formatDayHeading(anchor, locale) : formatMonthLabel(anchor, locale);

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface={props.surface ?? "base"}
      data-testid={`${testId}-root`}
    >
      <div ref={ref} data-testid={testId} data-layout={wide ? "grid" : "agenda"}>
        <Flex vertical gap={spacing["3"]}>
          <Flex gap={spacing["2"]} align="center" wrap justify="space-between">
            <Flex gap={spacing["2"]} align="center">
              <Button
                aria-label={t(CALENDAR_I18N_KEYS.viewPrevious)}
                data-testid={`${testId}-prev`}
                data-analytics="none"
                data-analytics-reason="local range paging; no server flow to step"
                onClick={() => {
                  setAnchor(shiftAnchor(view, anchor, -1));
                }}
              >
                {t(CALENDAR_I18N_KEYS.viewPrevious)}
              </Button>
              <Button
                data-testid={`${testId}-today`}
                data-analytics="none"
                data-analytics-reason="local range paging; no server flow to step"
                onClick={() => {
                  setAnchor(new Date().toISOString());
                }}
              >
                {t(CALENDAR_I18N_KEYS.viewToday)}
              </Button>
              <Button
                aria-label={t(CALENDAR_I18N_KEYS.viewNext)}
                data-testid={`${testId}-next`}
                data-analytics="none"
                data-analytics-reason="local range paging; no server flow to step"
                onClick={() => {
                  setAnchor(shiftAnchor(view, anchor, 1));
                }}
              >
                {t(CALENDAR_I18N_KEYS.viewNext)}
              </Button>
            </Flex>
            <Typography.Title level={4} style={{ marginBottom: spacing["0"] }}>
              {heading}
            </Typography.Title>
            <Flex gap={spacing["2"]} align="center" wrap>
              <Segmented
                value={view}
                data-testid={`${testId}-view`}
                aria-label={t(CALENDAR_I18N_KEYS.viewHeading)}
                onChange={(next) => {
                  setView(next as CalendarViewMode);
                }}
                options={MODES.map((m) => ({ value: m, label: t(MODE_KEY[m]) }))}
              />
              <Button
                type="primary"
                data-testid={`${testId}-new`}
                data-analytics="none"
                data-analytics-reason="opens the editor sheet; the write is tracked there"
                onClick={() => {
                  setComposing(true);
                }}
              >
                {t(CALENDAR_I18N_KEYS.viewNewEvent)}
              </Button>
            </Flex>
          </Flex>

          <CalendarView start={range.start} end={range.end}>
            {(bag) => (
              <LoadBoundary
                state={bag.state}
                onRetry={bag.refetch}
                testId={`${testId}-range`}
              >
                {(data) =>
                  data.instances.length === 0 ? (
                    <EmptyState
                      testId={`${testId}-empty`}
                      title={t(CALENDAR_I18N_KEYS.viewEmpty)}
                      hint={t(CALENDAR_I18N_KEYS.viewEmptyHint)}
                      action={
                        <Button
                          type="primary"
                          data-testid={`${testId}-empty-new`}
                          data-analytics="none"
                          data-analytics-reason="opens the editor sheet; the write is tracked there"
                          onClick={() => {
                            setComposing(true);
                          }}
                        >
                          {t(CALENDAR_I18N_KEYS.viewNewEvent)}
                        </Button>
                      }
                    />
                  ) : wide && view === "month" ? (
                    <CalendarMonthGrid
                      days={days}
                      anchor={anchor}
                      instances={data.instances}
                      dense={dense}
                      data-testid={`${testId}-grid`}
                      onSelect={(instance) => {
                        setOpenEventId(instance.eventId);
                      }}
                    />
                  ) : (
                    <CalendarAgenda
                      instances={data.instances}
                      data-testid={`${testId}-agenda`}
                      onSelect={(instance) => {
                        setOpenEventId(instance.eventId);
                      }}
                    />
                  )
                }
              </LoadBoundary>
            )}
          </CalendarView>
        </Flex>

        {openEventId !== null ? (
          <EventSheet
            eventId={openEventId}
            open
            onClose={() => {
              setOpenEventId(null);
            }}
            onDeleted={() => {
              setOpenEventId(null);
            }}
            {...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {})}
            {...(props.baseUrl !== undefined ? { baseUrl: props.baseUrl } : {})}
            data-testid={`${testId}-event`}
          />
        ) : null}

        <EventEditorSheet
          open={composing}
          onClose={() => {
            setComposing(false);
          }}
          defaultStart={anchor}
          data-testid={`${testId}-composer`}
        />
      </div>
    </SkinTheme>
  );
}
